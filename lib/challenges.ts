      
// lib/challenges.ts

import OpenAI from 'openai';

export interface ChallengeData {
    id: string; // Or maybe the date itself is the ID
    date: string; // YYYY-MM-DD
    difficulty: 'medium'; // As specified
    question: string; // The problem description
    questionTitle: string,
    inputOutput: {
      input: string;
      output: string;
    };
    solution: string; // The Python code solution
    explanation: string; // Explanation of the solution
    // Any other relevant fields your API provides
  }

// Ensure your API key is loaded correctly from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the expected JSON structure for the AI response
const desiredJsonStructure = `{
  "id": "string (use the date YYYY-MM-DD)",
  "date": "string (the requested date YYYY-MM-DD)",
  "difficulty": "medium",
  "question": "string (the problem description, about data structures and algorithms, as well as coding interview style questions)",
  "questionTitle": "string (a condensed title for the question)",
  "inputOutput": {
    "input": "string (a sample input)",
    "output": "string (the corresponding sample output)"
  },
  "solution": "string (a correct Python code solution)",
  "explanation": "string (a clear explanation of the Python solution)"
}`;

export async function getChallengeDataForDate(date: string): Promise<ChallengeData | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable not set.");
    return null;
  }

  console.log(`Requesting challenge data from OpenAI for date: ${date}`);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use the specified model
      messages: [
        {
          role: "system",
          content: `You are an assistant that generates daily Python coding challenges focused on data structures and algorithms, as well as coding interview style questions. You always respond with ONLY a valid JSON object matching this structure: ${desiredJsonStructure}. Do not include any introductory text, markdown formatting (like \`\`\`json), or explanations outside the JSON structure itself. The challenge difficulty must be 'medium'.`
        },
        {
          role: "user",
          content: `Generate the Python coding challenge for the date: ${date}. Ensure the 'id' and 'date' fields in the JSON match this date.`
        },
      ],
      temperature: 0.6, // Adjust for creativity vs consistency (0.5-0.8 is reasonable)
      max_tokens: 1500, // Adjust based on expected response length
      response_format: { type: "json_object" } // Use JSON mode if available and suitable for the model
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
      console.error("Raw OpenAI response content:", content); // Log the raw response for debugging
      return null;
    }

    // Basic validation - check required fields
    if (
        !parsedData.question ||
        !parsedData.questionTitle ||
        !parsedData.inputOutput?.input ||
        !parsedData.inputOutput?.output ||
        !parsedData.solution ||
        !parsedData.explanation ||
        parsedData.difficulty !== 'medium' ||
        parsedData.date !== date // Ensure date matches request
    ) {
        console.error(`Invalid or incomplete data structure received from OpenAI for date ${date}:`, parsedData);
        return null;
    }

    // If validation passes, cast to the full ChallengeData type
    // We construct the final object to ensure all fields are present
    const challengeData: ChallengeData = {
        id: date, // Use date as ID or generate one if needed
        date: parsedData.date,
        difficulty: parsedData.difficulty,
        question: parsedData.question,
        questionTitle: parsedData.questionTitle,
        inputOutput: {
            input: parsedData.inputOutput.input,
            output: parsedData.inputOutput.output,
        },
        solution: parsedData.solution,
        explanation: parsedData.explanation,
    };

    console.log(`Successfully generated and parsed challenge for ${date}`);
    return challengeData;

  } catch (error) {
    if (error instanceof OpenAI.APIError) {
        console.error(`OpenAI API Error for date ${date}: ${error.status} ${error.name}`, error.message);
    } else {
        console.error(`Error fetching challenge data from OpenAI for date ${date}:`, error);
    }
    return null;
  }
}



    