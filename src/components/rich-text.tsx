"use client";

import { Fragment } from "react";
import { recordById } from "@/lib/data";
import type { SourceRef } from "./console";

const CITE = /\[\[([A-Z0-9-]+)(?:#([^\]\s]+))?\]\]/g;

export interface Citation extends SourceRef {
  key: string;
  n: number;
  title: string;
}

/** Numbers citations in order of first appearance. */
export function collectCitations(text: string): Citation[] {
  const seen = new Map<string, Citation>();
  for (const m of text.matchAll(CITE)) {
    const key = m[0];
    if (seen.has(key)) continue;
    const rec = recordById(m[1]);
    seen.set(key, {
      key,
      id: m[1],
      line: m[2],
      n: seen.size + 1,
      title: rec ? rec.title : m[1],
    });
  }
  return [...seen.values()];
}

export function RichText({
  text,
  citations,
  onOpenSource,
}: {
  text: string;
  citations: Citation[];
  onOpenSource: (ref: SourceRef) => void;
}) {
  const byKey = new Map(citations.map((c) => [c.key, c]));
  // Hide a citation token that is still streaming in.
  const clean = text.replace(/\[\[[^\]]*$/, "");
  const paragraphs = clean.split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((p, i) => {
        const nodes: React.ReactNode[] = [];
        let last = 0;
        for (const m of p.matchAll(CITE)) {
          const at = m.index ?? 0;
          nodes.push(p.slice(last, at).replace(/\s+$/, ""));
          const c = byKey.get(m[0]);
          if (c)
            nodes.push(
              <button
                key={`${i}-${at}`}
                type="button"
                title={`${c.title}${c.line ? ` · ${c.line}` : ""}`}
                aria-label={`Source ${c.n}: ${c.title}${c.line ? `, ${c.line}` : ""}`}
                onClick={() => onOpenSource({ id: c.id, line: c.line })}
                className="bg-accent-soft text-accent hover:bg-accent mx-0.5 inline-grid h-[18px] min-w-[18px] translate-y-[-1px] place-items-center rounded px-1 align-middle font-mono text-[11px] font-medium hover:text-white"
              >
                {c.n}
              </button>,
            );
          last = at + m[0].length;
        }
        nodes.push(p.slice(last));
        return (
          <p key={i} className="[&:not(:first-child)]:mt-3">
            {nodes.map((n, j) =>
              typeof n === "string" ? (
                <Fragment key={j}>
                  {n.split("\n").map((line, k, arr) => (
                    <Fragment key={k}>
                      {line}
                      {k < arr.length - 1 && <br />}
                    </Fragment>
                  ))}
                </Fragment>
              ) : (
                n
              ),
            )}
          </p>
        );
      })}
    </>
  );
}
