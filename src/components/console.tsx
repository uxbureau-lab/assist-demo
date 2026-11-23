"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_AUTONOMY } from "@/lib/autonomy";
import { CUSTOMERS } from "@/lib/data";
import type {
  AutonomySettings,
  ChatTurn,
  LogEntry,
  ProposedAction,
  StreamEvent,
} from "@/lib/types";
import { CustomerPanel } from "./customer-panel";
import { Conversation, type Message } from "./conversation";
import { SidePanel, type SideTab } from "./side-panel";

export type SourceRef = { id: string; line?: string };

const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();

/** Claude needs alternating roles; operator decisions travel as user turns. */
function toHistory(
  thread: Message[],
  actions: Record<string, ProposedAction>,
): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const m of thread) {
    let role: ChatTurn["role"];
    let content: string;
    if (m.role === "assistant") {
      role = "assistant";
      const acts = m.actionIds
        .map((id) => actions[id])
        .filter(Boolean)
        .map((a) => `[Action ${a.id}: ${a.title} — ${a.status}]`);
      content = [m.text.trim(), ...acts].filter(Boolean).join("\n");
      if (!content) continue;
    } else {
      role = "user";
      content = m.role === "note" ? `[Operator] ${m.text}` : m.text;
    }
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content += `\n\n${content}`;
    else turns.push({ role, content });
  }
  return turns;
}

export function Console() {
  const [customerId, setCustomerId] = useState(CUSTOMERS[0].id);
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
  const [actions, setActions] = useState<Record<string, ProposedAction>>({});
  const [autonomy, setAutonomy] = useState<AutonomySettings>(DEFAULT_AUTONOMY);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [source, setSource] = useState<SourceRef | null>(null);
  const [tab, setTab] = useState<SideTab>("source");
  const [mode, setMode] = useState<"live" | "scripted" | null>(null);
  const [busy, setBusy] = useState(false);
  const sideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setMode(d.mode))
      .catch(() => {});
  }, []);

  const thread = useMemo(
    () => threads[customerId] ?? [],
    [threads, customerId],
  );

  const addLog = useCallback(
    (cid: string, actor: LogEntry["actor"], text: string) =>
      setLog((l) => [
        { id: uid(), at: nowIso(), customerId: cid, actor, text },
        ...l,
      ]),
    [],
  );

  const patchMessage = useCallback(
    (cid: string, id: string, fn: (m: Message) => Message) =>
      setThreads((t) => ({
        ...t,
        [cid]: (t[cid] ?? []).map((m) => (m.id === id ? fn(m) : m)),
      })),
    [],
  );

  const openSource = useCallback((ref: SourceRef) => {
    setSource(ref);
    setTab("source");
    if (window.matchMedia("(max-width: 1023px)").matches)
      sideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const cid = customerId;
      const question = text.trim();
      if (!question || busy) return;
      const userMsg: Message = {
        id: uid(),
        role: "user",
        text: question,
        steps: [],
        actionIds: [],
      };
      const replyId = uid();
      const reply: Message = {
        id: replyId,
        role: "assistant",
        text: "",
        steps: [],
        actionIds: [],
        streaming: true,
      };
      const history = toHistory([...thread, userMsg], actions);
      setThreads((t) => ({ ...t, [cid]: [...(t[cid] ?? []), userMsg, reply] }));
      setBusy(true);

      const ledger = Object.values(actions).filter(
        (a) => a.status === "auto" || a.status === "confirmed",
      );

      const handle = (e: StreamEvent) => {
        switch (e.type) {
          case "mode":
            setMode(e.mode);
            break;
          case "tool":
            patchMessage(cid, replyId, (m) => ({
              ...m,
              steps: [...m.steps, { label: e.label, sources: e.sources }],
            }));
            if (
              !e.name.startsWith("issue") &&
              !e.name.startsWith("change") &&
              !e.name.startsWith("add") &&
              !e.name.startsWith("send")
            )
              addLog(cid, "assistant", e.label);
            break;
          case "action": {
            const a = e.action;
            setActions((s) => ({ ...s, [a.id]: a }));
            patchMessage(cid, replyId, (m) => ({
              ...m,
              actionIds: [...m.actionIds, a.id],
            }));
            if (a.status === "auto")
              addLog(
                cid,
                "policy",
                `Executed automatically within your settings: ${a.title}`,
              );
            else if (a.status === "pending")
              addLog(cid, "assistant", `Proposed, waiting for you: ${a.title}`);
            else addLog(cid, "policy", `Blocked by your settings: ${a.title}`);
            break;
          }
          case "text":
            patchMessage(cid, replyId, (m) => ({
              ...m,
              text: m.text + e.delta,
            }));
            break;
          case "error":
            patchMessage(cid, replyId, (m) => ({ ...m, error: e.message }));
            break;
          case "done":
            break;
        }
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: cid,
            messages: history,
            autonomy,
            ledger,
          }),
        });
        if (!res.ok || !res.body) {
          const msg = await res
            .json()
            .catch(() => ({ error: "Request failed." }));
          handle({ type: "error", message: msg.error ?? "Request failed." });
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) if (line.trim()) handle(JSON.parse(line));
          }
        }
      } catch {
        handle({ type: "error", message: "Connection lost. Try again." });
      } finally {
        patchMessage(cid, replyId, (m) => ({ ...m, streaming: false }));
        setBusy(false);
      }
    },
    [customerId, busy, thread, actions, autonomy, addLog, patchMessage],
  );

  const decideAction = useCallback(
    (id: string, ok: boolean) => {
      const a = actions[id];
      if (!a || a.status !== "pending") return;
      const status = ok ? "confirmed" : "declined";
      setActions((s) => ({
        ...s,
        [id]: { ...a, status, decidedAt: nowIso() },
      }));
      addLog(
        a.customerId,
        "operator",
        `${ok ? "Confirmed" : "Declined"}: ${a.title}`,
      );
      const note: Message = {
        id: uid(),
        role: "note",
        text: `${ok ? "Confirmed" : "Declined"}: ${a.title}`,
        steps: [],
        actionIds: [],
      };
      setThreads((t) => ({
        ...t,
        [a.customerId]: [...(t[a.customerId] ?? []), note],
      }));
    },
    [actions, addLog],
  );

  const changeAutonomy = useCallback(
    (next: AutonomySettings, change: string) => {
      setAutonomy(next);
      addLog(customerId, "operator", `Settings: ${change}`);
    },
    [addLog, customerId],
  );

  const reset = useCallback(() => {
    setThreads((t) => ({ ...t, [customerId]: [] }));
    setActions((s) =>
      Object.fromEntries(
        Object.entries(s).filter(([, a]) => a.customerId !== customerId),
      ),
    );
    setLog((l) => l.filter((e) => e.customerId !== customerId));
    setSource(null);
  }, [customerId]);

  const customer = CUSTOMERS.find((c) => c.id === customerId)!;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="border-line bg-surface flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-5">
        <span
          aria-hidden
          className="bg-ink grid size-7 place-items-center rounded-md text-[13px] font-semibold text-white"
        >
          N
        </span>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[15px] font-semibold">Northline Care</span>
          <span className="text-muted text-[15px]">Assist</span>
        </div>
        {mode && (
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
              mode === "live"
                ? "bg-ok-soft text-ok"
                : "bg-sunk text-muted ring-line ring-1"
            }`}
          >
            {mode === "live" ? "Live · Claude" : "Scripted mode"}
          </span>
        )}
        <a
          href="https://uxbureau.pro"
          className="text-faint hover:text-ink ml-auto text-[12px]"
        >
          <span className="hidden sm:inline">
            Prototype by UX Bureau · fictional data
          </span>
          <span className="sm:hidden">UX Bureau</span>
        </a>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
        <CustomerPanel
          customers={CUSTOMERS}
          selectedId={customerId}
          onSelect={(id) => {
            setCustomerId(id);
            setSource(null);
          }}
          actions={Object.values(actions).filter(
            (a) => a.customerId === customerId,
          )}
          onOpenSource={openSource}
        />
        <Conversation
          key={customerId}
          customer={customer}
          messages={thread}
          actions={actions}
          busy={busy}
          onSend={send}
          onDecide={decideAction}
          onOpenSource={openSource}
          onReset={reset}
        />
        <SidePanel
          ref={sideRef}
          tab={tab}
          onTab={setTab}
          source={source}
          onOpenSource={openSource}
          autonomy={autonomy}
          onAutonomy={changeAutonomy}
          log={log.filter((e) => e.customerId === customerId)}
        />
      </div>
    </div>
  );
}
