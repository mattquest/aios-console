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
    };
    void load();
  }, []);

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-8 py-14 lg:py-20">
        <div className="grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 lg:col-span-8 space-y-6 animate-rise">
            <div className="flex items-center gap-3 text-hairline text-muted-foreground">
              <span className="size-1.5 rounded-full bg-signal animate-signal" />
              <span>agent runtime · session observer · v0.1</span>
            </div>
            <h1
              className="text-display text-[clamp(3.5rem,8vw,7.5rem)] leading-[0.9] tracking-[-0.04em]"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
            >
              Session-oriented
              <br />
              <span className="italic text-muted-foreground/90">
                intelligence.
              </span>
            </h1>
            <p className="max-w-xl font-sans text-[15px] leading-relaxed text-muted-foreground">
              Transparency is the product. Every model call, every tool
              dispatch, every triage decision lands in an append-only event
              log — and every one of those events is rendered live in the
              right-hand inspector. No black boxes. No hidden compaction. No
              magic.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Link
                href="/agents"
                className="group relative inline-flex items-center gap-2 rounded-sm border border-foreground/80 bg-foreground text-background px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-transparent hover:text-foreground transition-colors"
              >
                <span>Configure agent</span>
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
              <Link
                href="/environments"
                className="inline-flex items-center gap-2 rounded-sm border border-border px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground hover:border-foreground/60 transition-colors"
              >
                Environments
              </Link>
            </div>
          </div>

          <div
            className="col-span-12 lg:col-span-4 space-y-3 animate-rise"
            style={{ animationDelay: "120ms" }}
          >
            <Readout
              label="sessions"
              value={metrics.sessions}
              hint="active + archived"
            />
            <Readout
              label="agents"
              value={metrics.agents}
              hint="versioned configs"
            />
            <Readout
              label="environments"
              value={metrics.environments}
              hint="sandbox policies"
            />
          </div>
        </div>

        <div
          className="divider-h my-12 animate-rise"
          style={{ animationDelay: "220ms" }}
        />

        <div className="grid grid-cols-12 gap-6">
          <Capability
            seq="01"
            title="Event log, live."
            body="Every session is an append-only log in Postgres. The inspector tails it over SSE — new events, token deltas, span timings, triage verdicts — all at sub-second latency."
            delay={260}
          />
          <Capability
            seq="02"
            title="Model-agnostic."
            body="Point at any LiteLLM model URL — Claude, GPT, Ollama, MLX, OpenRouter, Moonshot — and the console doesn't care. Provider keys live on the backend; the frontend only needs a bearer."
            delay={340}
          />
          <Capability
            seq="03"
            title="Tools, unblocking."
            body="Every tool is implicitly async. The model stays responsive while tool tasks run in the background. Watch the span timeline, watch the deltas, watch the log — all at once."
            delay={420}
          />
        </div>

        <div
          className="mt-14 rounded-lg border border-border/70 bg-card/40 p-6 backdrop-blur-sm animate-rise"
          style={{ animationDelay: "520ms" }}
        >
          <div className="text-hairline text-muted-foreground mb-3">
            first run / 4 steps
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-[11px]">
            {[
              {
                n: "01",
                title: "Point at aios",
                body: "AIOS_URL + AIOS_API_KEY in .env.local",
              },
              {
                n: "02",
                title: "Create an agent",
                body: "LiteLLM model URL + system prompt + tools",
              },
              {
                n: "03",
                title: "Create an environment",
                body: "One named default is plenty",
              },
              {
                n: "04",
                title: "Open a session",
                body: "Watch the inspector light up",
              },
            ].map((s) => (
              <li
                key={s.n}
                className="flex flex-col gap-1 border-l border-border/60 pl-3"
              >
                <span className="text-signal tabular-nums">{s.n}</span>
                <span className="text-foreground text-[12px]">{s.title}</span>
                <span className="text-muted-foreground/80 leading-relaxed">
                  {s.body}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}

function Readout({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint: string;
}) {
  return (
    <div className="group relative border border-border/60 bg-card/30 rounded-sm px-4 py-3 transition-colors hover:border-signal/60 hover:bg-card/60">
      <div className="flex items-baseline justify-between">
        <span className="text-hairline text-muted-foreground">{label}</span>
        <span className="text-hairline text-muted-foreground/60">{hint}</span>
      </div>
      <div
        className={cn(
          "text-display text-5xl leading-none mt-1 tabular-nums",
          value === null ? "text-muted-foreground/40" : "text-foreground",
        )}
      >
        {value === null ? "—" : String(value).padStart(2, "0")}
      </div>
    </div>
  );
}

function Capability({
  seq,
  title,
  body,
  delay,
}: {
  seq: string;
  title: string;
  body: string;
  delay: number;
}) {
  return (
    <div
      className="col-span-12 md:col-span-4 space-y-3 animate-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3 text-hairline text-muted-foreground">
        <span className="tabular-nums text-signal">{seq}</span>
        <span className="flex-1 h-px bg-border/60" />
      </div>
      <h3 className="text-display text-2xl leading-tight tracking-tight">
        {title}
      </h3>
      <p className="font-sans text-[13px] text-muted-foreground leading-relaxed">
        {body}
      </p>
    </div>
  );
}
