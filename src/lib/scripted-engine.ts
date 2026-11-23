// Scripted engine: used when no ANTHROPIC_API_KEY is set, so the
// prototype can be reviewed end to end without a model. It calls the
// same tools as the live engine, so autonomy rules apply the same way.

import { runTool, type ToolContext } from "./tools";
import type { ChatRequest, ProposedAction, StreamEvent } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step =
  | { tool: string; input?: Record<string, unknown> }
  | { say: string | ((actions: ProposedAction[]) => string) };

interface Script {
  customerId: string;
  match: RegExp;
  steps: Step[];
}

const statusLine = (a: ProposedAction | undefined, what: string) => {
  if (!a) return "";
  if (a.status === "auto")
    return `I've applied ${what} automatically: it is within your auto-approve limit.`;
  if (a.status === "pending")
    return `I've prepared ${what} for your confirmation. Nothing changes until you confirm.`;
  if (a.status === "blocked")
    return `${what[0].toUpperCase()}${what.slice(1)} is switched off in your settings, so please apply it manually.`;
  return "";
};

const SCRIPTS: Script[] = [
  {
    customerId: "C-1001",
    match: /credit|offer|goodwill|compensat|prepare|yes/i,
    steps: [
      { tool: "search_policies", input: { query: "goodwill credit roaming" } },
      {
        tool: "issue_credit",
        input: {
          amount: 90,
          reason:
            "First roaming charge, ₴180 [[INV-1001-2026-10#L2]]. Policy allows up to 50%, capped at ₴100 [[POL-GOODWILL-01#§1]].",
          policy_ref: "POL-GOODWILL-01 §1",
        },
      },
      {
        tool: "send_sms",
        input: {
          text: "We've credited ₴90 to your next bill as a one-off for your first roaming charge. Next time, EU Travel 7 gives 5 GB for ₴120: dial *150#.",
          reason:
            "Confirms the credit in writing and prevents the same surprise next trip.",
        },
      },
      {
        say: (a) =>
          `She qualifies for a one-off goodwill credit of up to 50% of the roaming charge, capped at ₴100 [[POL-GOODWILL-01#§1]]. Half of ₴180 is ₴90.\n\n${statusLine(a[0], "the ₴90 credit")} ${a[1]?.status === "pending" ? "I've also drafted an SMS that confirms the credit and mentions the EU Travel 7 pack [[POL-ROAM-02#§3]]: for her next trip, 5 GB would cost ₴120 instead of ₴750 at pay-as-you-go rates." : ""}\n\nThis credit can be used once per 12 months [[POL-GOODWILL-01#§2]].`,
      },
    ],
  },
  {
    customerId: "C-1001",
    match: /bill|430|why|higher|invoice/i,
    steps: [
      { tool: "get_invoices" },
      { tool: "get_usage" },
      { tool: "search_policies", input: { query: "roaming charges" } },
      {
        say: "October's bill is ₴430: the usual ₴250 plan fee [[INV-1001-2026-10#L1]] plus ₴180 for roaming data in Poland [[INV-1001-2026-10#L2]].\n\nShe used 1.2 GB in Poland on 12–15 October without a roaming pack [[USG-1001-R10]], so pay-as-you-go applied at ₴150 per GB [[POL-ROAM-02#§1]]. A welcome SMS with the price and a pack offer was delivered on 12 October at 08:14 [[SMS-1001-1012]]. The charge is correct.\n\nSeptember was the plan fee only [[INV-1001-2026-09#L1]], so this is her first roaming charge. That makes her eligible for a goodwill credit [[POL-GOODWILL-01#§1]]. Shall I prepare it?",
      },
    ],
  },
  {
    customerId: "C-1002",
    match: /network|outage|days|compens|allowed|signal/i,
    steps: [
      { tool: "get_customer" },
      { tool: "get_incidents" },
      {
        tool: "search_policies",
        input: { query: "network outage compensation" },
      },
      {
        tool: "issue_credit",
        input: {
          amount: 45,
          reason:
            "Confirmed 80-hour outage in his home area [[INC-2026-1103]]. ₴450 ÷ 30 × 3 full days [[POL-OUTAGE-01#§2]].",
          policy_ref: "POL-OUTAGE-01 §2",
        },
      },
      {
        say: (a) =>
          `He's right. His home area, Rivne north district, had a confirmed outage from 3 November 06:00 to 6 November 14:00, 80 hours in total [[INC-2026-1103]]. The cause was power loss at two base stations.\n\nThat is over the 48-hour threshold [[POL-OUTAGE-01#§1]], so he gets one thirtieth of his ₴450 fee for each full day [[POL-OUTAGE-01#§2]]: 3 days × ₴15 = ₴45.\n\n${statusLine(a[0], "the ₴45 credit")}`,
      },
    ],
  },
  {
    customerId: "C-1003",
    match: /no longer|doesn.?t need|not need|drop|close|cancel/i,
    steps: [
      {
        tool: "change_plan",
        input: {
          plan_id: "PLN-SMART-250",
          reason:
            "Her own usage fits 25 GB and 300 minutes [[USG-1003-Q3]]; she confirmed she no longer needs the second SIM.",
        },
      },
      {
        say: (a) =>
          `${statusLine(a[0], "the move to Smart 250")} It starts on 1 December, with no fee [[POL-PLAN-03#§1]].\n\nCheck the card before confirming: under the policy the second SIM doesn't close by itself. It moves to Light 150 at ₴150 [[POL-PLAN-03#§2]]. If she wants it closed, that's a separate request, and I can't do it from here.`,
      },
    ],
  },
  {
    customerId: "C-1003",
    match: /cheaper|plan|fit|save|lower/i,
    steps: [
      { tool: "get_customer" },
      { tool: "get_usage" },
      { tool: "list_plans" },
      { tool: "search_policies", input: { query: "plan change family share" } },
      {
        say: "On her own SIM she uses 5–6 GB and about 210 minutes to other networks a month [[USG-1003-Q3]]. Smart 250 covers that with room to spare: 25 GB and 300 minutes [[PLN-SMART-250]]. Light 150 is too tight: 150 minutes against her 190–230 [[PLN-LIGHT-150]].\n\nOne thing I can't tell from the data: whether she still needs the second SIM. It used about 2 GB a month for the last three months [[USG-1003-Q3]]. Family share exists only on Max 600. On any other plan the second SIM moves to Light 150 at ₴150 [[POL-PLAN-03#§2]], so she'd save ₴200 a month, not ₴350.\n\nI won't prepare a plan change until that's clear. Ask her: does anyone still use the second SIM?",
      },
    ],
  },
];

async function* speak(text: string): AsyncGenerator<StreamEvent> {
  const parts = text.split(/(\s+)/);
  for (let i = 0; i < parts.length; i += 6) {
    yield { type: "text", delta: parts.slice(i, i + 6).join("") };
    await sleep(28);
  }
}

export async function* scriptedEngine(
  req: ChatRequest,
): AsyncGenerator<StreamEvent> {
  yield { type: "mode", mode: "scripted" };
  const last = [...req.messages].reverse().find((m) => m.role === "user");
  const script = SCRIPTS.find(
    (s) => s.customerId === req.customerId && s.match.test(last?.content ?? ""),
  );

  if (!script) {
    yield* speak(
      "This deployment runs in scripted mode, so I can only answer the suggested questions for each customer. With a Claude API key connected, any question about the account works.",
    );
    yield { type: "done" };
    return;
  }

  let n = 0;
  const ctx: ToolContext = {
    customerId: req.customerId,
    autonomy: req.autonomy,
    ledger: req.ledger,
    now: () => new Date().toISOString(),
    newId: () => `A-${Date.now().toString(36)}-${++n}`,
  };
  const actions: ProposedAction[] = [];

  for (const step of script.steps) {
    if ("tool" in step) {
      await sleep(350);
      const out = runTool(step.tool, ctx, step.input ?? {});
      yield {
        type: "tool",
        name: step.tool,
        label: out.label,
        sources: out.sources,
      };
      if (out.action) {
        actions.push(out.action);
        yield { type: "action", action: out.action };
      }
    } else {
      const text =
        typeof step.say === "function" ? step.say(actions) : step.say;
      yield* speak(text.replace(/ {2,}/g, " ").trim());
    }
  }
  yield { type: "done" };
}
