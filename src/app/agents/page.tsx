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
      <div className="max-w-5xl mx-auto px-8 py-10 space-y-6 animate-rise">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-hairline text-muted-foreground">
              <span className="tabular-nums text-signal">02</span>
              <span className="h-px w-8 bg-border" />
              <span>resource · agents</span>
            </div>
            <h1
              className="text-display text-5xl tracking-tight"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
            >
              Agents
            </h1>
            <p className="font-sans text-sm text-muted-foreground max-w-xl">
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
            <span className="font-mono text-[9px] text-muted-foreground/70 tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3
              className="text-display text-2xl tracking-tight"
              style={{ fontVariationSettings: '"opsz" 36, "SOFT" 60' }}
            >
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
          <div
            className="text-display text-3xl tabular-nums text-foreground"
            style={{ fontVariationSettings: '"opsz" 48' }}
          >
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
    <div className="border border-dashed border-border/60 rounded-sm px-8 py-16 text-center space-y-4">
      <div
        className="text-display text-4xl text-muted-foreground/60"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
      >
        No agents yet
      </div>
      <p className="font-sans text-sm text-muted-foreground max-w-md mx-auto">
        Click <span className="text-foreground font-mono">+ new agent</span>{" "}
        above. Any LiteLLM-compatible model URL works —{" "}
        <span className="font-mono text-foreground/80">
          anthropic/claude-sonnet-4-6
        </span>
        ,{" "}
        <span className="font-mono text-foreground/80">
          openai/gpt-5
        </span>
        , local Ollama / MLX, whatever.
      </p>
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
