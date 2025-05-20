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


export async function getChallengeDataForDate(date: string): Promise<ChallengeData | null> {
  // Basic validation for the date string format
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("Invalid date format provided to getChallengeDataForDate. Expected YYYY-MM-DD. Received:", date);
    return null;
  }

  const cacheKey = `challenge:${date}`; // e.g., challenge:2023-10-27
  const availableDatesSetKey = 'meta:available_challenge_dates'; // Key for the set storing all dates

  try {
    console.log(`Attempting to fetch challenge for ${date} from Vercel KV cache (key: ${cacheKey}).`);
    const cachedData = await kv.get<ChallengeData>(cacheKey);
    if (cachedData) {
      // Optional: Add a quick validation for cached data structure
      if (cachedData.id === date && cachedData.question && cachedData.solution) {
        console.log(`Serving challenge data for ${date} from Vercel KV cache.`);
        return cachedData;
      } else {
         console.warn(`Cached data for ${date} (key: ${cacheKey}) seems incomplete or mismatched. Will attempt to fetch fresh data.`);
         // Optionally, you could delete the bad cache entry: await kv.del(cacheKey);
      }
    } else {
        console.log(`No cache found for ${date} (key: ${cacheKey}) in Vercel KV.`);
    }
  } catch (error) {
    console.error(`Error fetching from Vercel KV for date ${date} (key: ${cacheKey}):`, error);
    // Continue to attempt fetch from OpenAI if KV read fails
  }

  // If not in cache or cache was invalid, fetch from OpenAI
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable not set. Cannot fetch from OpenAI.");
    return null;
  }

  console.log(`Requesting NEW challenge data from OpenAI for date: ${date}`);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an assistant that generates daily Python coding challenges (difficulty: medium) about lists, strings, or more advanced data structures. You ALWAYS respond with ONLY a valid JSON object matching this exact structure: ${desiredJsonStructure}. Do not include any introductory text, markdown formatting (like \`\`\`json), comments, or explanations outside the JSON structure itself. The 'solutionHeader' must accurately define the function signature used in the 'solution'. Always use standard Python type hints. For lists use list[type], for dictionaries use dict[key_type, value_type]. Do NOT use capitalized List, Dict, etc. unless imported from the typing module. Provide exactly 5 distinct 'testCases' in the specified array format, ensuring inputs and outputs are valid Python literal representations where applicable (e.g., lists, strings, numbers). The main 'inputOutput' example should be different from the 'testCases'.`
        },
        {
          role: "user",
          content: `Generate the Python coding challenge for the date: ${date}. Ensure the 'id' and 'date' fields in the JSON match this date. Provide 5 distinct test cases in addition to the main example.`
        },
      ],
      temperature: 0.6,
      max_tokens: 2500,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      console.error(`OpenAI response content is empty for date: ${date}`);
      return null;
    }

    let parsedData: Partial<ChallengeData>;
    try {
      parsedData = JSON.parse(content);
    } catch (parseError) {
      console.error(`Failed to parse JSON response from OpenAI for date ${date}:`, parseError);
      console.error("Raw OpenAI response content:", content);
      return null;
    }

    const isValidTestCase = (tc: any): tc is { input: string; output: string } =>
        tc && typeof tc.input === 'string' && typeof tc.output === 'string';

    // Rigorous validation, ensure date from AI matches requested date
    if (
        !parsedData.question ||
        !parsedData.questionTitle ||
        !parsedData.inputOutput?.input ||
        !parsedData.inputOutput?.output ||
        !parsedData.solutionHeader ||
        !parsedData.solution ||
        !parsedData.explanation ||
        !parsedData.testCases ||
        !Array.isArray(parsedData.testCases) ||
        parsedData.testCases.length !== 5 ||
        !parsedData.testCases.every(isValidTestCase) ||
        parsedData.difficulty !== 'medium' ||
        parsedData.date !== date // Crucial check: AI must use the requested date
    ) {
        console.error(`Invalid or incomplete data structure received from OpenAI for date ${date}. Validation failed.`);
        if (parsedData.date !== date) console.error(`-> Mismatch: Requested date ${date}, AI returned date ${parsedData.date}`);
        // (Your existing detailed logging for other fields can remain here)
        console.error("Received data from OpenAI:", JSON.stringify(parsedData, null, 2));
        return null;
    }

    const challengeDataFromOpenAI: ChallengeData = {
        id: date, // Ensure the ID is the requested date, not what AI might put if it errs
        date: parsedData.date, // This should be same as 'date' due to validation
        difficulty: parsedData.difficulty,
        question: parsedData.question,
        questionTitle: parsedData.questionTitle as string,
        inputOutput: {
            input: parsedData.inputOutput.input,
            output: parsedData.inputOutput.output,
        },
        solutionHeader: parsedData.solutionHeader as string,
        solution: parsedData.solution,
        explanation: parsedData.explanation,
        testCases: parsedData.testCases as Array<{ input: string; output: string }>,
    };

    console.log(`Successfully generated and parsed challenge for ${date} from OpenAI.`);

    // Store in Vercel KV. Items in KV don't expire by default unless specified.
    try {
      await kv.set(cacheKey, challengeDataFromOpenAI);
      console.log(`Stored challenge data for ${date} in Vercel KV (key: ${cacheKey}).`);

      // Add this date to a set of all available challenge dates for easier calendar lookup
      await kv.sadd(availableDatesSetKey, date);
      console.log(`Added ${date} to set '${availableDatesSetKey}' of available challenge dates.`);

    } catch (kvError) {
      console.error(`Error storing data or metadata in Vercel KV for date ${date}:`, kvError);
      // Don't fail the entire request if caching fails, but log it. The data will still be returned to the user this time.
    }

    return challengeDataFromOpenAI;

  } catch (error) {
    if (error instanceof OpenAI.APIError) {
        console.error(`OpenAI API Error for date ${date}: ${error.status} ${error.name}`, error.message);
    } else {
        console.error(`Error during OpenAI fetch or processing for date ${date}:`, error);
    }
    return null;
  }
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