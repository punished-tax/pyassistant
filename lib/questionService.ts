// lib/questionService.ts
"use server";

import { Output } from 'ai';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DailyQuestion {
  question: string;
  example: { 
    input: string; 
    output: string
  }; 
  solution: string;
  explanation: string;
}

export async function getDailyQuestion(): Promise<DailyQuestion> {
  // Use date as part of the cache key to ensure daily changes
  const cacheKey = `daily-question-${new Date().toISOString().split('T')[0]}`;
  
  // Check if we have cached today's question
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  // Get new question from ChatGPT
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Generate a medium difficulty Python programming question with these requirements:
        - Focus on core Python concepts (functions, data structures, algorithms)
        - Should be solvable in 15-30 minutes by an intermediate Python developer
        - Include a sample input/output example
        - Provide a complete solution with explanation
        - Format as JSON with: question, example, solution, explanation`
      },
      {
        role: "user",
        content: "Generate today's Python question"
      }
    ],
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  
  // Cache the result
  if (typeof window !== 'undefined') {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  }

  return result;
}