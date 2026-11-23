"use client";

import { ArrowUp, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Customer } from "@/lib/data";
import type { ProposedAction } from "@/lib/types";
import { ActionCard } from "./action-card";
import type { SourceRef } from "./console";
import { RichText, collectCitations } from "./rich-text";

export interface Message {
  id: string;
  role: "user" | "assistant" | "note";
  text: string;
  steps: { label: string; sources: string[] }[];
  actionIds: string[];
  streaming?: boolean;
  error?: string;
}

const SUGGESTIONS: Record<string, string[]> = {
  "C-1001": ["Why is October's bill ₴430?", "Prepare the goodwill credit"],
  "C-1002": ["He says he had no network for three days. What can we do?"],
  "C-1003": [
    "She wants a cheaper plan. What fits?",
    "She no longer needs the second SIM.",
  ],
};

export function Conversation({
  customer,
  messages,
  actions,
  busy,
  onSend,
  onDecide,
  onOpenSource,
  onReset,
}: {
  customer: Customer;
  messages: Message[];
  actions: Record<string, ProposedAction>;
  busy: boolean;
  onSend: (text: string) => void;
  onDecide: (id: string, ok: boolean) => void;
  onOpenSource: (ref: SourceRef) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const first = customer.name.split(" ")[0];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const submit = (text: string) => {
    if (busy || !text.trim()) return;
    onSend(text);
    setDraft("");
  };

  return (
    <main className="bg-bg flex min-h-[70dvh] flex-col lg:min-h-0">
      <div className="border-line flex h-12 shrink-0 items-center justify-between border-b px-4 lg:px-6">
        <h1 className="text-[14px] font-medium">
          Assistant{" "}
          <span className="text-faint">· {first}&rsquo;s account</span>
        </h1>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="text-muted hover:bg-surface hover:text-ink flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] disabled:opacity-40"
          >
            <RotateCcw aria-hidden className="size-3.5" /> Reset
          </button>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 py-6 lg:px-6"
        aria-live="polite"
      >
        <div className="mx-auto max-w-[680px] space-y-6">
          {messages.length === 0 && (
            <div className="border-line-strong text-muted rounded-xl border border-dashed p-5 text-[14px]">
              <p className="text-ink font-medium">{customer.note}</p>
              <p className="mt-1">
                Ask about {first}&rsquo;s account. Every figure in an answer
                links to the record it came from, and nothing that changes the
                account runs without your settings allowing it.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageView
              key={m.id}
              message={m}
              actions={actions}
              onDecide={onDecide}
              onOpenSource={onOpenSource}
            />
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-line bg-surface shrink-0 border-t px-4 pt-3 pb-4 lg:px-6">
        <div className="mx-auto max-w-[680px]">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(SUGGESTIONS[customer.id] ?? []).map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => submit(s)}
                className="text-muted ring-line-strong hover:bg-sunk hover:text-ink rounded-full px-3 py-1 text-[12px] ring-1 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
            className="bg-surface ring-line-strong focus-within:ring-accent flex items-end gap-2 rounded-xl p-1.5 ring-1"
          >
            <label htmlFor="ask" className="sr-only">
              Ask the assistant
            </label>
            <textarea
              id="ask"
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              placeholder={`Ask about ${first}’s account…`}
              className="placeholder:text-faint max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] outline-none"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="bg-ink disabled:bg-line-strong grid size-9 shrink-0 place-items-center rounded-lg text-white"
            >
              <ArrowUp aria-hidden className="size-4" strokeWidth={2.5} />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function MessageView({
  message: m,
  actions,
  onDecide,
  onOpenSource,
}: {
  message: Message;
  actions: Record<string, ProposedAction>;
  onDecide: (id: string, ok: boolean) => void;
  onOpenSource: (ref: SourceRef) => void;
}) {
  if (m.role === "user")
    return (
      <div className="appear flex justify-end">
        <p className="bg-ink max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] text-white">
          {m.text}
        </p>
      </div>
    );

  if (m.role === "note")
    return (
      <p className="appear text-faint text-center text-[12px]">
        <span className="bg-surface ring-line rounded-full px-3 py-1 ring-1">
          {m.text}
        </span>
      </p>
    );

  const citations = collectCitations(m.text);
  const thinking = m.streaming && !m.text && m.steps.length === 0;

  return (
    <article className="appear">
      {m.steps.length > 0 && (
        <details className="group text-muted mb-3 text-[12px]">
          <summary className="hover:text-ink flex cursor-pointer list-none items-center gap-1 select-none">
            <ChevronRight
              aria-hidden
              className="size-3.5 transition-transform group-open:rotate-90"
            />
            {m.streaming && !m.text ? "Working: " : ""}
            {m.steps.length} step{m.steps.length === 1 ? "" : "s"} ·{" "}
            {m.steps[m.steps.length - 1].label}
          </summary>
          <ol className="border-line mt-2 ml-1.5 space-y-1 border-l pl-4">
            {m.steps.map((s, i) => (
              <li key={i}>
                {s.label}
                {s.sources.length > 0 && (
                  <span className="text-faint">
                    {" "}
                    ·{" "}
                    {s.sources.map((id, j) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpenSource({ id })}
                        className="hover:text-accent font-mono text-[11px]"
                      >
                        {id}
                        {j < s.sources.length - 1 ? ", " : ""}
                      </button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      {thinking && (
        <p className="text-faint text-[14px]">Reading the account…</p>
      )}

      {m.text && (
        <div
          className={`text-[15px] leading-relaxed ${m.streaming ? "caret" : ""}`}
        >
          <RichText
            text={m.text}
            citations={citations}
            onOpenSource={onOpenSource}
          />
        </div>
      )}

      {m.actionIds.map((id) =>
        actions[id] ? (
          <ActionCard
            key={id}
            action={actions[id]}
            onDecide={onDecide}
            onOpenSource={onOpenSource}
          />
        ) : null,
      )}

      {!m.streaming && citations.length > 0 && (
        <ol className="text-faint mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
          {citations.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => onOpenSource({ id: c.id, line: c.line })}
                className="hover:text-accent"
              >
                <span className="text-accent font-mono">{c.n}</span> {c.title}
                {c.line ? ` · ${c.line}` : ""}
              </button>
            </li>
          ))}
        </ol>
      )}

      {m.error && (
        <p role="alert" className="text-off mt-2 text-[13px]">
          {m.error}
        </p>
      )}
    </article>
  );
}
