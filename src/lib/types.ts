// Shared types for the console, the tools and both engines.

export type RecordKind =
  | "customer"
  | "invoice"
  | "usage"
  | "policy"
  | "incident"
  | "plan"
  | "pack"
  | "sms";

export interface RecordLine {
  id: string; // e.g. "L2"
  label: string;
  value: string;
}

export interface SourceRecord {
  id: string; // e.g. "INV-1001-2026-10"
  kind: RecordKind;
  title: string;
  customerId?: string;
  date?: string;
  fields: [string, string][];
  lines?: RecordLine[];
  body?: string;
}

export type ActionType = "credit" | "plan_change" | "add_on" | "message";

export type AutonomyMode = "auto" | "ask" | "off";

export interface AutonomySetting {
  mode: AutonomyMode;
  /** Only for credits: auto-approve up to this amount (UAH). Above it, ask. */
  autoLimit?: number;
}

export type AutonomySettings = Record<ActionType, AutonomySetting>;

export type ActionStatus =
  | "pending" // waiting for the operator
  | "confirmed" // operator confirmed, executed
  | "auto" // executed without asking, within policy
  | "declined" // operator declined
  | "blocked"; // action type is switched off

export interface ProposedAction {
  id: string;
  type: ActionType;
  customerId: string;
  title: string;
  /** What changes for the customer, one line each. */
  impact: string[];
  /** Why the assistant proposes it, with citation tokens. */
  rationale: string;
  params: Record<string, string | number>;
  status: ActionStatus;
  createdAt: string;
  decidedAt?: string;
}

/** Executed actions, sent with every request so reads reflect them. */
export type Ledger = ProposedAction[];

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  customerId: string;
  messages: ChatTurn[];
  autonomy: AutonomySettings;
  ledger: Ledger;
}

/** Newline-delimited JSON events streamed by /api/chat. */
export type StreamEvent =
  | { type: "mode"; mode: "live" | "scripted" }
  | { type: "tool"; name: string; label: string; sources: string[] }
  | { type: "text"; delta: string }
  | { type: "action"; action: ProposedAction }
  | { type: "error"; message: string }
  | { type: "done" };

export type LogEntry = {
  id: string;
  at: string;
  customerId: string;
  actor: "assistant" | "operator" | "policy";
  text: string;
};
