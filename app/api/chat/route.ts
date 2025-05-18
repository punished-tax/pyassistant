// route.ts
import { createOpenAI } from '@ai-sdk/openai';
import {
  streamText,
  CoreMessage,
  // Import specific stream part types once identified from runtime logs:
  // e.g., TextStreamPart, ErrorStreamPart, FinishStreamPart
} from 'ai';

// Define this union once you see the chunk structure from logs
// type ExpectedStreamPart = TextStreamPart<string> | ErrorStreamPart | FinishStreamPart;


export const maxDuration = 300;
export const runtime = 'edge';

const workerFetch = globalThis.fetch;

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Chatbot POST request received.`);

  try {
    // ... (request parsing as before) ...
    const requestBody = await req.json();
    const { messages }: { messages: CoreMessage[] } = requestBody;

    if (!messages || !Array.isArray(messages) || messages.length === 0) { /* ... */ }

    //console.log(`[${timestamp}] Messages payload (first message content): ${messages[0]?.content.substring(0, 50)}...`);
    console.log(`[${timestamp}] Attempting to call OpenAI streamText with model gpt-4o-mini.`);

    const openaiProvider = createOpenAI({ fetch: workerFetch });
    const model = openaiProvider.chat('gpt-4o-mini');

    const streamResultObject = await streamText({ model, messages });

    console.log(`[${timestamp}] streamText call completed. streamResultObject keys: ${Object.keys(streamResultObject).join(', ')}`);
    console.log(`[${timestamp}] Preparing data stream response manually.`);

    // fullStream is a ReadableStream according to runtime logs
    const sourceStream = streamResultObject.fullStream as ReadableStream<any>; // Cast to ReadableStream<any> for now

    if (!sourceStream || typeof sourceStream.getReader !== 'function') {
        console.error(`[${timestamp}] streamResultObject.fullStream is not a valid ReadableStream.`);
        throw new Error('streamResultObject.fullStream is not a valid ReadableStream.');
    }
    console.log(`[${timestamp}] streamResultObject.fullStream is a ReadableStream. Proceeding.`);


    const encoder = new TextEncoder();
    // Input type for TransformStream can be 'any' or the specific 'ExpectedStreamPart' union
    const transformStream = new TransformStream<any, Uint8Array>({
      start() { console.log(`[${timestamp}] TransformStream started.`); },
      async transform(chunk, controller) {
        // CRUCIAL LOG: This will show the structure of 'chunk' if the reader loop works
        console.log(`[${timestamp}] Transforming chunk (type: ${chunk?.type}):`, chunk);
        try {
          if (chunk && typeof chunk.type === 'string') {
            switch (chunk.type) {
              case 'text-delta':
                // Adjust property access based on actual chunk structure logged
                controller.enqueue(encoder.encode(`0:"${JSON.stringify((chunk as any).textDelta || (chunk as any).value).slice(1, -1)}"\n`));
                break;
              case 'error':
                console.error(`[${timestamp}] Stream error part from transform:`, (chunk as any).error);
                controller.enqueue(encoder.encode(`1:"${JSON.stringify(String((chunk as any).error)).slice(1,-1)}"\n`));
                break;
              case 'finish':
                const finishChunk = chunk as any;
                if (finishChunk.finishReason && finishChunk.usage) {
                  controller.enqueue(encoder.encode(`2:${JSON.stringify({ finishReason: finishChunk.finishReason, usage: finishChunk.usage })}\n`));
                } else if (finishChunk.finishReason) {
                  controller.enqueue(encoder.encode(`2:${JSON.stringify({ finishReason: finishChunk.finishReason })}\n`));
                }
                break;
              default:
                console.warn(`[${timestamp}] Unhandled stream part type in transform: ${chunk.type}`);
                break;
            }
          } else { console.warn(`[${timestamp}] Received chunk without type:`, chunk); }
        } catch (e: any) {
          console.error(`[${timestamp}] Error during transform: ${e.message}`, e);
          controller.error(e);
        }
      },
      flush() { console.log(`[${timestamp}] TransformStream flushed.`); }
    });
    console.log(`[${timestamp}] TransformStream created. Setting up piping.`);

    // Manual Reader Loop
    (async () => {
      const writer = transformStream.writable.getWriter();
      const reader = sourceStream.getReader();

      console.log(`[${timestamp}] Obtained reader for sourceStream. Starting read loop.`);
      try {
        while (true) {
          const { done, value: part } = await reader.read();
          if (done) {
            console.log(`[${timestamp}] Stream reader reported 'done'. Breaking loop.`);
            break;
          }
          // console.log(`[${timestamp}] Read part from stream, writing to transform: `, part); // Uncomment if transform log doesn't show
          writer.write(part);
        }
        console.log(`[${timestamp}] Finished reader loop. Closing writer.`);
        await writer.close();
      } catch (e: any) {
        console.error(`[${timestamp}] Error during stream reader loop: ${e.message}`, e);
        // reader.releaseLock(); // Release lock if reader.read() throws and doesn't do it itself
        if (writer.desiredSize !== null) {
          try { await writer.abort(e); } catch (ae) { console.error("Error aborting writer:", ae); }
        }
      } finally {
          // Ensure the lock is released if the stream is prematurely exited or errored.
          // However, if the stream completes normally (done=true), or if reader.read() throws,
          // the lock might be implicitly released. Releasing an already released lock can error.
          // It's safer to call cancel on the stream or rely on the natural completion.
          // For robust error handling, you might want to reader.cancel(e) if an error occurs.
          console.log(`[${timestamp}] Exited stream reader loop processing.`);
          // If the reader is still locked and we are in finally due to an error, try to release.
          // This is tricky; often, just letting the error propagate is fine.
          // Or, if you want to ensure the stream is cancelled:
          // if (!reader.closed) { // A hypothetical check, actual API may vary
          //    await reader.cancel("Error occurred during processing");
          // }
      }
    })();
    console.log(`[${timestamp}] Piping setup. Returning Response.`);

    return new Response(transformStream.readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    });

  } catch (error: any) {
    console.error(`[${timestamp}] Critical error in POST handler: ${error.message}`, error);
    return new Response(JSON.stringify({ error: 'Failed to process request.', message: error.message || 'Unknown server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}