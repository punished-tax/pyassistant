// route.ts
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, CoreMessage } from 'ai';

export const maxDuration = 300;
export const runtime = 'edge';
const workerFetch = globalThis.fetch;

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Chatbot POST request received.`);

  try {
    const requestBody = await req.json();
    const { messages }: { messages: CoreMessage[] } = requestBody;
    if (!messages || !Array.isArray(messages) || messages.length === 0) { /* ... */ }

    console.log(`[${timestamp}] Attempting to call OpenAI streamText.`);
    const openaiProvider = createOpenAI({ fetch: workerFetch });
    const model = openaiProvider.chat('gpt-4o-mini');
    const streamResultObject = await streamText({ model, messages });

    console.log(`[${timestamp}] streamText call completed. Keys: ${Object.keys(streamResultObject).join(', ')}`);
    const sourceStream = streamResultObject.fullStream as ReadableStream<any>;

    if (!sourceStream || typeof sourceStream.getReader !== 'function') {
      console.error(`[${timestamp}] fullStream is not a valid ReadableStream.`);
      throw new Error('fullStream is not a valid ReadableStream.');
    }
    console.log(`[${timestamp}] fullStream is a ReadableStream.`);

    const reader = sourceStream.getReader();
    console.log(`[${timestamp}] Successfully obtained reader from fullStream.`);

    // Fire-and-forget async IIFE to read the stream and log
    // NO TransformStream, NO piping to response yet.
    (async () => {
      console.log(`[${timestamp}] DEBUG IIFE: Starting to read from sourceStream.`);
      try {
        let partCount = 0;
        while (true) {
          console.log(`[${timestamp}] DEBUG IIFE: Attempting reader.read() #${partCount + 1}`);
          const { done, value: part } = await reader.read(); // THE SUSPECTED LINE
          console.log(`[${timestamp}] DEBUG IIFE: reader.read() #${partCount + 1} successful. Done: ${done}`);

          if (done) {
            console.log(`[${timestamp}] DEBUG IIFE: Stream finished.`);
            break;
          }
          console.log(`[${timestamp}] DEBUG IIFE: Part #${partCount + 1} (type: ${part?.type}):`, part);
          partCount++;
          if (partCount >= 5) { // Limit parts for this test
            console.log(`[${timestamp}] DEBUG IIFE: Reached part limit for test. Cancelling stream.`);
            await reader.cancel("Test limit reached");
            break;
          }
        }
      } catch (e: any) {
        console.error(`[${timestamp}] DEBUG IIFE: Error during read loop: ${e.message}`, e);
      } finally {
        console.log(`[${timestamp}] DEBUG IIFE: Read loop finished/exited. Releasing lock.`);
        reader.releaseLock();
      }
    })();

    console.log(`[${timestamp}] DEBUG IIFE launched. Returning simple text response.`);
    // Return a completely unrelated, simple response
    return new Response("Test response: Stream processing started in background.", {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });

  } catch (error: any) {
    console.error(`[${timestamp}] Critical error in POST handler: ${error.message}`, error);
    return new Response(JSON.stringify({ error: 'Failed to process request.', message: error.message || 'Unknown server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}