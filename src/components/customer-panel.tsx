"use client";

import { PLANS, uah, type Customer } from "@/lib/data";
import type { ProposedAction } from "@/lib/types";
import type { SourceRef } from "./console";

export function CustomerPanel({
  customers,
  selectedId,
  onSelect,
  actions,
  onOpenSource,
}: {
  customers: Customer[];
  selectedId: string;
  onSelect: (id: string) => void;
  actions: ProposedAction[];
  onOpenSource: (ref: SourceRef) => void;
}) {
  const c = customers.find((x) => x.id === selectedId)!;
  const plan = PLANS[c.planId];
  const done = actions.filter(
    (a) => a.status === "auto" || a.status === "confirmed",
  );

  return (
    <aside className="border-line bg-surface border-b lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div className="p-4 lg:p-5">
        <h2 className="text-faint text-[11px] font-medium tracking-wide uppercase">
          Queue
        </h2>
        <ul className="mt-2 flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
          {customers.map((x) => {
            const active = x.id === selectedId;
            return (
              <li key={x.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(x.id)}
                  aria-current={active ? "true" : undefined}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    active ? "bg-ink text-white" : "hover:bg-sunk"
                  }`}
                >
                  <span className="block text-[14px] font-medium">
                    {x.name}
                  </span>
                  <span
                    className={`block text-[12px] ${active ? "text-white/70" : "text-faint"}`}
                  >
                    {x.note}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-line border-t p-4 lg:p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-semibold">{c.name}</h2>
          <span className="text-faint font-mono text-[11px]">{c.id}</span>
        </div>
        <p className="text-muted mt-0.5 font-mono text-[12px]">{c.phone}</p>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-faint">Plan</dt>
          <dd>
            <button
              type="button"
              className="decoration-line-strong hover:decoration-accent text-left underline underline-offset-2"
              onClick={() => onOpenSource({ id: c.planId })}
            >
              {plan.name}
            </button>
            <span className="text-muted"> · {uah(plan.fee)}/mo</span>
          </dd>
          <dt className="text-faint">Since</dt>
          <dd>{c.since}</dd>
          <dt className="text-faint">Home area</dt>
          <dd>{c.homeArea}</dd>
          <dt className="text-faint">Add-ons</dt>
          <dd>{c.addOns.join(", ") || "None"}</dd>
        </dl>

        <h3 className="text-faint mt-6 text-[11px] font-medium tracking-wide uppercase">
          Changes this session
        </h3>
        {done.length === 0 ? (
          <p className="text-muted mt-2 text-[13px]">None yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {done.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="bg-ok mt-1.5 size-1.5 shrink-0 rounded-full"
                />
                <span>
                  {a.title}
                  <span className="text-faint">
                    {" "}
                    · {a.status === "auto" ? "automatic" : "confirmed by you"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
