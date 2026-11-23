// Live engine: Claude with tool use. Runs only on the server.
//
// The model never executes anything that changes an account. Write tools
// return a ProposedAction; `decide()` in tools.ts applies the operator's
// autonomy settings, and the model is told the outcome in the tool result.

import Anthropic from "@anthropic-ai/sdk";
import { CUSTOMERS, PLANS } from "./data";
import { runTool, type ToolContext } from "./tools";
import type { ChatRequest, StreamEvent } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_STEPS = 8;

const str = (description: string) => ({ type: "string" as const, description });

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_customer",
    description:
      "Customer profile: plan, home area, add-ons, and actions already executed in this session.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_invoices",
    description: "The customer's recent invoices with line items.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_usage",
    description:
      "The customer's usage records (data, calls, roaming) and service SMS sent to them.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_incidents",
    description: "Confirmed network incidents in the customer's home area.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_policies",
    description:
      "Search company policies (roaming, goodwill credits, outage compensation, plan changes).",
    input_schema: {
      type: "object",
      properties: {
        query: str("Plain-language search, e.g. 'outage compensation'."),
      },
      required: ["query"],
    },
  },
  {
    name: "list_plans",
    description: "Plan catalogue and roaming packs with prices.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "issue_credit",
    description:
      "Propose a credit on the customer's next invoice. Only when a policy allows it. The operator's settings decide whether it executes now, waits for confirmation, or is blocked.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Whole hryvnias, 1–500." },
        reason: str(
          "One or two sentences with citation tokens, shown to the operator.",
        ),
        policy_ref: str("Policy and section, e.g. 'POL-OUTAGE-01 §2'."),
      },
      required: ["amount", "reason", "policy_ref"],
    },
  },
  {
    name: "change_plan",
    description:
      "Propose moving the customer to another plan from the next billing cycle. Only after the customer's needs are clear.",
    input_schema: {
      type: "object",
      properties: {
        plan_id: str(`One of: ${Object.keys(PLANS).join(", ")}.`),
        reason: str("One or two sentences with citation tokens."),
      },
      required: ["plan_id", "reason"],
    },
  },
  {
    name: "add_roaming_pack",
    description: "Propose adding a paid roaming pack.",
    input_schema: {
      type: "object",
      properties: {
        pack_id: str("PCK-EU7 or PCK-EU30."),
        reason: str("One or two sentences with citation tokens."),
      },
      required: ["pack_id", "reason"],
    },
  },
  {
    name: "send_sms",
    description: "Propose an SMS to the customer in the operator's name.",
    input_schema: {
      type: "object",
      properties: {
        text: str("The SMS, up to 300 characters, plain and polite."),
        reason: str("Why it should be sent."),
      },
      required: ["text", "reason"],
    },
  },
];

function systemPrompt(customerId: string) {
  const c = CUSTOMERS.find((x) => x.id === customerId)!;
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `You assist a customer-care operator at Northline Mobile, a mobile operator in Ukraine. All data is fictional demo data.
Today is ${today}. The operator is on a call with ${c.name} (${c.id}). Every tool reads or acts on this customer only.

How to answer
- Read the data with tools before answering. Do not narrate tool use; answer once you have the facts.
- Every figure, date and policy rule you state must carry a citation token right after it: [[RECORD_ID]] or [[RECORD_ID#LINE]], using the ids and "cite" values exactly as tools return them. Never cite anything a tool did not return.
- If the data does not answer the question, say what is missing and what the operator should ask the customer. Never guess figures.
- Write for the operator, not the customer: plain sentences, short paragraphs, at most about 150 words. No headings, no bullet lists, no bold. UK English, ₴ for hryvnias.

Actions
- Reading data is always allowed. Credits, plan changes, packs and SMS are proposals: call the tool, and the operator's autonomy settings decide what happens.
- The tool result tells you the outcome. "executed": say it was applied automatically within the operator's settings. "pending_operator_confirmation": say it is prepared and waits for the operator; never say it is done. "blocked": say the operator must do it manually; do not retry.
- Only propose what a policy allows, with the amount worked out from the policy. Do not propose an action that is already pending or executed in this conversation.
- If a decision depends on something the data cannot tell you, ask before proposing.
- Messages starting with [Operator] are the operator's decisions on earlier proposals. Treat them as final.

Stay on this customer's account. For anything else, say briefly that this assistant only covers the account on screen.`;
}

export const hasLiveModel = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function* liveEngine(
  req: ChatRequest,
): AsyncGenerator<StreamEvent> {
  yield { type: "mode", mode: "live" };
  const client = new Anthropic();

  let n = 0;
  const ctx: ToolContext = {
    customerId: req.customerId,
    autonomy: req.autonomy,
    ledger: req.ledger,
    now: () => new Date().toISOString(),
    newId: () => `A-${Date.now().toString(36)}-${++n}`,
  };

  const messages: Anthropic.MessageParam[] = req.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1200,
      system: systemPrompt(req.customerId),
      tools: TOOLS,
      messages,
    });

    let wroteText = false;
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        wroteText = true;
        yield { type: "text", delta: ev.delta.text };
      }
    }
    const final = await stream.finalMessage();
    messages.push({ role: "assistant", content: final.content });

    if (final.stop_reason !== "tool_use") break;

    // Separate any text written before tool calls from the next block of text.
    if (wroteText) yield { type: "text", delta: "\n\n" };

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      const out = runTool(
        block.name,
        ctx,
        (block.input ?? {}) as Record<string, unknown>,
      );
      yield {
        type: "tool",
        name: block.name,
        label: out.label,
        sources: out.sources,
      };
      if (out.action) yield { type: "action", action: out.action };
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(out.result),
      });
    }
    messages.push({ role: "user", content: results });
  }

  yield { type: "done" };
}
