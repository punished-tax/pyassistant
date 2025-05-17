// route.ts
import { createOpenAI } from '@ai-sdk/openai'; // Correct import for the provider factory
import { streamText, CoreMessage } from 'ai';

export const maxDuration = 300;
export const runtime = 'edge';

// Explicitly get the fetch from the global scope in Cloudflare Workers
// This ensures we're using the Worker's native fetch.
// globalThis is standard in modern JS environments, including Workers.
const workerFetch = globalThis.fetch;

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Chatbot POST request received.`);

  try {
    const requestBody = await req.json();
    const { messages }: { messages: CoreMessage[] } = requestBody;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.warn(`[${timestamp}] Invalid or empty messages received:`, messages);
      return new Response(JSON.stringify({ error: 'Messages are required and must be a non-empty array.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    //console.log(`[${timestamp}] Messages payload (first message content): ${messages[0]?.content.substring(0, 50)}...`);
    console.log(`[${timestamp}] Attempting to call OpenAI streamText with model gpt-4o-mini.`);

    // 1. Create an OpenAI provider instance, configured with the worker's fetch.
    //    The API key (OPENAI_API_KEY) will still be read from the environment by default.
    const openaiProvider = createOpenAI({
      fetch: workerFetch,
      // You could also explicitly pass other provider settings here if needed, e.g.:
      // apiKey: 'sk-your-key', // (though env var is better)
      // baseURL: 'custom-openai-proxy-url',
    });

    // 2. Get the specific chat model instance from the configured provider
    const model = openaiProvider.chat('gpt-4o-mini');

    // Now, use this model instance with streamText
    const result = await streamText({
      model: model,
      messages,
    });

    console.log(`[${timestamp}] streamText call completed successfully. Preparing data stream response.`);
    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error(`[${timestamp}] Critical error in chatbot POST handler:`, error);
    if (error.name) console.error(`[${timestamp}] Error Name: ${error.name}`);
    if (error.message) console.error(`[${timestamp}] Error Message: ${error.message}`);
    if (error.status) console.error(`[${timestamp}] Error Status: ${error.status}`);
    if (error.headers) console.error(`[${timestamp}] Error Headers:`, JSON.stringify(error.headers));
    if (error.error) console.error(`[${timestamp}] OpenAI Error Details:`, JSON.stringify(error.error)); // Common OpenAI error shape
    if (error.stack) console.error(`[${timestamp}] Error Stack: ${error.stack}`);

    return new Response(
      JSON.stringify({
        error: 'Failed to communicate with AI service.',
        errorMessage: error.message || 'Unknown error',
        errorDetails: error.error || error,
      }),
      {
        status: (typeof error.status === 'number' && error.status >= 400 && error.status <= 599) ? error.status : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}