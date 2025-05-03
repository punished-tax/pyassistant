// lib/challenges.ts

import OpenAI from 'openai';

// 1. Update the ChallengeData Interface
export interface ChallengeData {
  id: string;
  date: string; // YYYY-MM-DD
  difficulty: 'medium';
  question: string;
  questionTitle: string;
  inputOutput: { // The main example shown to the user
    input: string;
    output: string;
  };
  solutionHeader: string; // <<< Added: The function signature (e.g., "def solve(nums: list[int]) -> int:")
  solution: string;       // The full Python code solution
  explanation: string;
  testCases: Array<{      // <<< Added: Array for test cases
    input: string;
    output: string;
  }>;
}

// Ensure your API key is loaded correctly from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. Define the *NEW* expected JSON structure for the AI response
//    Includes solutionHeader and testCases array
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
  "solutionHeader": "string (The Python function signature needed for the solution, the function HAS to be named 'solve')
",
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
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable not set.");
    return null;
  }

  console.log(`Requesting challenge data from OpenAI for date: ${date}`);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Or "gpt-4o" if mini struggles with the larger structure
      messages: [
        {
          role: "system",
          // 3. Update the System Prompt to reflect the new structure
          content: `You are an assistant that generates daily Python coding challenges (difficulty: medium) about lists, strings, or more advanced data structures. You ALWAYS respond with ONLY a valid JSON object matching this exact structure: ${desiredJsonStructure}. Do not include any introductory text, markdown formatting (like \`\`\`json), comments, or explanations outside the JSON structure itself. The 'solutionHeader' must accurately define the function signature used in the 'solution'. Always use standard Python type hints. For lists use list[type], for dictionaries use dict[key_type, value_type]. Do NOT use capitalized List, Dict, etc. unless imported from the typing module. Provide exactly 5 distinct 'testCases' in the specified array format, ensuring inputs and outputs are valid Python literal representations where applicable (e.g., lists, strings, numbers). The main 'inputOutput' example should be different from the 'testCases'.`
        },
        {
          role: "user",
          content: `Generate the Python coding challenge for the date: ${date}. Ensure the 'id' and 'date' fields in the JSON match this date. Provide 5 distinct test cases in addition to the main example.`
        },
      ],
      temperature: 0.6,
      max_tokens: 2500, // <<< Increased max_tokens significantly due to more examples and stricter structure
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      console.error(`OpenAI response content is empty for date: ${date}`);
      return null;
    }

    // --- Parse and Validate the Response ---
    let parsedData: Partial<ChallengeData>; // Use Partial initially
    try {
      parsedData = JSON.parse(content);
    } catch (parseError) {
      console.error(`Failed to parse JSON response from OpenAI for date ${date}:`, parseError);
      console.error("Raw OpenAI response content:", content);
      return null;
    }

    // 4. Update Validation - Check required fields including the new ones
    const isValidTestCase = (tc: any): tc is { input: string; output: string } =>
        tc && typeof tc.input === 'string' && typeof tc.output === 'string';

    if (
        !parsedData.question ||
        !parsedData.questionTitle ||
        !parsedData.inputOutput?.input ||
        !parsedData.inputOutput?.output ||
        !parsedData.solutionHeader || // <<< Check new field
        !parsedData.solution ||
        !parsedData.explanation ||
        !parsedData.testCases || // <<< Check new field
        !Array.isArray(parsedData.testCases) || // <<< Check it's an array
        parsedData.testCases.length !== 5 || // <<< Check for exactly 5 test cases
        !parsedData.testCases.every(isValidTestCase) || // <<< Check each test case structure
        parsedData.difficulty !== 'medium' ||
        parsedData.date !== date
    ) {
        console.error(`Invalid or incomplete data structure received from OpenAI for date ${date}. Validation failed.`);
        // Log the specific part that might be failing:
        if (!parsedData.testCases) console.error("-> Missing testCases field.");
        else if (!Array.isArray(parsedData.testCases)) console.error("-> testCases is not an array.");
        else if (parsedData.testCases.length !== 5) console.error(`-> Expected 5 test cases, got ${parsedData.testCases.length}.`);
        else if (!parsedData.testCases.every(isValidTestCase)) console.error("-> One or more test cases have invalid structure (missing input/output string).");
        if (!parsedData.solutionHeader) console.error("-> Missing solutionHeader field.");
        // Log the received data for deeper inspection
        console.error("Received data:", JSON.stringify(parsedData, null, 2)); // Pretty print the received JSON
        return null;
    }

    // 5. Update Result Construction - Include new fields
    // If validation passes, we can be more confident in casting to the full ChallengeData type
    const challengeData: ChallengeData = {
        id: date,
        date: parsedData.date,
        difficulty: parsedData.difficulty,
        question: parsedData.question,
        questionTitle: parsedData.questionTitle,
        inputOutput: {
            input: parsedData.inputOutput.input,
            output: parsedData.inputOutput.output,
        },
        solutionHeader: parsedData.solutionHeader as string, // Cast validated field
        solution: parsedData.solution,
        explanation: parsedData.explanation,
        testCases: parsedData.testCases as Array<{ input: string; output: string }>, // Cast validated field
    };

    console.log(`Successfully generated and parsed challenge for ${date} with header and test cases.`);
    return challengeData;

  } catch (error) {
    if (error instanceof OpenAI.APIError) {
        console.error(`OpenAI API Error for date ${date}: ${error.status} ${error.name}`, error.message);
         // Log response body if available in error 
         
    } else {
        console.error(`Error fetching challenge data from OpenAI for date ${date}:`, error);
    }
    return null;
  }
}