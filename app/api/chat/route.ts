// route.ts
import { openai } from '@ai-sdk/openai';
import { streamText, CoreMessage } from 'ai'; // Import CoreMessage if not already

// Allow responses up to 5 minutes
export const maxDuration = 300;

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages }: { messages: CoreMessage[] } = await req.json(); // Add type for messages

    // For debugging, you can try to log if the key is present.
    // Note: In Cloudflare Workers/Pages Functions, `process.env` might not be directly populated
    // in the same way as Node.js. The SDK handles reading it from the runtime environment.
    // If `OPENAI_API_KEY` is set correctly in Cloudflare Pages settings, the SDK should find it.
    // You can check logs in your Cloudflare dashboard (Pages -> Your Project -> Deployments -> View logs)

    console.log('Attempting to call OpenAI...');

    const result = await streamText({ // Added await here, streamText is async
      model: openai('gpt-4o-mini'), // This implicitly uses OPENAI_API_KEY from env
      messages,
    });

    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Error in OpenAI stream POST handler:', error);
    let errorMessage = 'An unknown error occurred';
    let errorDetails = {};

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = { name: error.name, stack: error.stack }; // Include stack for more details
    } else {
      errorDetails = { errorContent: String(error) };
    }

    // OpenAI API errors often have more specific information
    if (error && typeof error === 'object' && 'status' in error && 'error' in error) {
        console.error('OpenAI API Error Details:', (error as any).error);
        errorDetails = { ...errorDetails, apiError: (error as any).error };
    }


    return new Response(
      JSON.stringify({
        error: 'Failed to process request with OpenAI.',
        message: errorMessage,
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}