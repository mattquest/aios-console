"use client";

import Link from "next/link";
import { deriveDisplayStatus, type Session } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Triage panel pinned above the session list: surfaces only the sessions
 * an operator must act on — errored (alert), waiting on a tool approval
 * (warn, with the pending tool names), or retrying (info). Renders nothing
 * when every session is healthy.
 */

const BUCKETS = [
  { status: "errored", text: "text-signal-alert", dot: "bg-signal-alert" },
  { status: "needs you", text: "text-signal-warn", dot: "bg-signal-warn" },
  { status: "retrying", text: "text-signal-info", dot: "bg-signal-info" },
] as const;

export function NeedsAttention({ sessions }: { sessions: Session[] }) {
  const rows = BUCKETS.flatMap((bucket) =>
    sessions
      .filter((s) => deriveDisplayStatus(s) === bucket.status)
      .map((session) => ({ session, ...bucket })),
  );
  if (rows.length === 0) return null;

  return (
    <div
      data-testid="needs-attention"
      className="border-b border-border/60 bg-card/30"
    >
      <div className="px-4 py-2 flex items-center gap-2 border-b border-border/40">
        <span className="text-hairline text-muted-foreground">
          needs attention
        </span>
        <span className="font-mono text-[10px] text-signal-warn tabular-nums">
          {String(rows.length).padStart(2, "0")}
        </span>
      </div>
      <ul>
        {rows.map(({ session: s, status, text, dot }) => (
          <li key={s.id}>
            <Link
              href={`/sessions/${s.id}`}
              data-testid={`attention-${s.id}`}
              data-status={status}
              className="block px-4 py-2 border-b border-border/30 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                {/* Decorative — the status word at the row's end names it. */}
                <span aria-hidden className={cn("size-1.5 rounded-full shrink-0", dot)} />
                <span className="font-mono text-[11px] truncate text-foreground/90 flex-1">
                  {s.title || s.id.slice(0, 16) + "…"}
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-wider shrink-0",
                    text,
                  )}
                >
                  {status}
                </span>
              </div>
              {status === "needs you" && s.awaiting && s.awaiting.length > 0 && (
                <div className="mt-0.5 pl-3.5 font-mono text-[10px] text-signal-warn/80 truncate">
                  awaiting {s.awaiting.map((a) => a.name).join(", ")}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
