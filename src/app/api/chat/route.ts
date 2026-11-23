import { CUSTOMERS } from "@/lib/data";
import { scriptedEngine } from "@/lib/scripted-engine";
import type { ChatRequest, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TURNS = 24;

function invalid(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return invalid("Body must be JSON.");
  }
  if (!CUSTOMERS.some((c) => c.id === body.customerId))
    return invalid("Unknown customer.");
  if (!Array.isArray(body.messages) || body.messages.length === 0)
    return invalid("No messages.");
  if (body.messages.length > MAX_TURNS)
    return invalid(
      "This demo conversation is long enough. Reset it to continue.",
    );

  const engine = scriptedEngine(body);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const event of engine) send(event);
      } catch (e) {
        console.error(e);
        send({ type: "error", message: "The assistant failed. Try again." });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
