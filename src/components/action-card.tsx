"use client";

import { Check, CircleSlash, Clock, ShieldCheck, X } from "lucide-react";
import type { ProposedAction } from "@/lib/types";
import type { SourceRef } from "./console";
import { RichText, collectCitations } from "./rich-text";

const STATUS = {
  pending: {
    label: "Needs your confirmation",
    icon: Clock,
    tone: "border-warn/40 bg-warn-soft/40",
    badge: "text-warn",
  },
  auto: {
    label: "Done automatically, within your settings",
    icon: ShieldCheck,
    tone: "border-ok/30 bg-ok-soft/50",
    badge: "text-ok",
  },
  confirmed: {
    label: "Confirmed by you",
    icon: Check,
    tone: "border-ok/30 bg-ok-soft/50",
    badge: "text-ok",
  },
  declined: {
    label: "Declined by you",
    icon: X,
    tone: "border-line bg-sunk",
    badge: "text-muted",
  },
  blocked: {
    label: "Blocked by your settings. Do it manually if needed",
    icon: CircleSlash,
    tone: "border-off/30 bg-off-soft/50",
    badge: "text-off",
  },
} as const;

export function ActionCard({
  action,
  onDecide,
  onOpenSource,
}: {
  action: ProposedAction;
  onDecide: (id: string, ok: boolean) => void;
  onOpenSource: (ref: SourceRef) => void;
}) {
  const s = STATUS[action.status];
  const Icon = s.icon;
  const citations = collectCitations(action.rationale);

  return (
    <section
      aria-label={`Action: ${action.title}`}
      className={`appear mt-3 rounded-xl border p-4 ${s.tone}`}
    >
      <div
        className={`flex items-center gap-1.5 text-[12px] font-medium ${s.badge}`}
      >
        <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
        {s.label}
      </div>
      <h4 className="mt-1.5 text-[15px] font-semibold">{action.title}</h4>
      <ul className="mt-2 space-y-1 text-[13px]">
        {action.impact.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden className="text-faint">
              →
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <div className="text-muted mt-3 text-[13px] leading-relaxed">
        <div className="text-faint mb-0.5 text-[11px] font-medium tracking-wide uppercase">
          Why
        </div>
        <RichText
          text={action.rationale}
          citations={citations}
          onOpenSource={onOpenSource}
        />
      </div>
      {action.status === "pending" && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onDecide(action.id, true)}
            className="bg-ink hover:bg-ink/85 h-9 rounded-lg px-4 text-[13px] font-medium text-white"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => onDecide(action.id, false)}
            className="text-muted ring-line-strong hover:bg-surface hover:text-ink h-9 rounded-lg px-4 text-[13px] font-medium ring-1"
          >
            Decline
          </button>
        </div>
      )}
    </section>
  );
}
