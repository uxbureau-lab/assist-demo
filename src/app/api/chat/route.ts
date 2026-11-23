import { CUSTOMERS } from "@/lib/data";
import Anthropic from "@anthropic-ai/sdk";
import { hasLiveModel, liveEngine } from "@/lib/live-engine";
import { scriptedEngine } from "@/lib/scripted-engine";
import type { ChatRequest, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TURNS = 24;

// Best-effort guard against a public demo burning credits. Per server
// instance; the real cap is the spend limit on the API workspace.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 30;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

function explain(e: unknown) {
  if (e instanceof Anthropic.APIError) {
    if (e.status === 401)
      return "The live model is not configured correctly (API key rejected).";
    if (e.status === 429)
      return "The live model is busy. Try again in a minute.";
    if (e.status === 400 && /credit/i.test(e.message))
      return "The demo has used up its API credits for now.";
    if (e.status && e.status >= 500)
      return "The live model is unavailable right now. Try again shortly.";
  }
  return "The assistant failed. Try again.";
}

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

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (hasLiveModel() && limited(ip))
    return Response.json(
      {
        error:
          "Demo limit reached: 30 questions per 10 minutes. Try again later.",
      },
      { status: 429 },
    );

  const engine = hasLiveModel() ? liveEngine(body) : scriptedEngine(body);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const event of engine) send(event);
      } catch (e) {
        console.error(e);
        send({ type: "error", message: explain(e) });
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
