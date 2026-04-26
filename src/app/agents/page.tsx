"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Agent } from "@/lib/types";
import { toErrorMessage } from "@/lib/utils";
import { NewAgentDialog } from "@/components/new-agent-dialog";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listAgents();
      setAgents(r.data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-10 space-y-6 animate-rise">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2 text-pico text-muted-foreground">
              <span className="text-signal">//</span>
              <span>resource/agents</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="tabular-nums normal-case tracking-[0.12em]">
                /02
              </span>
            </div>
            <h1 className="text-display text-[clamp(1.5rem,2.6vw,2rem)] leading-tight tracking-[-0.025em] text-foreground">
              <span className="text-muted-foreground/50">›</span> agents
              <span className="text-muted-foreground/40 font-normal">
                {" "}
                — model · prompt · tools
              </span>
            </h1>
            <p className="font-sans text-[13.5px] text-muted-foreground max-w-xl leading-[1.6]">
              A model binding, a system prompt, a set of tools. Every update
              creates an immutable version snapshot — sessions can pin to one,
              or float on latest.
            </p>
          </div>
          <NewAgentDialog onCreated={reload} />
        </header>

        <div className="divider-h" />

        {loading && <BlockState label="loading" />}
        {error && (
          <div
            data-testid="agents-error"
            className="border border-signal-alert/40 bg-signal-alert/5 rounded-sm px-4 py-3 font-mono text-[11px] text-signal-alert break-all"
          >
            <span className="bracket-label">fault</span>
            {error}
          </div>
        )}
        {!loading && !error && agents.length === 0 && (
          <EmptyAgents />
        )}
        {!loading && !error && agents.length > 0 && (
          <div className="space-y-3" data-testid="agents-list">
            {agents.map((a, i) => (
              <AgentRow key={a.id} agent={a} index={i} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function AgentRow({ agent, index }: { agent: Agent; index: number }) {
  return (
    <div
      className="group border border-border/60 rounded-sm bg-card/30 hover:bg-card/60 hover:border-signal/40 transition-colors p-5"
      data-testid={`agent-${agent.id}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 md:col-span-5 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-muted-foreground/60 tabular-nums">
              /{String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="font-mono text-[15px] tracking-[-0.01em] text-foreground">
              {agent.name}
            </h3>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/70">
            {agent.id}
          </div>
        </div>

        <div className="col-span-6 md:col-span-5 space-y-1">
          <div className="text-hairline text-muted-foreground">model</div>
          <div className="font-mono text-[12px] text-foreground/90 break-all">
            {agent.model}
          </div>
        </div>

        <div className="col-span-6 md:col-span-2 space-y-1 md:text-right">
          <div className="text-hairline text-muted-foreground">version</div>
          <div className="text-readout text-2xl tabular-nums text-foreground">
            v{agent.version}
          </div>
          {agent.triage && (
            <div className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-signal border border-signal/40 px-1.5 py-0.5 rounded-sm">
              <span className="size-1 rounded-full bg-signal" />
              triage
            </div>
          )}
        </div>
      </div>
      {agent.system && (
        <>
          <div className="divider-h my-4" />
          <p className="font-sans text-[12px] text-foreground/80 leading-relaxed line-clamp-3 whitespace-pre-wrap">
            {agent.system}
          </p>
        </>
      )}
    </div>
  );
}

function EmptyAgents() {
  return (
    <div className="rounded-sm border border-border/60 bg-card/30 backdrop-blur-sm overflow-hidden max-w-2xl">
      <div className="px-4 py-2 flex items-center justify-between border-b border-border/50 text-pico text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          <span>resource/agents</span>
        </div>
        <span className="normal-case tracking-[0.12em]">empty</span>
      </div>
      <div className="px-4 py-5 space-y-3">
        <div className="font-mono text-[12px] text-foreground/90 leading-relaxed">
          <span className="text-signal">$</span>{" "}
          <span className="text-muted-foreground">no agents registered.</span>
        </div>
        <p className="font-sans text-[13px] text-muted-foreground max-w-md leading-[1.6]">
          Click{" "}
          <span className="text-foreground font-mono">+ new agent</span> above.
          Any LiteLLM-compatible model URL works.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            "anthropic/claude-sonnet-4-6",
            "openai/gpt-5",
            "ollama/llama3.3",
            "openrouter/moonshot-v1",
          ].map((m) => (
            <span
              key={m}
              className="font-mono text-[10px] px-2 py-1 rounded-sm border border-border/60 bg-background/50 text-foreground/80"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockState({ label }: { label: string }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
      <span className="bracket-label">{label}</span>…
    </div>
  );
}
