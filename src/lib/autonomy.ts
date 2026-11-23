import type {
  ActionType,
  AutonomyMode,
  AutonomySettings,
  ProposedAction,
} from "./types";

export const ACTION_LABELS: Record<ActionType, { name: string; hint: string }> =
  {
    credit: {
      name: "Goodwill and outage credits",
      hint: "Money back on the customer's next invoice.",
    },
    plan_change: {
      name: "Plan changes",
      hint: "Moves the customer to another plan from the next cycle.",
    },
    add_on: {
      name: "Add-ons and packs",
      hint: "Paid packs such as roaming data.",
    },
    message: {
      name: "Messages to the customer",
      hint: "SMS sent in the operator's name.",
    },
  };

export const DEFAULT_AUTONOMY: AutonomySettings = {
  credit: { mode: "auto", autoLimit: 50 },
  plan_change: { mode: "ask" },
  add_on: { mode: "ask" },
  message: { mode: "ask" },
};

/** The single place that decides whether an action may run. */
export function decide(
  action: Pick<ProposedAction, "type" | "params">,
  settings: AutonomySettings,
): AutonomyMode {
  const s = settings[action.type] ?? { mode: "ask" };
  if (s.mode !== "auto") return s.mode;
  if (action.type === "credit") {
    const amount = Number(action.params.amount ?? 0);
    const limit = s.autoLimit ?? 0;
    return amount <= limit ? "auto" : "ask";
  }
  return "auto";
}
