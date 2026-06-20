"use client";

import Link from "next/link";
import { useOpsStatus } from "@/hooks/use-ops-status";
import type { IncidentStatus, OpsIncident } from "@/lib/ops-types";
import { cn } from "@/lib/utils";

const OPEN: IncidentStatus[] = ["open", "in_progress", "pr_opened", "issue_opened"];

const STATUS_STYLE: Record<string, { text: string; dot: string }> = {
  open: { text: "text-signal-alert", dot: "bg-signal-alert" },
  in_progress: { text: "text-signal-warn", dot: "bg-signal-warn" },
  pr_opened: { text: "text-signal-info", dot: "bg-signal-info" },
  issue_opened: { text: "text-signal-warn", dot: "bg-signal-warn" },
};

function isOpen(i: OpsIncident) {
  return OPEN.includes(i.status);
}

/**
 * Compact triage strip above the session list — surfaces open watchdog /
 * maintainer incidents from aios-runtime.
 */
export function OpsAttention() {
  const { ops, error } = useOpsStatus();
  const open = (ops?.incidents ?? []).filter(isOpen);
  if (error || open.length === 0) return null;

  return (
    <div
      data-testid="ops-attention"
      className="border-b border-border/60 bg-card/30"
    >
      <div className="px-4 py-2 flex items-center justify-between gap-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-hairline text-muted-foreground">maintainer</span>
          <span className="font-mono text-[10px] text-signal-alert tabular-nums">
            {String(open.length).padStart(2, "0")}
          </span>
        </div>
        <Link
          href="/ops"
          className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ops →
        </Link>
      </div>
      <ul>
        {open.slice(0, 4).map((inc) => {
          const style = STATUS_STYLE[inc.status] ?? STATUS_STYLE.open;
          return (
            <li key={inc.id}>
              <Link
                href="/ops"
                data-testid={`ops-attention-${inc.id}`}
                className="block px-4 py-2 border-b border-border/30 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full shrink-0", style.dot)}
                  />
                  <span className="font-mono text-[11px] truncate text-foreground/90 flex-1">
                    {inc.kind}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-wider shrink-0",
                      style.text,
                    )}
                  >
                    {inc.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-0.5 pl-3.5 font-mono text-[10px] text-muted-foreground truncate">
                  {inc.symptom}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}