"use client";

import Link from "next/link";
import { useOpsStatus } from "@/hooks/use-ops-status";
import type { IncidentStatus, OpsIncident } from "@/lib/ops-types";
import { cn } from "@/lib/utils";

const STATUS_ORDER: IncidentStatus[] = [
  "open",
  "in_progress",
  "pr_opened",
  "issue_opened",
  "resolved",
  "wontfix",
];

const STATUS_BADGE: Record<IncidentStatus, string> = {
  open: "text-signal-alert border-signal-alert/40 bg-signal-alert/10",
  in_progress: "text-signal-warn border-signal-warn/40 bg-signal-warn/10",
  pr_opened: "text-signal-info border-signal-info/40 bg-signal-info/10",
  issue_opened: "text-signal-warn border-signal-warn/40 bg-signal-warn/10",
  resolved: "text-signal border-signal/40 bg-signal/10",
  wontfix: "text-muted-foreground border-border/60 bg-muted/20",
};

function IncidentCard({ inc }: { inc: OpsIncident }) {
  const badge = STATUS_BADGE[inc.status] ?? STATUS_BADGE.open;
  return (
    <article
      data-testid={`ops-incident-${inc.id}`}
      className="border border-border/60 rounded-sm bg-card/40 p-4 space-y-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="font-mono text-[12px] text-foreground">{inc.id}</div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {inc.kind} · {inc.fingerprint}
          </div>
        </div>
        <span
          className={cn(
            "font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border shrink-0",
            badge,
          )}
        >
          {inc.status.replaceAll("_", " ")}
        </span>
      </div>
      <p className="text-[13px] text-foreground/90 leading-relaxed">{inc.symptom}</p>
      <div className="grid gap-2 text-[11px] font-mono text-muted-foreground">
        <div>
          <span className="text-muted-foreground/60">hypothesis </span>
          {inc.hypothesis}
        </div>
        <div>
          <span className="text-muted-foreground/60">fix </span>
          {inc.suggested_fix}
        </div>
      </div>
      {inc.outcome_url && (
        <a
          href={inc.outcome_url}
          target="_blank"
          rel="noreferrer"
          className="inline-block font-mono text-[10px] text-signal hover:underline"
        >
          {inc.outcome_url}
        </a>
      )}
      {Object.keys(inc.evidence).length > 0 && (
        <pre className="text-[10px] font-mono bg-muted/30 border border-border/40 rounded p-2 overflow-x-auto text-muted-foreground">
          {JSON.stringify(inc.evidence, null, 2)}
        </pre>
      )}
    </article>
  );
}

export function OpsDashboard() {
  const { ops, error } = useOpsStatus(10_000);

  if (error) {
    return (
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 font-mono text-[12px] text-signal-alert">
          ops probe failed: {error}
        </div>
      </main>
    );
  }

  if (!ops) {
    return (
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 flex items-center gap-2 text-pico text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-signal-warn animate-signal" />
          <span>loading ops status…</span>
        </div>
      </main>
    );
  }

  const open = ops.incidents.filter((i) =>
    ["open", "in_progress", "pr_opened", "issue_opened"].includes(i.status),
  );
  const closed = ops.incidents.filter((i) => !open.includes(i));

  return (
    <main className="flex-1 min-w-0 overflow-y-auto" data-testid="ops-dashboard">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        <header className="space-y-2">
          <p className="text-hairline text-muted-foreground">runtime ops</p>
          <h1 className="font-mono text-xl tracking-tight text-foreground">
            watchdog & maintainer
          </h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-xl">
            Detector incidents, dispatcher state, and recent watchdog log from{" "}
            <span className="font-mono text-foreground/80">{ops.runtime_path}</span>.
            Polls every 10s.
          </p>
        </header>

        <section className="grid sm:grid-cols-3 gap-3 font-mono text-[10px] uppercase tracking-wider">
          <StatCard label="open" value={String(ops.open_count)} alert={ops.open_count > 0} />
          <StatCard label="session" value={ops.state.session_id?.slice(0, 18) ?? "—"} />
          <StatCard
            label="relay"
            value={ops.summary.relay_allowed ? "on" : "off"}
            alert={ops.summary.relay_allowed}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-hairline text-muted-foreground">agents</h2>
          <div className="font-mono text-[11px] text-muted-foreground space-y-1 border border-border/50 rounded-sm p-3 bg-card/30">
            <div>
              <span className="text-muted-foreground/50">watchdog </span>
              {ops.summary.watchdog_label} · every 3m
            </div>
            <div>
              <span className="text-muted-foreground/50">maintain </span>
              {ops.summary.maintain_label} · every 15m
            </div>
            <div>
              <span className="text-muted-foreground/50">agent </span>
              {ops.state.agent_id ?? "—"}
            </div>
            {ops.state.session_id && (
              <div>
                <span className="text-muted-foreground/50">session </span>
                <Link href={`/sessions/${ops.state.session_id}`} className="text-signal hover:underline">
                  {ops.state.session_id}
                </Link>
              </div>
            )}
          </div>
        </section>

        {open.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-hairline text-signal-alert">needs action ({open.length})</h2>
            <div className="space-y-3">
              {open.map((inc) => (
                <IncidentCard key={inc.id} inc={inc} />
              ))}
            </div>
          </section>
        )}

        {closed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-hairline text-muted-foreground">history ({closed.length})</h2>
            <div className="space-y-3">
              {closed
                .sort(
                  (a, b) =>
                    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
                )
                .map((inc) => (
                  <IncidentCard key={inc.id} inc={inc} />
                ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-hairline text-muted-foreground">watchdog log</h2>
          <pre
            data-testid="ops-log-tail"
            className="font-mono text-[10px] leading-relaxed bg-muted/20 border border-border/50 rounded-sm p-3 overflow-x-auto text-muted-foreground max-h-64 overflow-y-auto"
          >
            {ops.log_tail.length > 0 ? ops.log_tail.join("\n") : "(empty)"}
          </pre>
          <p className="font-mono text-[9px] text-muted-foreground/60">
            checked {new Date(ops.checked_at).toLocaleTimeString()}
          </p>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="border border-border/50 rounded-sm p-3 bg-card/30">
      <div className="text-muted-foreground/60 mb-1">{label}</div>
      <div
        className={cn(
          "text-[12px] normal-case tracking-normal truncate",
          alert ? "text-signal-alert" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}