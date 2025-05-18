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
    console.log(`[${timestamp}] fullStream is a ReadableStream. Attempting to get reader.`);

    let reader: ReadableStreamDefaultReader<any>;
    try {
      reader = sourceStream.getReader();
      console.log(`[${timestamp}] Successfully obtained reader from fullStream.`);
    } catch (e: any) {
      console.error(`[${timestamp}] Error calling sourceStream.getReader(): ${e.message}`, e);
      throw e; // Re-throw to be caught by outer catch
    }

    // Try one read to see if that's the issue
    // This will be done outside the main response path for now for debugging.
    // We will not pipe it yet, just see if we can read.
    try {
        console.log(`[${timestamp}] Attempting first reader.read().`);
        const { done, value: firstPart } = await reader.read();
        console.log(`[${timestamp}] First reader.read() successful. Done: ${done}, Part:`, firstPart);
        // If successful, release the lock so the stream can potentially be used later,
        // though for this test, we might just stop.
        if (!done) {
            reader.releaseLock();
            // If we were to continue, we'd need to re-get the reader or pass this part.
            // For now, just proving we can read is enough.
            // We might need to "unread" this part if we want the TransformStream to get it.
            // Or, pass 'firstPart' to the TransformStream setup if we proceed.
            console.log(`[${timestamp}] Lock released after successful first read.`);
        } else {
            console.log(`[${timestamp}] Stream was already done on first read.`);
        }
    } catch (e: any) {
        console.error(`[${timestamp}] Error during first reader.read(): ${e.message}`, e);
        try { reader.releaseLock(); } catch (rlError) { console.error("Error releasing lock after read error:", rlError); }
        throw e; // Re-throw
    }

    // If the above worked, the "Illegal invocation" is happening later,
    // likely related to TransformStream or returning its readable in the Response.
    // For now, to simplify, let's just return a dummy response if the read works.
    // If the error happens before this, we'll know it's in getReader or the first read.

    console.log(`[${timestamp}] First read test passed. Proceeding to create TransformStream and pipe.`);

    const encoder = new TextEncoder();
    const transformStream = new TransformStream<any, Uint8Array>({
      start() { console.log(`[${timestamp}] TransformStream started.`); },
      async transform(chunk, controller) {
        console.log(`[${timestamp}] Transforming chunk (type: ${chunk?.type}):`, chunk);
        // ... (transform logic as before)
        try {
          if (chunk && typeof chunk.type === 'string') {
            switch (chunk.type) {
              case 'text-delta':
                controller.enqueue(encoder.encode(`0:"${JSON.stringify((chunk as any).textDelta || (chunk as any).value).slice(1, -1)}"\n`));
                break;
              case 'error':
                console.error(`[${timestamp}] Stream error part from transform:`, (chunk as any).error);
                controller.enqueue(encoder.encode(`1:"${JSON.stringify(String((chunk as any).error)).slice(1,-1)}"\n`));
                break;
              case 'finish':
                const finishChunk = chunk as any;
                if (finishChunk.finishReason && finishChunk.usage) { /* ... */ }
                else if (finishChunk.finishReason) { /* ... */ }
                break;
              default: console.warn(`Unhandled type: ${chunk.type}`); break;
            }
          } else { console.warn(`Chunk without type:`, chunk); }
        } catch (e: any) { console.error(`Transform error: ${e.message}`, e); controller.error(e); }
      },
      flush() { console.log(`[${timestamp}] TransformStream flushed.`); }
    });
    console.log(`[${timestamp}] TransformStream created.`);

    // Re-get the reader because we released the lock, or adapt to use firstPart
    // For simplicity in this test, let's assume we'd re-get or the stream allows multiple readers (it doesn't without teeing)
    // A more correct approach would be to pass `firstPart` to the transform logic if `!done`
    // or start the piping loop immediately.
    // Let's just re-get reader for THIS TEST to keep the piping IIFE structure
    (async () => {
      let currentReader = sourceStream.getReader(); // Get a new reader
      const writer = transformStream.writable.getWriter();
      console.log(`[${timestamp}] Piping IIFE: Obtained new reader. Starting read loop.`);
      try {
        // If firstPart was read and !done, it should be written first.
        // This simplified test doesn't handle that handoff perfectly yet.
        // This loop will re-read from the beginning if the stream supports it,
        // or from where the previous lock was released.
        while (true) {
          const { done, value: part } = await currentReader.read();
          if (done) { console.log(`[${timestamp}] Piping IIFE: Reader 'done'.`); break; }
          writer.write(part);
        }
        console.log(`[${timestamp}] Piping IIFE: Loop finished. Closing writer.`);
        await writer.close();
      } catch (e: any) {
        console.error(`[${timestamp}] Piping IIFE: Error: ${e.message}`, e);
        // currentReader.releaseLock(); // Handled by reader itself or finally
        if (writer.desiredSize !== null) {
          try { await writer.abort(e); } catch (ae) { console.error("Error aborting writer:", ae); }
        }
      } finally {
        console.log(`[${timestamp}] Piping IIFE: Exited loop processing.`);
        // currentReader.releaseLock(); // Should be released if loop breaks/errors.
      }
    })();
    console.log(`[${timestamp}] Piping setup. Returning Response.`);

    return new Response(transformStream.readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    });

  } catch (error: any) {
    console.error(`[${timestamp}] Critical error in POST handler: ${error.message}`, error);
    // ... (error response)
    return new Response(JSON.stringify({ error: 'Failed to process request.', message: error.message || 'Unknown server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}