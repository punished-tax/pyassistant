// lib/challenges.ts
import OpenAI from 'openai';
import { kv } from '@vercel/kv'; // Import Vercel KV

// ChallengeData interface remains the same
export interface ChallengeData {
  id: string;
  date: string; // YYYY-MM-DD
  difficulty: 'medium';
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// desiredJsonStructure remains the same
const desiredJsonStructure = `{
  "id": "string (use the date YYYY-MM-DD)",
  "date": "string (the requested date YYYY-MM-DD)",
  "difficulty": "medium",
  "question": "string (the problem description, about lists, strings, or more advanced data structures)",
  "questionTitle": "string (a condensed title for the question)",
  "inputOutput": {
    "input": "string (a single, clear sample input for display)",
    "output": "string (the corresponding sample output for display)"
  },
  "solutionHeader": "string (The Python function signature needed for the solution, the function HAS to be named 'solve')",
  "solution": "string (a correct Python code solution including the 'solve' function defined by solutionHeader)",
  "explanation": "string (a clear explanation of the Python solution approach)",
  "testCases": [
    { "input": "string (input for test case 1, potentially multi-line, represent lists/dicts as Python literals)", "output": "string (expected output for test case 1, represent lists/dicts as Python literals)" },
    { "input": "string (input for test case 2)", "output": "string (expected output for test case 2)" },
    { "input": "string (input for test case 3)", "output": "string (expected output for test case 3)" },
    { "input": "string (input for test case 4)", "output": "string (expected output for test case 4)" },
    { "input": "string (input for test case 5)", "output": "string (expected output for test case 5)" }
  ]
}`;

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


// Refactored OpenAI fetch logic into its own function for retries
async function fetchAndValidateChallengeFromOpenAI(
  date: string,
  attempt: number = 1
): Promise<ChallengeData | 'duplicate_detected' | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable not set.");
    return null;
  }

  console.log(`Requesting challenge data from OpenAI for date: ${date} (Attempt: ${attempt})`);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an assistant that generates daily Python coding challenges (difficulty: medium) about lists, strings, or more advanced data structures. You ALWAYS respond with ONLY a valid JSON object matching this exact structure: ${desiredJsonStructure}. Do not include any introductory text, markdown formatting (like \`\`\`json), comments, or explanations outside the JSON structure itself. The 'solutionHeader' must accurately define the function signature used in the 'solution'. Always use standard Python type hints. For lists use list[type], for dictionaries use dict[key_type, value_type]. Do NOT use capitalized List, Dict, etc. Provide exactly 5 distinct 'testCases' in the specified array format, ensuring inputs and outputs are valid Python literal representations where applicable (e.g., lists, strings, numbers). The main 'inputOutput' example should be different from the 'testCases'. ${attempt > 1 ? 'IMPORTANT: Please generate a substantially DIFFERENT challenge than any previous attempt for this date.' : ''}`
        },
        {
          role: "user",
          content: `Generate the Python coding challenge for the date: ${date}. Ensure the 'id' and 'date' fields in the JSON match this date. Provide 5 distinct test cases in addition to the main example.`
        },
      ],
      temperature: attempt > 1 ? 0.75 : 0.6, // Slightly higher temperature on retry
      max_tokens: 2500,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error(`OpenAI response content is empty for date: ${date} (Attempt ${attempt})`);
      return null;
    }

    let parsedData: Partial<ChallengeData>;
    try {
      parsedData = JSON.parse(content);
    } catch (parseError) {
      console.error(`Failed to parse JSON response from OpenAI for date ${date} (Attempt ${attempt}):`, parseError);
      console.error("Raw OpenAI response content:", content);
      return null;
    }

    const isValidTestCase = (tc: any): tc is { input: string; output: string } =>
        tc && typeof tc.input === 'string' && typeof tc.output === 'string';

    if (
        !parsedData.question || !parsedData.questionTitle || !parsedData.inputOutput?.input ||
        !parsedData.inputOutput?.output || !parsedData.solutionHeader || !parsedData.solution ||
        !parsedData.explanation || !parsedData.testCases || !Array.isArray(parsedData.testCases) ||
        parsedData.testCases.length !== 5 || !parsedData.testCases.every(isValidTestCase) ||
        parsedData.difficulty !== 'medium' || parsedData.date !== date
    ) {
        console.error(`Invalid/incomplete data from OpenAI for date ${date} (Attempt ${attempt}). Validation failed.`);
        console.error("Received data:", JSON.stringify(parsedData, null, 2));
        return null;
    }

    // Check for duplicate hash BEFORE forming the full ChallengeData object to save a bit of work
    const questionHashesSetKey = 'meta:question_hashes';
    const normalizedNewQuestion = normalizeQuestionText(parsedData.question);
    const newQuestionHash = await generateContentHash(normalizedNewQuestion); // Await the hash generation

    try {
        const isDuplicateHash = await kv.sismember(questionHashesSetKey, newQuestionHash);
        if (isDuplicateHash) {
            console.warn(`Potential duplicate question detected via hash ${newQuestionHash} for date ${date} (Attempt ${attempt}). Question: "${parsedData.questionTitle}"`);
            return 'duplicate_detected'; // Special return value
        }
    } catch (kvError) {
        console.error(`Error checking for duplicate hash in KV for date ${date} (Attempt ${attempt}):`, kvError);
        // Decide behavior: proceed or fail? For now, let's proceed cautiously if KV check fails.
    }

    // If not a duplicate and passes validation, construct the full object
    const challengeDataFromOpenAI: ChallengeData = {
        id: date, date: parsedData.date, difficulty: parsedData.difficulty,
        question: parsedData.question, questionTitle: parsedData.questionTitle,
        inputOutput: { input: parsedData.inputOutput.input, output: parsedData.inputOutput.output },
        solutionHeader: parsedData.solutionHeader as string, solution: parsedData.solution,
        explanation: parsedData.explanation,
        testCases: parsedData.testCases as Array<{ input: string; output: string }>,
    };
    return challengeDataFromOpenAI;

  } catch (error) {
    if (error instanceof OpenAI.APIError) {
        console.error(`OpenAI API Error for date ${date} (Attempt ${attempt}): ${error.status} ${error.name}`, error.message);
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
  const availableDatesSetKey = 'meta:available_challenge_dates';
  const questionHashesSetKey = 'meta:question_hashes'; // Also needed here for storing

  // 1. Check cache first
  try {
    const cachedData = await kv.get<ChallengeData>(cacheKey);
    if (cachedData && cachedData.id === date && cachedData.question) {
      // console.log(`Serving challenge data for ${date} from Vercel KV cache.`);
      return cachedData;
    }
  } catch (error) {
    console.error(`Error fetching from Vercel KV for ${date} (key: ${cacheKey}):`, error);
  }

  // 2. Not in cache, try to fetch from OpenAI (with retry logic for duplicates)
  let fetchedChallenge: ChallengeData | 'duplicate_detected' | null = null;
  const maxAttempts = 2; // Initial attempt + 1 retry

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    fetchedChallenge = await fetchAndValidateChallengeFromOpenAI(date, attempt);

    if (fetchedChallenge === 'duplicate_detected') {
      if (attempt < maxAttempts) {
        console.log(`Duplicate detected on attempt ${attempt} for ${date}. Retrying...`);
        continue; // Go to next iteration to retry
      } else {
        console.warn(`Duplicate detected on final attempt (${attempt}) for ${date}. Giving up.`);
        return null; // Mark as null (no challenge for this date after retries)
      }
    }
    // If fetchedChallenge is a ChallengeData object (not null, not 'duplicate_detected'), break the loop
    if (fetchedChallenge) break;
    // If fetchedChallenge is null (OpenAI error, validation error), and it's not the last attempt,
    // we could retry, but for now, let's only retry for 'duplicate_detected'.
    // If it was a general error, we break and return null.
    if (!fetchedChallenge && attempt === maxAttempts) {
        console.error(`Failed to fetch challenge from OpenAI for ${date} after ${attempt} attempts (non-duplicate error).`)
        return null;
    } else if (!fetchedChallenge) { // Non-duplicate error on an earlier attempt
        console.error(`Failed to fetch challenge from OpenAI for ${date} on attempt ${attempt} (non-duplicate error). Not retrying for this type of error.`);
        return null;
    }

  }

  // 3. If successful fetch (and not a duplicate after retries)
  if (fetchedChallenge && typeof fetchedChallenge === 'object') {
    const challengeToStore = fetchedChallenge as ChallengeData; // Type assertion
    console.log(`Successfully fetched unique challenge for ${date}. Storing...`);
    try {
      // We need the hash again for storing, or pass it down from fetchAndValidateChallengeFromOpenAI
      const normalizedText = normalizeQuestionText(challengeToStore.question);
      const finalHash = await generateContentHash(normalizedText);

      await kv.set(cacheKey, challengeToStore);
      await kv.sadd(availableDatesSetKey, date);
      await kv.sadd(questionHashesSetKey, finalHash); // Store the hash of the successfully stored question
      console.log(`Stored challenge for ${date} in KV. Hash: ${finalHash}`);
      return challengeToStore;
    } catch (kvError) {
      console.error(`Error storing data in Vercel KV for date ${date}:`, kvError);
      // Return the fetched data even if KV store fails, but log it.
      // Or decide to return null if KV store is critical.
      return challengeToStore;
    }
  }

  // If all attempts failed (either all were duplicates, or other errors)
  console.log(`No challenge available for ${date} after all attempts.`);
  return null;
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
    console.error(`Error fetching available challenge dates/info from Vercel KV:`, error);
    return []; // Return empty array on error
  }
}