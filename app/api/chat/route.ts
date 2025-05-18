// route.ts
import { createOpenAI } from '@ai-sdk/openai';
// We'll let TypeScript infer the 'part' type within the loop first,
// then refine if necessary.
import {
  streamText,
  CoreMessage,
  // TextStreamPart, // We'll see if this is TextStreamPart<string> or something else
} from 'ai';

// We might not need to define ExpectedStreamPart explicitly if TypeScript
// can infer 'part' correctly from the iterableStream.

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
      // ... (error handling)
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

    // CRUCIAL LOG: This will tell us what properties are on streamResultObject
    console.log(`[${timestamp}] streamText call completed successfully. streamResultObject keys: ${Object.keys(streamResultObject).join(', ')}`);
    console.log(`[${timestamp}] Preparing data stream response manually.`);

    const encoder = new TextEncoder();
    // For TransformStream, input type is `any` for now, to let the switch handle it.
    // Output is Uint8Array.
    const transformStream = new TransformStream<any, Uint8Array>({
      async transform(chunk, controller) { // chunk is 'any' for now
        // console.log(`[${timestamp}] Transforming chunk (type: ${chunk.type}):`, chunk);
        // The 'type' property is standard for AI SDK stream parts.
        switch (chunk.type) {
          case 'text-delta':
            // Assuming chunk.textDelta is the property for text content.
            // If TextStreamPart is generic, chunk would be TextStreamPart<string>
            // and chunk.textDelta would be a string.
            // If your SDK version uses 'value' for text-delta, adjust accordingly.
            controller.enqueue(encoder.encode(`0:"${JSON.stringify((chunk as { textDelta: string }).textDelta).slice(1, -1)}"\n`));
            break;
          case 'error':
            // Assuming chunk.error is the property.
            console.error(`[${timestamp}] Stream error part:`, (chunk as { error: any }).error);
            controller.enqueue(encoder.encode(`1:"${JSON.stringify(String((chunk as { error: any }).error)).slice(1,-1)}"\n`));
            break;
          case 'finish':
            // Assuming chunk.finishReason and chunk.usage.
            const finishChunk = chunk as { finishReason: string; usage: object; logprobs?: any };
            if (finishChunk.finishReason && finishChunk.usage) {
              const finishData = {
                finishReason: finishChunk.finishReason,
                usage: finishChunk.usage,
                // logprobs: finishChunk.logprobs,
              };
              controller.enqueue(encoder.encode(`2:${JSON.stringify(finishData)}\n`));
            } else if (finishChunk.finishReason) {
                 controller.enqueue(encoder.encode(`2:${JSON.stringify({ finishReason: finishChunk.finishReason })}\n`));
            }
            break;
          // case 'data': // For arbitrary JSON data payloads
          //   controller.enqueue(encoder.encode(`8:${JSON.stringify((chunk as { data: any }).data)}\n`));
          //   break;
          // Add other cases like 'tool-call', 'tool-result' if needed,
          // with appropriate property access, e.g., chunk.toolCall, chunk.toolResult
          default:
            // console.warn(`[${timestamp}] Unhandled stream part type: ${chunk.type}`);
            break;
        }
      },
      flush(controller) {
        console.log(`[${timestamp}] Transform stream flushed.`);
      }
    });

    // This is still the primary suspect for the async iterable stream
    const iterableStream = streamResultObject.fullStream;

    // Defensive check for the async iterable property
    if (!iterableStream || typeof iterableStream[Symbol.asyncIterator] !== 'function') {
        console.error(`[${timestamp}] streamResultObject.fullStream is NOT an async iterable. streamResultObject keys: ${Object.keys(streamResultObject).join(', ')}`);
        // If fullStream exists but isn't iterable, what is it?
        if (streamResultObject.fullStream) {
            console.log(`[${timestamp}] typeof streamResultObject.fullStream: ${typeof streamResultObject.fullStream}`);
            console.log(`[${timestamp}] value of streamResultObject.fullStream:`, streamResultObject.fullStream);
        }
        throw new Error('streamResultObject.fullStream is not behaving as an async iterable as expected.');
    }

    // Pipe the AI SDK stream through our transform stream
    (async () => {
      const writer = transformStream.writable.getWriter();
      try {
        // 'part' will be inferred by TypeScript here.
        // Hover over 'part' in your IDE to see its inferred type.
        for await (const part of iterableStream) {
          writer.write(part);
        }
      } catch (e) {
        console.error(`[${timestamp}] Error reading from AI SDK stream (fullStream) and writing to transformStream:`, e);
        await writer.abort(e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(transformStream.readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });


  } catch (error: any) {
    console.error(`[${timestamp}] Critical error in chatbot POST handler:`, error);
    if (error.name) console.error(`[${timestamp}] Error Name: ${error.name}`);
    if (error.message) console.error(`[${timestamp}] Error Message: ${error.message}`);
    // ... (rest of your error logging)
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