// route.ts
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, CoreMessage } from 'ai'; // Import actual part types later

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

    // Get the reader ONCE
    const reader = sourceStream.getReader();
    console.log(`[${timestamp}] Successfully obtained THE reader from fullStream.`);

    const encoder = new TextEncoder();
    const transformStream = new TransformStream<any, Uint8Array>({
      start() { console.log(`[${timestamp}] TransformStream started.`); },
      async transform(chunk, controller) {
        // CRUCIAL LOG - to see the parts that make it here
        console.log(`[${timestamp}] TransformStream: Transforming chunk (type: ${chunk?.type}):`, chunk);
        try {
          if (chunk && typeof chunk.type === 'string') {
            switch (chunk.type) {
              case 'step-start': // From your log
                // You might want to log this or decide if it needs to go to client
                console.log(`[${timestamp}] Transform: step-start received. Content:`, (chunk as any).messageId, (chunk as any).request);
                // Example: forward as a custom data message if your client handles '9:'
                // controller.enqueue(encoder.encode(`9:${JSON.stringify({type: 'step-start', data: chunk})}\n`));
                break;
              case 'text-delta':
                controller.enqueue(encoder.encode(`0:"${JSON.stringify((chunk as any).textDelta || (chunk as any).value).slice(1, -1)}"\n`));
                break;
              case 'error':
                console.error(`[${timestamp}] Transform: Stream error part:`, (chunk as any).error);
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
              // Add other cases based on the types you see in the "Transforming chunk" log
              default:
                console.warn(`[${timestamp}] Transform: Unhandled stream part type: ${chunk.type}`, chunk);
                break;
            }
          } else { console.warn(`[${timestamp}] Transform: Received chunk without type or null/undefined:`, chunk); }
        } catch (e: any) { console.error(`[${timestamp}] Transform: Error: ${e.message}`, e); controller.error(e); }
      },
      flush() { console.log(`[${timestamp}] TransformStream flushed.`); }
    });
    console.log(`[${timestamp}] TransformStream created. Setting up piping IIFE.`);

    // Piping IIFE - uses the SINGLE reader obtained above
    (async () => {
      const writer = transformStream.writable.getWriter();
      console.log(`[${timestamp}] Piping IIFE: Using THE reader. Starting read loop.`);
      try {
        while (true) {
          // Use THE reader
          const { done, value: part } = await reader.read();
          if (done) {
            console.log(`[${timestamp}] Piping IIFE: Reader reported 'done'.`);
            break;
          }
          // This log is now very important!
          console.log(`[${timestamp}] Piping IIFE: Read part, writing to transform: `, part);
          writer.write(part);
        }
        console.log(`[${timestamp}] Piping IIFE: Loop finished. Closing writer.`);
        await writer.close();
      } catch (e: any) {
        console.error(`[${timestamp}] Piping IIFE: Error in read loop: ${e.message}`, e);
        // Don't releaseLock here, reader.read() throwing should handle it,
        // or the stream is now broken. The reader becomes useless.
        if (writer.desiredSize !== null) {
          try { await writer.abort(e); } catch (ae) { console.error("Error aborting writer:", ae); }
        }
      } finally {
        console.log(`[${timestamp}] Piping IIFE: Exited read loop processing. Releasing THE reader's lock.`);
        // Always release the lock for THE reader when done with it.
        reader.releaseLock();
      }
    })();
    console.log(`[${timestamp}] Piping setup complete. Returning Response.`);

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