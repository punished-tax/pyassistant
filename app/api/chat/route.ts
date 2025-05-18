// route.ts
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, CoreMessage } from 'ai';
// We will try to infer the part type from the loop over fullStream

export const maxDuration = 300;
export const runtime = 'edge';

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

    const openaiProvider = createOpenAI({ fetch: workerFetch });
    const model = openaiProvider.chat('gpt-4o-mini');

    const streamResultObject = await streamText({
      model: model,
      messages,
    });

    console.log(`[${timestamp}] streamText call completed successfully. streamResultObject keys: ${Object.keys(streamResultObject).join(', ')}`);
    console.log(`[${timestamp}] Preparing data stream response manually.`);

    // Attempt to use fullStream again, with extensive logging
    // @ts-ignore // Temporarily ignore TS error for fullStream to see runtime behavior
    const iterableStreamCandidate = streamResultObject.fullStream;

    if (iterableStreamCandidate === undefined) {
        console.error(`[${timestamp}] streamResultObject.fullStream is UNDEFINED. This is unexpected based on SDK docs.`);
        throw new Error('streamResultObject.fullStream is undefined.');
    }

    console.log(`[${timestamp}] Value of streamResultObject.fullStream:`, iterableStreamCandidate);
    console.log(`[${timestamp}] typeof streamResultObject.fullStream: ${typeof iterableStreamCandidate}`);

    if (typeof iterableStreamCandidate[Symbol.asyncIterator] !== 'function') {
        console.error(`[${timestamp}] streamResultObject.fullStream is NOT an async iterable. Checking for getReader().`);
        if (typeof (iterableStreamCandidate as any).getReader === 'function') {
            console.log(`[${timestamp}] streamResultObject.fullStream has getReader(), suggesting it's a standard ReadableStream.`);
            // Standard ReadableStreams are async iterable in modern environments.
            // The error might be a subtle TS issue or a polyfill problem in the environment.
        } else {
            console.error(`[${timestamp}] streamResultObject.fullStream does not have getReader() either.`);
            // What else could it be? A promise for a stream?
            if (typeof (iterableStreamCandidate as any).then === 'function') {
                console.log(`[${timestamp}] streamResultObject.fullStream looks like a Promise. This is NOT expected for an already resolved stream property.`);
            }
            throw new Error('streamResultObject.fullStream is not an async iterable and not a recognizable ReadableStream.');
        }
    }
    console.log(`[${timestamp}] streamResultObject.fullStream appears to be a valid stream. Proceeding to create TransformStream.`);

    const encoder = new TextEncoder();
    const transformStream = new TransformStream<any, Uint8Array>({ // Input 'any' for now
      start() {
        console.log(`[${timestamp}] TransformStream started.`);
      },
      async transform(chunk, controller) {
        console.log(`[${timestamp}] Transforming chunk (type: ${chunk?.type}):`, chunk);
        try {
          if (chunk && typeof chunk.type === 'string') {
            switch (chunk.type) {
              case 'text-delta':
                controller.enqueue(encoder.encode(`0:"${JSON.stringify((chunk as { textDelta: string }).textDelta).slice(1, -1)}"\n`));
                break;
              case 'error':
                console.error(`[${timestamp}] Stream error part from transform:`, (chunk as { error: any }).error);
                controller.enqueue(encoder.encode(`1:"${JSON.stringify(String((chunk as { error: any }).error)).slice(1,-1)}"\n`));
                break;
              case 'finish':
                const finishChunk = chunk as { finishReason: string; usage: object; logprobs?: any };
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
          } else {
            console.warn(`[${timestamp}] Received chunk without type or null/undefined chunk:`, chunk);
          }
        } catch (e: any) {
          console.error(`[${timestamp}] Error during transform: ${e.message}`, e);
          controller.error(e);
        }
      },
      flush() {
        console.log(`[${timestamp}] TransformStream flushed.`);
      }
    });
    console.log(`[${timestamp}] TransformStream created. Setting up piping.`);

    (async () => {
      const writer = transformStream.writable.getWriter();
      try {
        console.log(`[${timestamp}] Starting to iterate over iterableStreamCandidate (fullStream).`);
        // @ts-ignore // Temporarily ignore TS error to see if it iterates at runtime
        for await (const part of iterableStreamCandidate) {
          writer.write(part);
        }
        console.log(`[${timestamp}] Finished iterating. Closing writer.`);
        await writer.close();
      } catch (e: any) {
        console.error(`[${timestamp}] Error during stream piping (fullStream): ${e.message}`, e);
        if (writer.desiredSize !== null) {
            try { await writer.abort(e); } catch (ae) { console.error("Error aborting writer:", ae); }
        }
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