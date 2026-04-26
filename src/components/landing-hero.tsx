"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface Metrics {
  sessions: number | null;
  agents: number | null;
  environments: number | null;
}

export function LandingHero() {
  const [metrics, setMetrics] = useState<Metrics>({
    sessions: null,
    agents: null,
    environments: null,
  });
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [s, a, e] = await Promise.allSettled([
        api.listSessions(),
        api.listAgents(),
        api.listEnvironments(),
      ]);
      if (cancelled) return;
      setMetrics({
        sessions: s.status === "fulfilled" ? s.value.data.length : null,
        agents: a.status === "fulfilled" ? a.value.data.length : null,
        environments: e.status === "fulfilled" ? e.value.data.length : null,
      });
      setLoadedAt(new Date());
    };
    void load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-14 space-y-10">
        {/* ── telemetry strip ─────────────────────────────────────── */}
        <section
          aria-label="runtime telemetry"
          className="animate-rise"
        >
          <div className="flex items-center gap-3 text-pico text-muted-foreground mb-3">
            <span className="size-1.5 rounded-full bg-signal animate-signal" />
            <span>runtime/telemetry</span>
            <span className="flex-1 h-px bg-border/50" />
            <span className="tabular-nums normal-case tracking-[0.12em]">
              {loadedAt
                ? `synced ${loadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`
                : "syncing…"}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 border border-border/60 bg-card/30 backdrop-blur-sm rounded-sm overflow-hidden">
            <Readout
              label="sessions"
              suffix="logs"
              value={metrics.sessions}
              tone="signal"
            />
            <Readout
              label="agents"
              suffix="versioned"
              value={metrics.agents}
              tone="info"
            />
            <Readout
              label="environments"
              suffix="sandboxes"
              value={metrics.environments}
              tone="system"
            />
            <Readout
              label="status"
              suffix="all systems"
              value="ready"
              tone="signal"
            />
          </div>
        </section>

        {/* ── headline + CTA ──────────────────────────────────────── */}
        <section
          className="grid grid-cols-12 gap-6 items-start animate-rise"
          style={{ animationDelay: "120ms" }}
        >
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="flex items-center gap-2 text-pico text-muted-foreground/80">
              <span className="text-signal">//</span>
              <span>mission_brief</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="normal-case tracking-[0.12em]">
                rev 0.1.0 · stable
              </span>
            </div>
            <h1 className="text-display text-[clamp(1.5rem,2.6vw,2.05rem)] leading-[1.2] tracking-[-0.025em] text-foreground max-w-3xl">
              agent runtime, under glass.{" "}
              <span className="text-muted-foreground/70">
                operate, observe, and instrument the model layer without losing
                the receipts.
              </span>
            </h1>
            <p className="max-w-2xl font-sans text-[13.5px] leading-[1.65] text-muted-foreground">
              Every model call, every tool dispatch, every triage decision lands
              in an append-only event log — rendered live in the inspector. No
              hidden compaction. No magic.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                href="/agents"
                className="group inline-flex items-center gap-2 rounded-sm border border-foreground/85 bg-foreground text-background px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] hover:bg-transparent hover:text-foreground transition-colors"
              >
                <span aria-hidden className="text-signal">
                  ▸
                </span>
                <span>configure agent</span>
              </Link>
              <Link
                href="/environments"
                className="inline-flex items-center gap-2 rounded-sm border border-border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground hover:border-foreground/60 transition-colors"
              >
                environments
              </Link>
              <a
                href="https://github.com/aios"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                <span aria-hidden>↗</span>
                docs
              </a>
            </div>
          </div>

          <BuildPanel className="col-span-12 lg:col-span-4 lg:mt-6" />
        </section>

        {/* ── modules ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 text-pico text-muted-foreground">
            <span className="text-signal">//</span>
            <span>modules</span>
            <span className="flex-1 h-px bg-border/50" />
            <span className="tabular-nums normal-case tracking-[0.12em]">
              03 / 03
            </span>
          </div>
          <div className="grid grid-cols-12 gap-3">
            <Module
              seq="01"
              ns="tail.events"
              tone="signal"
              title="Append-only event log"
              body="Every session is an append-only stream in Postgres. The inspector tails it over SSE — token deltas, span timings, triage verdicts — at sub-second latency."
              delay={220}
            />
            <Module
              seq="02"
              ns="model.agnostic"
              tone="info"
              title="Any LiteLLM endpoint"
              body="Point at Claude, GPT, Ollama, MLX, OpenRouter, Moonshot. Provider keys live on the backend; the frontend only needs a bearer token."
              delay={300}
            />
            <Module
              seq="03"
              ns="tools.unblocking"
              tone="system"
              title="Implicitly async tools"
              body="The model stays responsive while tool tasks run in the background. Watch the span timeline, the deltas, and the log — concurrently, on one screen."
              delay={380}
            />
          </div>
        </section>

        {/* ── boot sequence ───────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 text-pico text-muted-foreground">
            <span className="text-signal">//</span>
            <span>boot.sequence</span>
            <span className="flex-1 h-px bg-border/50" />
            <span className="tabular-nums normal-case tracking-[0.12em]">
              first run
            </span>
          </div>
          <div
            className="rounded-sm border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden animate-rise"
            style={{ animationDelay: "480ms" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border/50">
              {[
                {
                  n: "01",
                  cmd: "env link",
                  body: "AIOS_URL + AIOS_API_KEY in .env.local",
                },
                {
                  n: "02",
                  cmd: "agent create",
                  body: "LiteLLM model URL · system prompt · tools",
                },
                {
                  n: "03",
                  cmd: "env create",
                  body: "One named default is plenty",
                },
                {
                  n: "04",
                  cmd: "session open",
                  body: "Watch the inspector light up",
                },
              ].map((s) => (
                <div key={s.n} className="p-4 space-y-1.5 group">
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="text-signal tabular-nums">{s.n}</span>
                    <span className="text-muted-foreground/50">›</span>
                    <span className="text-foreground/90">{s.cmd}</span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/80 leading-relaxed">
                    {s.body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="text-pico text-muted-foreground/40 flex items-center gap-2 pt-4">
          <span className="size-1 rounded-full bg-signal/50" />
          <span>aios.console · v0.1 · build channel: stable</span>
        </div>
      </div>
    </main>
  );
}

const TONE: Record<
  "signal" | "info" | "system" | "warn",
  { dot: string; text: string; bar: string }
> = {
  signal: {
    dot: "bg-signal",
    text: "text-signal",
    bar: "from-signal/40 via-signal/0 to-signal/0",
  },
  info: {
    dot: "bg-signal-info",
    text: "text-signal-info",
    bar: "from-signal-info/40 via-signal-info/0 to-signal-info/0",
  },
  system: {
    dot: "bg-signal-system",
    text: "text-signal-system",
    bar: "from-signal-system/40 via-signal-system/0 to-signal-system/0",
  },
  warn: {
    dot: "bg-signal-warn",
    text: "text-signal-warn",
    bar: "from-signal-warn/40 via-signal-warn/0 to-signal-warn/0",
  },
};

function Readout({
  label,
  suffix,
  value,
  tone,
}: {
  label: string;
  suffix: string;
  value: number | string | null;
  tone: keyof typeof TONE;
}) {
  const t = TONE[tone];
  const empty = value === null;
  const isNumeric = typeof value === "number";
  const display = isNumeric
    ? String(value).padStart(2, "0")
    : (value ?? "—");
  return (
    <div className="relative px-4 py-3 border-r last:border-r-0 border-border/60 group overflow-hidden">
      {/* sweep bar — fires once on mount */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r animate-scan pointer-events-none",
          t.bar,
        )}
      />
      <div className="flex items-center justify-between gap-2 text-pico text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1 rounded-full", t.dot)} />
          <span>{label}</span>
        </div>
        <span className="normal-case tracking-[0.14em] text-muted-foreground/50">
          {suffix}
        </span>
      </div>
      <div className="mt-2">
        <span
          className={cn(
            "text-readout leading-none",
            isNumeric
              ? "text-[1.9rem]"
              : "text-[1.05rem] uppercase tracking-[0.04em]",
            empty ? "text-muted-foreground/30" : "text-foreground",
          )}
        >
          {display}
        </span>
      </div>
    </div>
  );
}

function Module({
  seq,
  ns,
  tone,
  title,
  body,
  delay,
}: {
  seq: string;
  ns: string;
  tone: keyof typeof TONE;
  title: string;
  body: string;
  delay: number;
}) {
  const t = TONE[tone];
  return (
    <div
      className="col-span-12 md:col-span-4 group relative border border-border/60 bg-card/30 hover:bg-card/55 hover:border-foreground/30 transition-colors rounded-sm p-4 space-y-2.5 animate-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 font-mono text-[10px]">
        <span className={cn("tabular-nums", t.text)}>/{seq}</span>
        <span className="text-muted-foreground/90">{ns}</span>
        <span aria-hidden className="ml-auto text-muted-foreground/30">
          ◢
        </span>
      </div>
      <div className="h-px bg-border/60 group-hover:bg-border transition-colors" />
      <h3 className="font-mono text-[13px] tracking-[-0.01em] text-foreground leading-snug">
        {title}
      </h3>
      <p className="font-sans text-[12.5px] text-muted-foreground leading-[1.6]">
        {body}
      </p>
    </div>
  );
}

function BuildPanel({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "rounded-sm border border-border/60 bg-card/30 backdrop-blur-sm p-4 space-y-2 font-mono text-[10px]",
        className,
      )}
      aria-label="build info"
    >
      <div className="flex items-center justify-between text-pico text-muted-foreground">
        <span>build/info</span>
        <span className="text-signal/80 normal-case tracking-[0.12em]">
          stable
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[10px]">
        <BuildRow k="runtime" v="next 16 · react 19" />
        <BuildRow k="transport" v="sse · keep-alive 30s" />
        <BuildRow k="store" v="postgres · append-only" />
        <BuildRow k="auth" v="bearer · backend-held" />
      </dl>
      <div className="pt-1 mt-1 border-t border-border/50 flex items-center gap-1.5 text-muted-foreground/70">
        <span className="size-1 rounded-full bg-signal animate-signal" />
        <span>ready for input</span>
      </div>
    </aside>
  );
}

function BuildRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground/60 uppercase tracking-[0.14em]">
        {k}
      </dt>
      <dd className="text-foreground/90 truncate">{v}</dd>
    </>
  );
}
