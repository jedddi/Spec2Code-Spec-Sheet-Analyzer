import { JsonToSseTransformStream } from "ai";

/**
 * Client-side mock for `/api/chat` UI message streams (mock AI mode).
 */
export function createMockChatResponse(assistantText: string, delayMs: number): Response {
  const messageId = crypto.randomUUID();
  const textPartId = crypto.randomUUID();

  const objectStream = new ReadableStream<Record<string, unknown>>({
    async start(controller) {
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      controller.enqueue({ type: "start", messageId });
      controller.enqueue({ type: "text-start", id: textPartId });
      controller.enqueue({
        type: "text-delta",
        id: textPartId,
        delta: assistantText,
      });
      controller.enqueue({ type: "text-end", id: textPartId });
      controller.enqueue({ type: "finish", finishReason: "stop" });
      controller.close();
    },
  });

  const sseStream = objectStream.pipeThrough(new JsonToSseTransformStream());

  return new Response(sseStream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "x-chat-sources": encodeURIComponent(JSON.stringify([])),
      "x-chat-confidence": "high",
    },
  });
}
