"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { UsageGranularity, UsageReport, UsageRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorBanner } from "@/components/error-banner";

type RangePreset = "7d" | "30d" | "all";

const TABS: { value: UsageGranularity; label: string }[] = [
  { value: "day", label: "by day" },
  { value: "session", label: "by session" },
  { value: "model", label: "by model" },
];

const RANGES: { value: RangePreset; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "all" },
];

function sinceFor(range: RangePreset): string | undefined {
  if (range === "all") return undefined;
  const days = range === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default function UsagePage() {
  const [granularity, setGranularity] = useState<UsageGranularity>("day");
  const [range, setRange] = useState<RangePreset>("30d");
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch on every (granularity, range) change. State writes happen only
  // in the promise callbacks; the ``active`` flag drops stale responses
  // when the operator switches tabs mid-flight.
  useEffect(() => {
    let active = true;
    api
      .getUsage(granularity, sinceFor(range))
      .then((r) => {
        if (!active) return;
        setReport(r);
        setError(null);
      })
      .catch((e: unknown) => {
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [granularity, range, reloadKey]);

  // Event-handler paths: bring the spinner back before the effect refetches.
  const pickTab = (g: UsageGranularity) => {
    setGranularity(g);
    setLoading(true);
  };
  const pickRange = (r: RangePreset) => {
    setRange(r);
    setLoading(true);
  };
  const retry = () => {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const rows = report?.rows ?? [];
  const unknownCostRequests = rows.reduce(
    (acc, r) => acc + r.cost_usd_estimated_null_requests,
    0,
  );

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-10 space-y-6 animate-rise">
        <header className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 text-pico text-muted-foreground">
            <span className="text-signal">{"//"}</span>
            <span>resource/usage</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="tabular-nums normal-case tracking-[0.12em]">/04</span>
          </div>
          <h1 className="text-display text-[clamp(1.5rem,2.6vw,2rem)] leading-tight tracking-[-0.025em] text-foreground">
            <span className="text-muted-foreground/50">›</span> usage
            <span className="text-muted-foreground/40 font-normal">
              {" "}
              — tokens · requests · known cost
            </span>
          </h1>
          <p className="font-sans text-[13.5px] text-muted-foreground max-w-xl leading-[1.6]">
            Token counts come from the provider&apos;s usage report on each model
            request. Cost is shown only where the provider reported one —
            requests without cost data are counted, never estimated.
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-0.5" data-testid="usage-tabs">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                data-testid={`usage-tab-${t.value}`}
                aria-pressed={granularity === t.value}
                onClick={() => pickTab(t.value)}
                className={cn(
                  "px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-[0.08em] transition-colors",
                  granularity === t.value
                    ? "text-foreground bg-muted/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/25",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5" data-testid="usage-range">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                data-testid={`usage-range-${r.value}`}
                aria-pressed={range === r.value}
                onClick={() => pickRange(r.value)}
                className={cn(
                  "px-2.5 py-1 rounded text-[10px] font-mono uppercase tabular-nums transition-colors",
                  range === r.value
                    ? "text-foreground bg-muted/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/25",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divider-h" />

        {loading && (
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="bracket-label">loading</span>…
          </div>
        )}
        {!loading && error != null && (
          <ErrorBanner error={error} onRetry={retry} testId="usage-error" />
        )}
        {!loading && error == null && rows.length === 0 && (
          <p
            className="font-mono text-[12px] text-muted-foreground"
            data-testid="usage-empty"
          >
            <span className="text-signal">$</span> no model requests in this
            range.
          </p>
        )}
        {!loading && error == null && rows.length > 0 && (
          <div className="space-y-4">
            {granularity === "day" && <DayBars rows={rows} />}
            <UsageTable granularity={granularity} rows={rows} />
            {unknownCostRequests > 0 && (
              <p
                className="font-mono text-[11px] text-muted-foreground"
                data-testid="unknown-cost-footnote"
              >
                * {unknownCostRequests}{" "}
                {unknownCostRequests === 1 ? "request" : "requests"} without
                cost data — known cost covers only requests where the provider
                reported a price.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/** Per-day token bars, plain divs — height scaled to the busiest day. */
function DayBars({ rows }: { rows: UsageRow[] }) {
  const max = Math.max(...rows.map((r) => r.input_tokens + r.output_tokens), 1);
  return (
    <div
      className="flex items-end gap-1 h-24 border border-border/60 rounded-sm bg-card/30 p-3"
      data-testid="usage-bars"
    >
      {rows.map((r) => {
        const total = r.input_tokens + r.output_tokens;
        const pct = Math.max(Math.round((total / max) * 100), 2);
        return (
          <div
            key={r.key}
            className="flex-1 max-w-8 bg-signal/60 rounded-[1px]"
            style={{ height: `${pct}%` }}
            title={`${r.key} — ${formatTokens(total)} tokens`}
            data-testid={`usage-bar-${r.key}`}
          />
        );
      })}
    </div>
  );
}

function UsageTable({
  granularity,
  rows,
}: {
  granularity: UsageGranularity;
  rows: UsageRow[];
}) {
  const keyHeader =
    granularity === "day" ? "day" : granularity === "session" ? "session" : "model";
  return (
    <div className="border border-border/60 rounded-sm bg-card/30 overflow-x-auto">
      <table className="w-full font-mono text-[12px]" data-testid="usage-table">
        <thead>
          <tr className="text-hairline text-muted-foreground border-b border-border/50">
            <th className="text-left font-normal px-4 py-2.5">{keyHeader}</th>
            <th className="text-right font-normal px-3 py-2.5">input</th>
            <th className="text-right font-normal px-3 py-2.5">output</th>
            <th className="text-right font-normal px-3 py-2.5">cache read</th>
            <th className="text-right font-normal px-3 py-2.5">cache create</th>
            <th className="text-right font-normal px-3 py-2.5">requests</th>
            <th className="text-right font-normal px-4 py-2.5">known cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="border-b border-border/30 last:border-b-0"
              data-testid={`usage-row-${r.key}`}
            >
              <td className="px-4 py-2 text-foreground/90 max-w-72">
                <KeyCell granularity={granularity} row={r} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatTokens(r.input_tokens)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatTokens(r.output_tokens)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {formatTokens(r.cache_read_tokens)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {formatTokens(r.cache_creation_tokens)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.requests}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatUsd(r.cost_usd_known)}
                {r.cost_usd_estimated_null_requests > 0 && (
                  <span className="text-muted-foreground" title="some requests carried no cost data">
                    *
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyCell({
  granularity,
  row,
}: {
  granularity: UsageGranularity;
  row: UsageRow;
}) {
  if (granularity !== "session") {
    return <span className="break-all">{row.key}</span>;
  }
  return (
    <Link
      href={`/sessions/${row.key}`}
      className="block min-w-0 hover:text-signal transition-colors"
      data-testid={`usage-session-link-${row.key}`}
    >
      <span className="block truncate">{row.session_title ?? row.key}</span>
      {row.session_title != null && (
        <span className="block truncate text-[10px] text-muted-foreground/70">
          {row.key}
        </span>
      )}
    </Link>
  );
}

function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}

function formatUsd(v: number): string {
  if (v === 0) return "$0.00";
  return v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`;
}
