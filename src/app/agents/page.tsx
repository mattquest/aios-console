"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Agent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
              agents
            </h1>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              model binding + system prompt + tools. Versioned — every update
              creates an immutable snapshot.
            </p>
          </div>
          <NewAgentDialog onCreated={reload} />
        </header>
        {loading && (
          <div className="font-mono text-xs text-muted-foreground">
            loading…
          </div>
        )}
        {error && (
          <div
            data-testid="agents-error"
            className="font-mono text-xs text-destructive break-all border border-destructive/40 rounded p-2"
          >
            {error}
          </div>
        )}
        {!loading && !error && agents.length === 0 && (
          <div className="font-mono text-xs text-muted-foreground border border-dashed border-border rounded p-8 text-center space-y-2">
            <div>no agents yet</div>
            <div className="text-muted-foreground/60">
              click <span className="text-foreground">new agent</span> above to
              create one.
            </div>
          </div>
        )}
        {!loading && !error && agents.length > 0 && (
          <div className="space-y-2" data-testid="agents-list">
            {agents.map((a) => (
              <AgentRow key={a.id} agent={a} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  return (
    <div
      className="border border-border rounded-md p-3 font-mono text-xs bg-card/30"
      data-testid={`agent-${agent.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold">{agent.name}</span>
          <Badge variant="outline" className="text-[9px] uppercase">
            v{agent.version}
          </Badge>
          {agent.triage && (
            <Badge
              variant="outline"
              className="text-[9px] uppercase text-emerald-300 border-emerald-500/40"
            >
              triage
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground truncate">{agent.id}</span>
      </div>
      <div className="mt-1 text-muted-foreground truncate">{agent.model}</div>
      {agent.system && (
        <div className="mt-2 text-[11px] text-foreground/80 line-clamp-3 whitespace-pre-wrap">
          {agent.system}
        </div>
      )}
    </div>
  );
}
