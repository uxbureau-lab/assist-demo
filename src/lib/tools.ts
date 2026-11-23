// Tools the assistant can use. The same executors serve the scripted
// engine and the live Claude engine, so both behave identically.
//
// Read tools always run. Write tools never run directly: they become a
// ProposedAction, and `decide()` sets whether it executes now, waits for
// the operator, or is blocked.

import { decide } from "./autonomy";
import { CUSTOMERS, PACKS, PLANS, RECORDS, recordById, uah } from "./data";
import type {
  ActionType,
  AutonomySettings,
  Ledger,
  ProposedAction,
  SourceRecord,
} from "./types";

export interface ToolContext {
  customerId: string;
  autonomy: AutonomySettings;
  ledger: Ledger;
  now: () => string;
  newId: () => string;
}

export interface ToolOutcome {
  /** Short line for the operator, e.g. "Read invoices". */
  label: string;
  sources: string[];
  /** What the model sees. */
  result: unknown;
  action?: ProposedAction;
}

const compact = (r: SourceRecord) => ({
  id: r.id,
  title: r.title,
  date: r.date,
  fields: Object.fromEntries(r.fields),
  lines: r.lines?.map((l) => ({ cite: `${r.id}#${l.id}`, ...l })),
  body: r.body,
});

const executed = (ledger: Ledger, customerId: string) =>
  ledger.filter(
    (a) =>
      a.customerId === customerId &&
      (a.status === "auto" || a.status === "confirmed"),
  );

// ── Read tools ────────────────────────────────────────────────

function getCustomer(ctx: ToolContext): ToolOutcome {
  const c = CUSTOMERS.find((x) => x.id === ctx.customerId)!;
  const plan = PLANS[c.planId];
  const done = executed(ctx.ledger, c.id);
  return {
    label: "Read customer profile",
    sources: [c.id, c.planId],
    result: {
      id: c.id,
      name: c.name,
      plan: { id: c.planId, ...plan },
      customerSince: c.since,
      homeArea: c.homeArea,
      addOns: c.addOns,
      actionsAlreadyExecutedThisSession: done.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
      })),
    },
  };
}

function getInvoices(ctx: ToolContext): ToolOutcome {
  const rows = RECORDS.filter(
    (r) => r.kind === "invoice" && r.customerId === ctx.customerId,
  );
  return {
    label: `Read ${rows.length} invoice${rows.length === 1 ? "" : "s"}`,
    sources: rows.map((r) => r.id),
    result: rows.map(compact),
  };
}

function getUsage(ctx: ToolContext): ToolOutcome {
  const rows = RECORDS.filter(
    (r) =>
      (r.kind === "usage" || r.kind === "sms") &&
      r.customerId === ctx.customerId,
  );
  return {
    label: "Read usage and notifications",
    sources: rows.map((r) => r.id),
    result: rows.map(compact),
  };
}

function getIncidents(ctx: ToolContext): ToolOutcome {
  const c = CUSTOMERS.find((x) => x.id === ctx.customerId)!;
  const rows = RECORDS.filter(
    (r) =>
      r.kind === "incident" &&
      r.fields.some(([k, v]) => k === "Area" && v === c.homeArea),
  );
  return {
    label: rows.length
      ? `Found ${rows.length} outage in ${c.homeArea}`
      : `No outages in ${c.homeArea}`,
    sources: rows.map((r) => r.id),
    result: { homeArea: c.homeArea, incidents: rows.map(compact) },
  };
}

function searchPolicies(query: string): ToolOutcome {
  const q = query.toLowerCase();
  const words = q.split(/\W+/).filter((w) => w.length > 3);
  const policies = RECORDS.filter((r) => r.kind === "policy");
  const hits = policies.filter((p) => {
    const text = [p.title, ...(p.lines ?? []).map((l) => l.value)]
      .join(" ")
      .toLowerCase();
    return words.some((w) => text.includes(w));
  });
  const rows = hits.length ? hits : policies;
  return {
    label: `Searched policies: “${query}”`,
    sources: rows.map((r) => r.id),
    result: rows.map(compact),
  };
}

function listPlans(): ToolOutcome {
  return {
    label: "Read plan catalogue",
    sources: Object.keys(PLANS),
    result: {
      plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })),
      roamingPacks: Object.entries(PACKS).map(([id, p]) => ({ id, ...p })),
    },
  };
}

// ── Write tools → proposed actions ────────────────────────────

function propose(
  ctx: ToolContext,
  type: ActionType,
  title: string,
  impact: string[],
  rationale: string,
  params: ProposedAction["params"],
): ToolOutcome {
  const draft = { type, params };
  const mode = decide(draft, ctx.autonomy);
  const action: ProposedAction = {
    id: ctx.newId(),
    type,
    customerId: ctx.customerId,
    title,
    impact,
    rationale,
    params,
    status: mode === "auto" ? "auto" : mode === "ask" ? "pending" : "blocked",
    createdAt: ctx.now(),
    decidedAt: mode === "auto" || mode === "off" ? ctx.now() : undefined,
  };
  const result =
    mode === "auto"
      ? {
          status: "executed",
          actionId: action.id,
          note: "Executed automatically under the operator's autonomy settings.",
        }
      : mode === "ask"
        ? {
            status: "pending_operator_confirmation",
            actionId: action.id,
            note: "Not executed. The operator sees a confirmation card. Do not say it is done.",
          }
        : {
            status: "blocked",
            note: "This action type is switched off by the operator. Do not retry. Tell the operator it must be done manually.",
          };
  return {
    label:
      mode === "auto"
        ? `Executed: ${title}`
        : mode === "ask"
          ? `Prepared for confirmation: ${title}`
          : `Blocked by settings: ${title}`,
    sources: [],
    result,
    action,
  };
}

class ToolInputError extends Error {}

function issueCredit(
  ctx: ToolContext,
  input: { amount: number; reason: string; policy_ref: string },
): ToolOutcome {
  const amount = Math.round(Number(input.amount));
  if (!(amount > 0 && amount <= 500))
    throw new ToolInputError("Credit must be between ₴1 and ₴500.");
  return propose(
    ctx,
    "credit",
    `Credit ${uah(amount)}`,
    [`${uah(amount)} off the next invoice`, `Reference: ${input.policy_ref}`],
    input.reason,
    { amount, policy: input.policy_ref },
  );
}

function changePlan(
  ctx: ToolContext,
  input: { plan_id: string; reason: string },
): ToolOutcome {
  const c = CUSTOMERS.find((x) => x.id === ctx.customerId)!;
  const from = PLANS[c.planId];
  const to = PLANS[input.plan_id];
  if (!to) throw new ToolInputError(`Unknown plan ${input.plan_id}.`);
  if (input.plan_id === c.planId)
    throw new ToolInputError("Customer is already on this plan.");
  const impact = [
    `${from.name} → ${to.name}, from 1 Dec 2026`,
    `Monthly fee ${uah(from.fee)} → ${uah(to.fee)}`,
  ];
  if (
    c.addOns.some((a) => a.startsWith("Family share")) &&
    input.plan_id !== "PLN-MAX-600"
  )
    impact.push("Family share ends; second SIM moves to Light 150 at ₴150");
  return propose(
    ctx,
    "plan_change",
    `Change plan to ${to.name}`,
    impact,
    input.reason,
    { from: c.planId, to: input.plan_id, effective: "2026-12-01" },
  );
}

function addPack(
  ctx: ToolContext,
  input: { pack_id: string; reason: string },
): ToolOutcome {
  const p = PACKS[input.pack_id];
  if (!p) throw new ToolInputError(`Unknown pack ${input.pack_id}.`);
  return propose(
    ctx,
    "add_on",
    `Add ${p.name}`,
    [`${p.detail}`, `${uah(p.price)} charged now`],
    input.reason,
    { pack: input.pack_id, price: p.price },
  );
}

function sendSms(
  ctx: ToolContext,
  input: { text: string; reason: string },
): ToolOutcome {
  const text = String(input.text ?? "").trim();
  if (!text || text.length > 300)
    throw new ToolInputError("SMS text must be 1–300 characters.");
  return propose(
    ctx,
    "message",
    "Send SMS to the customer",
    [`“${text}”`],
    input.reason,
    { text },
  );
}

// ── Registry ─────────────────────────────────────────────────

type Runner = (ctx: ToolContext, input: Record<string, unknown>) => ToolOutcome;

export const RUNNERS: Record<string, Runner> = {
  get_customer: (ctx) => getCustomer(ctx),
  get_invoices: (ctx) => getInvoices(ctx),
  get_usage: (ctx) => getUsage(ctx),
  get_incidents: (ctx) => getIncidents(ctx),
  search_policies: (_ctx, i) => searchPolicies(String(i.query ?? "")),
  list_plans: () => listPlans(),
  issue_credit: (ctx, i) =>
    issueCredit(ctx, i as Parameters<typeof issueCredit>[1]),
  change_plan: (ctx, i) =>
    changePlan(ctx, i as Parameters<typeof changePlan>[1]),
  add_roaming_pack: (ctx, i) =>
    addPack(ctx, i as Parameters<typeof addPack>[1]),
  send_sms: (ctx, i) => sendSms(ctx, i as Parameters<typeof sendSms>[1]),
};

export function runTool(
  name: string,
  ctx: ToolContext,
  input: Record<string, unknown>,
): ToolOutcome {
  const run = RUNNERS[name];
  if (!run)
    return {
      label: `Unknown tool ${name}`,
      sources: [],
      result: { error: "Unknown tool" },
    };
  try {
    return run(ctx, input);
  } catch (e) {
    if (e instanceof ToolInputError)
      return {
        label: `Rejected input for ${name}`,
        sources: [],
        result: { error: e.message },
      };
    throw e;
  }
}

export { recordById };
