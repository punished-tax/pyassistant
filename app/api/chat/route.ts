import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Allow responses up to 5 minutes
export const maxDuration = 300;

export const runtime = 'edge'

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages,
  });

  return result.toDataStreamResponse();
}