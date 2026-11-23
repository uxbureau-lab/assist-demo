"use client";

import { FileText } from "lucide-react";
import type { Ref } from "react";
import { ACTION_LABELS } from "@/lib/autonomy";
import { recordById } from "@/lib/data";
import type {
  ActionType,
  AutonomyMode,
  AutonomySettings,
  LogEntry,
} from "@/lib/types";
import type { SourceRef } from "./console";

export type SideTab = "source" | "autonomy" | "activity";

const TABS: { id: SideTab; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "autonomy", label: "Autonomy" },
  { id: "activity", label: "Activity" },
];

export function SidePanel({
  ref,
  tab,
  onTab,
  source,
  onOpenSource,
  autonomy,
  onAutonomy,
  log,
}: {
  ref?: Ref<HTMLElement>;
  tab: SideTab;
  onTab: (t: SideTab) => void;
  source: SourceRef | null;
  onOpenSource: (ref: SourceRef) => void;
  autonomy: AutonomySettings;
  onAutonomy: (next: AutonomySettings, change: string) => void;
  log: LogEntry[];
}) {
  return (
    <aside
      ref={ref}
      className="border-line bg-surface scroll-mt-2 border-t lg:flex lg:min-h-0 lg:flex-col lg:border-t-0 lg:border-l"
    >
      <div
        role="tablist"
        aria-label="Details"
        className="border-line flex h-12 shrink-0 gap-1 border-b px-3"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => onTab(t.id)}
            className={`relative px-3 text-[13px] font-medium ${
              tab === t.id
                ? "text-ink after:bg-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5"
                : "text-faint hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "activity" && log.length > 0 && (
              <span className="text-faint ml-1.5 font-mono text-[11px]">
                {log.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="p-4 lg:flex-1 lg:overflow-y-auto lg:p-5"
      >
        {tab === "source" && (
          <SourceView source={source} onOpenSource={onOpenSource} />
        )}
        {tab === "autonomy" && (
          <AutonomyView settings={autonomy} onChange={onAutonomy} />
        )}
        {tab === "activity" && <ActivityView log={log} />}
      </div>
    </aside>
  );
}

function SourceView({
  source,
}: {
  source: SourceRef | null;
  onOpenSource: (ref: SourceRef) => void;
}) {
  if (!source)
    return (
      <div className="text-muted flex flex-col items-start gap-2 text-[13px]">
        <FileText aria-hidden className="text-faint size-5" />
        <p>
          Select a numbered source in an answer to see the exact record and line
          it came from.
        </p>
      </div>
    );

  const r = recordById(source.id);
  if (!r)
    return (
      <p className="text-off text-[13px]">Record {source.id} not found.</p>
    );

  return (
    <article className="appear" key={`${source.id}${source.line ?? ""}`}>
      <div className="text-faint flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase">
        {r.kind}
        <span className="font-mono tracking-normal normal-case">{r.id}</span>
      </div>
      <h2 className="mt-1 text-[17px] font-semibold">{r.title}</h2>

      <dl className="divide-line ring-line mt-4 divide-y rounded-lg ring-1">
        {r.fields.map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2 text-[13px]"
          >
            <dt className="text-faint">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {r.lines && (
        <ol className="mt-4 space-y-2">
          {r.lines.map((l) => {
            const hit = l.id === source.line;
            return (
              <li
                key={l.id}
                className={`rounded-lg px-3 py-2 text-[13px] ${
                  hit ? "bg-accent-soft ring-accent/40 ring-1" : "bg-sunk"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    <span className="text-faint mr-2 font-mono text-[11px]">
                      {l.id}
                    </span>
                    {l.label}
                  </span>
                  {r.kind === "invoice" && (
                    <span className="font-mono">{l.value}</span>
                  )}
                </div>
                {r.kind !== "invoice" && (
                  <p className="text-muted mt-1">{l.value}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {r.body && (
        <blockquote className="border-line-strong text-muted mt-4 border-l-2 pl-3 text-[13px]">
          {r.body}
        </blockquote>
      )}
    </article>
  );
}

const MODES: { id: AutonomyMode; label: string }[] = [
  { id: "auto", label: "Do it" },
  { id: "ask", label: "Ask me" },
  { id: "off", label: "Never" },
];

function AutonomyView({
  settings,
  onChange,
}: {
  settings: AutonomySettings;
  onChange: (next: AutonomySettings, change: string) => void;
}) {
  return (
    <div>
      <p className="text-muted text-[13px]">
        The assistant always reads account data. Anything that changes the
        account follows these rules, checked on the server for every action.
      </p>
      <ul className="mt-5 space-y-5">
        {(Object.keys(ACTION_LABELS) as ActionType[]).map((type) => {
          const s = settings[type];
          const info = ACTION_LABELS[type];
          return (
            <li key={type}>
              <fieldset>
                <legend className="text-[14px] font-medium">{info.name}</legend>
                <p className="text-faint text-[12px]">{info.hint}</p>
                <div className="bg-sunk ring-line mt-2 grid grid-cols-3 rounded-lg p-0.5 ring-1">
                  {MODES.map((m) => {
                    const on = s.mode === m.id;
                    return (
                      <label
                        key={m.id}
                        className={`has-[:focus-visible]:outline-accent cursor-pointer rounded-md py-1.5 text-center text-[12px] font-medium has-[:focus-visible]:outline-2 ${
                          on
                            ? "bg-surface text-ink ring-line shadow-sm ring-1"
                            : "text-faint hover:text-ink"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`mode-${type}`}
                          value={m.id}
                          checked={on}
                          onChange={() =>
                            onChange(
                              { ...settings, [type]: { ...s, mode: m.id } },
                              `${info.name} → ${m.label}`,
                            )
                          }
                          className="sr-only"
                        />
                        {m.label}
                      </label>
                    );
                  })}
                </div>
                {type === "credit" && s.mode === "auto" && (
                  <label className="text-muted mt-2 flex items-center gap-2 text-[12px]">
                    Without asking up to
                    <span className="bg-surface ring-line-strong focus-within:ring-accent flex items-center rounded-md px-2 ring-1">
                      ₴
                      <input
                        type="number"
                        min={0}
                        max={500}
                        step={10}
                        value={s.autoLimit ?? 0}
                        onChange={(e) => {
                          const v = Math.max(
                            0,
                            Math.min(500, Number(e.target.value) || 0),
                          );
                          onChange(
                            { ...settings, credit: { ...s, autoLimit: v } },
                            `Auto-credit limit → ₴${v}`,
                          );
                        }}
                        className="text-ink w-14 bg-transparent py-1 pl-1 font-mono outline-none"
                      />
                    </span>
                    , above that ask me.
                  </label>
                )}
              </fieldset>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ACTOR: Record<LogEntry["actor"], string> = {
  assistant: "Assistant",
  operator: "You",
  policy: "Settings",
};

function ActivityView({ log }: { log: LogEntry[] }) {
  if (log.length === 0)
    return (
      <p className="text-muted text-[13px]">
        Every read, proposal and decision for this customer appears here, newest
        first.
      </p>
    );
  return (
    <ol className="space-y-3">
      {log.map((e) => (
        <li key={e.id} className="grid grid-cols-[52px_1fr] gap-2 text-[13px]">
          <time
            dateTime={e.at}
            className="text-faint font-mono text-[11px] leading-5"
          >
            {new Date(e.at).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
          <p>
            <span className="font-medium">{ACTOR[e.actor]}</span>{" "}
            <span className="text-muted">{e.text}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
