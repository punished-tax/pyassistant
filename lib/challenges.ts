// lib/challenges.ts
import { generateObject, embed, embedMany, cosineSimilarity, NoObjectGeneratedError } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { Redis } from '@upstash/redis';

// Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from the environment.
const kv = Redis.fromEnv();

export type Difficulty = 'easy' | 'medium' | 'hard';
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

// Older stored challenges have no embedding; they're backfilled lazily on first duplicate check.
const EMBEDDINGS_KEY = 'meta:question_embeddings'; // hash: date -> embedding vector
const EMBEDDING_DIMENSIONS = 512;
// Cosine similarity at/above which two questions count as the same problem reworded.
// Tune against real data: raise it if fresh questions get rejected, lower it if rewordings slip through.
export const SIMILARITY_THRESHOLD = 0.8;

// ChallengeData interface remains the same
export interface ChallengeData {
  id: string;
  date: string; // YYYY-MM-DD
  difficulty: Difficulty;
  question: string;
  questionTitle: string;
  inputOutput: {
    input: string;
    output: string;
  };
  solutionHeader: string;
  solution: string;
  explanation: string;
  testCases: Array<{
    input: string;
    output: string;
  }>;
}

export interface AvailableChallengeInfo {
  date: string;
  questionTitle: string;
}

// Schema for the model's response. 'id'/'date'/'difficulty' aren't asked for here since
// we control those ourselves rather than trusting the model to echo them back correctly.
const challengeSchema = z.object({
  question: z.string().describe('The problem description, about lists or strings.'),
  questionTitle: z.string().describe('A condensed title for the question.'),
  inputOutput: z.object({
    input: z.string().describe('A single, clear sample input, represented as a Python literal in the same format as the test cases (a tuple of arguments if solve takes several, e.g. "([1, 2], 3)"). Never use assignment statements like "n = 5".'),
    output: z.string().describe('The corresponding sample output, represented as a Python literal.'),
  }),
  solutionHeader: z.string().describe("The Python function signature needed for the solution; the function must be named 'solve'."),
  solution: z.string().describe("A correct Python code solution containing only the 'solve' function defined by solutionHeader."),
  explanation: z.string().describe('A clear explanation of the Python solution approach.'),
  testCases: z.array(z.object({
    input: z.string().describe('Input for this test case, represented as a Python literal.'),
    output: z.string().describe('Expected output for this test case, represented as a Python literal.'),
  })).length(5),
});

// --- Helper functions for hashing (Edge compatible) ---
function normalizeQuestionText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data); // Web Crypto API
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}


function embeddingText(c: { questionTitle: string; question: string }): string {
  return `${c.questionTitle}
${c.question}`;
}

const embeddingModel = () => openai.textEmbeddingModel('text-embedding-3-small');
const embeddingOptions = { openai: { dimensions: EMBEDDING_DIMENSIONS } };

// Returns the most similar previously-stored question (date + score), embedding and storing any
// legacy challenges that don't have a vector yet.
async function findMostSimilar(
  embedding: number[]
): Promise<{ date: string; score: number } | null> {
  const stored = (await kv.hgetall<Record<string, number[]>>(EMBEDDINGS_KEY)) ?? {};
  const dates = (await kv.smembers('meta:available_challenge_dates')) as string[];
  const missing = dates.filter((d) => !stored[d]);

  if (missing.length > 0) {
    const challenges = await Promise.all(missing.map((d) => kv.get<ChallengeData>(`challenge:${d}`)));
    const backfillable = challenges.filter((c): c is ChallengeData => !!c?.question);
    if (backfillable.length > 0) {
      const { embeddings } = await embedMany({
        model: embeddingModel(),
        values: backfillable.map(embeddingText),
        providerOptions: embeddingOptions,
      });
      const toStore: Record<string, number[]> = {};
      backfillable.forEach((c, i) => { toStore[c.date] = embeddings[i]; stored[c.date] = embeddings[i]; });
      await kv.hset(EMBEDDINGS_KEY, toStore);
    }
  }

  let best: { date: string; score: number } | null = null;
  for (const [date, vec] of Object.entries(stored)) {
    const score = cosineSimilarity(embedding, vec);
    if (!best || score > best.score) best = { date, score };
  }
  return best;
}

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

// Result of an optional check run on each generated challenge (e.g. actually executing the Python
// solution). Returns the challenge to keep (the check may normalise it) or a reason to reject it.
export type ChallengeVerifier = (
  challenge: ChallengeData
) => Promise<{ challenge: ChallengeData } | { error: string }>;

export interface GenerationOptions {
  difficulty?: Difficulty; // random when omitted
  model?: string;
  reasoningEffort?: ReasoningEffort;
  maxOutputTokens?: number;
  verify?: ChallengeVerifier;
  maxAttempts?: number;
}

type CandidateResult =
  | { challenge: ChallengeData; embedding: number[] | null }
  | 'duplicate_detected' | 'unsafe_solution_pattern' | 'verification_failed' | null;

// Refactored OpenAI fetch logic into its own function for retries
async function fetchAndValidateChallengeFromOpenAI(
  date: string,
  difficulty: Difficulty,
  attempt: number = 1,
  options: GenerationOptions = {}
): Promise<CandidateResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable not set.");
    return null;
  }

  console.log(`Requesting challenge data from OpenAI for date: ${date} (Attempt: ${attempt}, difficulty: ${difficulty})`);

  try {
    const { object: parsedData } = await generateObject({
      model: openai(options.model ?? 'gpt-5-mini'),
      schema: challengeSchema,
      system: `You are an assistant that generates daily Python coding challenges (difficulty: ${difficulty}) about lists or strings. The 'solutionHeader' must accurately define the function signature used in the 'solution'. Always use standard Python type hints. For lists use list[type], for dictionaries use dict[key_type, value_type]. Do NOT use capitalized List, Dict, etc. The 'solution' MUST be a single self-contained 'solve' function that takes its input ONLY through its parameters (matching 'solutionHeader' exactly) and returns its answer with a 'return' statement. NEVER read input via input(), sys.stdin, or any other stdin/console mechanism, and NEVER include an 'if __name__ == "__main__":' block or any top-level code that calls 'solve' itself — the caller invokes 'solve' directly with already-parsed arguments. This rule applies no matter how algorithmically involved the problem is (e.g. dynamic programming, graphs, backtracking) — do not fall back to a stdin/stdout competitive-programming script style for harder problems. Provide exactly 5 distinct 'testCases', ensuring inputs and outputs are valid Python literal representations where applicable (e.g., lists, strings, numbers). The main 'inputOutput' example should be different from the 'testCases'. ${attempt > 1 ? 'IMPORTANT: Please generate a substantially DIFFERENT challenge than any previous attempt for this date.' : ''}`,
      prompt: `Generate the ${difficulty}-difficulty Python coding challenge for the date: ${date}. Provide 5 distinct test cases in addition to the main example.`,
      // gpt-5-mini doesn't support `temperature`; retry variation comes from the
      // "generate a substantially different challenge" instruction in the system prompt.
      // reasoning_effort is kept low since this is a straightforward structured-output
      // task — otherwise the model can burn the whole token budget on hidden reasoning
      // tokens and return no object.
      providerOptions: { openai: { reasoningEffort: options.reasoningEffort ?? 'low' } },
      // Reasoning tokens count against this budget, so raise it together with reasoningEffort.
      maxOutputTokens: options.maxOutputTokens ?? 4000,
    });

    // Guard against the model falling back to a stdin/stdout competitive-programming style
    // instead of a plain parameter-based function (the harness always calls solve(...) with
    // parsed arguments directly, never via stdin) — this has been observed on harder/DP
    // problems despite the system prompt forbidding it.
    const unsafePatternRegex = /\bsys\s*\.\s*stdin\b|\binput\s*\(|__name__\s*==\s*['"]__main__['"]/;
    if (unsafePatternRegex.test(parsedData.solution!)) {
        console.warn(`Unsafe solution pattern (stdin/__main__) detected for date ${date} (Attempt ${attempt}). Question: "${parsedData.questionTitle}"`);
        return 'unsafe_solution_pattern';
    }

    let candidate: ChallengeData = {
        id: date, date: date, difficulty,
        question: parsedData.question, questionTitle: parsedData.questionTitle,
        inputOutput: { input: parsedData.inputOutput.input, output: parsedData.inputOutput.output },
        solutionHeader: parsedData.solutionHeader, solution: parsedData.solution,
        explanation: parsedData.explanation,
        testCases: parsedData.testCases,
    };

    // Optional execution check, run before the (paid) embedding call.
    if (options.verify) {
        const verdict = await options.verify(candidate);
        if ('error' in verdict) {
            console.warn(`Verification failed for date ${date} (Attempt ${attempt}). Question: "${parsedData.questionTitle}": ${verdict.error}`);
            return 'verification_failed';
        }
        candidate = verdict.challenge;
    }

    // Exact-match hash check first (free), then a semantic check to catch reworded repeats.
    const questionHashesSetKey = 'meta:question_hashes';
    const newQuestionHash = await generateContentHash(normalizeQuestionText(parsedData.question));

    try {
        if (await kv.sismember(questionHashesSetKey, newQuestionHash)) {
            console.warn(`Duplicate question (exact hash ${newQuestionHash}) for date ${date} (Attempt ${attempt}). Question: "${parsedData.questionTitle}"`);
            return 'duplicate_detected';
        }
    } catch (kvError) {
        console.error(`Error checking for duplicate hash in KV for date ${date} (Attempt ${attempt}):`, kvError);
    }

    let embedding: number[] | null = null;
    try {
        ({ embedding } = await embed({
            model: embeddingModel(),
            value: embeddingText(parsedData),
            providerOptions: embeddingOptions,
        }));
        const nearest = await findMostSimilar(embedding);
        if (nearest && nearest.score >= SIMILARITY_THRESHOLD) {
            console.warn(`Semantic duplicate of ${nearest.date} (similarity ${nearest.score.toFixed(3)}) for date ${date} (Attempt ${attempt}). Question: "${parsedData.questionTitle}"`);
            return 'duplicate_detected';
        }
    } catch (embedError) {
        console.error(`Semantic duplicate check failed for date ${date} (Attempt ${attempt}); proceeding without it:`, embedError);
    }

    return { challenge: candidate, embedding };

  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
        console.error(`Model failed to generate a schema-conforming object for date ${date} (Attempt ${attempt}): ${error.message}`);
    } else {
        console.error(`Error fetching/processing OpenAI data for date ${date} (Attempt ${attempt}):`, error);
    }
    return null;
  }
}


export async function getChallengeDataForDate(date: string): Promise<ChallengeData | null> {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("Invalid date format for getChallengeDataForDate. Received:", date);
    return null;
  }

  const cacheKey = `challenge:${date}`;

  // 1. Check cache first
  try {
    const cachedData = await kv.get<ChallengeData>(cacheKey);
    if (cachedData && cachedData.id === date && cachedData.question) {
      // console.log(`Serving challenge data for ${date} from Redis cache.`);
      return cachedData;
    }
  } catch (error) {
    console.error(`Error fetching from Redis for ${date} (key: ${cacheKey}):`, error);
  }

  // 2. Not in cache: generate one (unverified — the on-request path has no Python runtime).
  const generated = await generateUniqueChallenge(date);
  if (!generated) return null;

  // 3. Store it. Still return the challenge if the KV write fails.
  console.log(`Successfully fetched unique challenge for ${date}. Storing...`);
  try {
    await storeChallenge(generated.challenge, generated.embedding);
  } catch (kvError) {
    console.error(`Error storing data in Redis for date ${date}:`, kvError);
  }
  return generated.challenge;
}

// Generates a challenge that passes the unsafe-pattern, duplicate and (if given) verification checks,
// retrying with a fresh challenge on rejection. Does not store anything. Shared by the request-time
// path above and the offline generator script (scripts/generate-challenges.mjs).
export async function generateUniqueChallenge(
  date: string,
  options: GenerationOptions = {}
): Promise<{ challenge: ChallengeData; embedding: number[] | null } | null> {
  // Difficulty is picked once per date so retries stay at the same level.
  const difficulty = options.difficulty ?? DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
  const maxAttempts = options.maxAttempts ?? 3; // Initial attempt + 2 retries (the semantic check rejects more than the exact hash did)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fetchAndValidateChallengeFromOpenAI(date, difficulty, attempt, options);
    if (result === 'duplicate_detected' || result === 'unsafe_solution_pattern' || result === 'verification_failed') {
      if (attempt < maxAttempts) {
        console.log(`${result} on attempt ${attempt} for ${date}. Retrying...`);
        continue;
      }
      console.warn(`${result} on final attempt (${attempt}) for ${date}. Giving up.`);
      return null;
    }
    if (!result) {
      // OpenAI/schema error: not retried, same as before.
      console.error(`Failed to fetch challenge from OpenAI for ${date} on attempt ${attempt} (non-duplicate error). Not retrying for this type of error.`);
      return null;
    }
    return result;
  }
  return null;
}

// Writes a challenge plus its dedupe metadata (hash, embedding) to Redis. Overwrites any existing
// challenge for the same date.
export async function storeChallenge(challenge: ChallengeData, embedding: number[] | null): Promise<void> {
  const finalHash = await generateContentHash(normalizeQuestionText(challenge.question));
  await kv.set(`challenge:${challenge.date}`, challenge);
  await kv.sadd('meta:available_challenge_dates', challenge.date);
  await kv.sadd('meta:question_hashes', finalHash);
  if (embedding) await kv.hset(EMBEDDINGS_KEY, { [challenge.date]: embedding });
  console.log(`Stored challenge for ${challenge.date} in KV. Hash: ${finalHash}`);
}

// Updated function to get available dates WITH their titles
export async function getAvailableChallengesInfo(): Promise<AvailableChallengeInfo[]> {
  const availableDatesSetKey = 'meta:available_challenge_dates';
  const challengesInfo: AvailableChallengeInfo[] = [];

  try {
    console.log(`Fetching all available challenge dates from set '${availableDatesSetKey}'...`);
    const dates = await kv.smembers(availableDatesSetKey);

    if (!dates || dates.length === 0) {
      console.log(`No dates found in set '${availableDatesSetKey}'.`);
      return [];
    }
    
    // Filter for valid date strings before processing
    const validDates = dates.filter((date): date is string =>
        typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    );

    console.log(`Found ${validDates.length} valid dates. Fetching titles...`);

    // Fetch title for each valid date
    // Using Promise.all for concurrent fetching from KV
    const challengeDataPromises = validDates.map(async (date) => {
      const cacheKey = `challenge:${date}`;
      try {
        // We only need the questionTitle, but KV stores the whole object.
        // If performance becomes an issue with many items, consider storing titles separately.
        const challenge = await kv.get<ChallengeData>(cacheKey);
        if (challenge && challenge.questionTitle) {
          return { date: challenge.date, questionTitle: challenge.questionTitle };
        }
        console.warn(`Could not retrieve title for date ${date} or title was missing.`);
        return null; // Or some default if a challenge object exists but title is missing
      } catch (error) {
        console.error(`Error fetching challenge data for title on date ${date} from KV:`, error);
        return null;
      }
    });

    const results = await Promise.all(challengeDataPromises);

    results.forEach(result => {
      if (result) {
        challengesInfo.push(result);
      }
    });

    // Sort by date, descending (newest first)
    challengesInfo.sort((a, b) => b.date.localeCompare(a.date));

    console.log(`Successfully fetched info for ${challengesInfo.length} challenges.`);
    return challengesInfo;

  } catch (error) {
    console.error(`Error fetching available challenge dates/info from Redis:`, error);
    return []; // Return empty array on error
  }
}