/**
 * Soft SSE stream for live cell updates.
 * In production this would push by prompt_id with updated_at sequence stamps.
 * Locally we keep the stream idle so tabs do not burn connections.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const hello = `event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`;
      controller.enqueue(encoder.encode(hello));

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Expose cancel hook via closure
      (controller as unknown as { _heartbeat?: ReturnType<typeof setInterval> })._heartbeat =
        heartbeat;
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
