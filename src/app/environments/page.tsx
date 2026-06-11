"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Environment } from "@/lib/types";
import { toErrorMessage } from "@/lib/utils";
import { NewEnvironmentDialog } from "@/components/new-environment-dialog";

export default function EnvironmentsPage() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All state writes happen in promise callbacks, so the mount effect
  // never sets state synchronously (initial state already shows loading).
  const load = useCallback(
    () =>
      api
        .listEnvironments()
        .then((r) => {
          setEnvironments(r.data);
          setError(null);
        })
        .catch((e: unknown) => setError(toErrorMessage(e)))
        .finally(() => setLoading(false)),
    [],
  );

  // Event-handler path (dialog creates): bring the spinner back
  // immediately before refetching.
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    void load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-10 space-y-6 animate-rise">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2 text-pico text-muted-foreground">
              <span className="text-signal">{"//"}</span>
              <span>resource/environments</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="tabular-nums normal-case tracking-[0.12em]">
                /03
              </span>
            </div>
            <h1 className="text-display text-[clamp(1.5rem,2.6vw,2rem)] leading-tight tracking-[-0.025em] text-foreground">
              <span className="text-muted-foreground/50">›</span> environments
              <span className="text-muted-foreground/40 font-normal">
                {" "}
                — sandbox · network · mounts
              </span>
            </h1>
            <p className="font-sans text-[13.5px] text-muted-foreground max-w-xl leading-[1.6]">
              Sandbox container configuration — pre-installed packages, network
              policies, bind mounts. Most setups only need one named{" "}
              <span className="font-mono text-foreground">default</span>.
            </p>
          </div>
          <NewEnvironmentDialog onCreated={reload} />
        </header>

        <div className="divider-h" />

        {loading && (
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="bracket-label">loading</span>…
          </div>
        )}
        {error && (
          <div
            data-testid="environments-error"
            className="border border-signal-alert/40 bg-signal-alert/5 rounded-sm px-4 py-3 font-mono text-[11px] text-signal-alert break-all"
          >
            <span className="bracket-label">fault</span>
            {error}
          </div>
        )}
        {!loading && !error && environments.length === 0 && (
          <div className="rounded-sm border border-border/60 bg-card/30 backdrop-blur-sm overflow-hidden max-w-2xl">
            <div className="px-4 py-2 flex items-center justify-between border-b border-border/50 text-pico text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                <span>resource/environments</span>
              </div>
              <span className="normal-case tracking-[0.12em]">empty</span>
            </div>
            <div className="px-4 py-5 space-y-3">
              <div className="font-mono text-[12px] text-foreground/90 leading-relaxed">
                <span className="text-signal">$</span>{" "}
                <span className="text-muted-foreground">
                  no environments registered.
                </span>
              </div>
              <p className="font-sans text-[13px] text-muted-foreground max-w-md leading-[1.6]">
                Click{" "}
                <span className="text-foreground font-mono">
                  + new environment
                </span>{" "}
                above. A default-named environment is all most setups need.
              </p>
            </div>
          </div>
        )}
        {!loading && !error && environments.length > 0 && (
          <div className="space-y-3" data-testid="environments-list">
            {environments.map((e, i) => (
              <div
                key={e.id}
                className="group border border-border/60 rounded-sm bg-card/30 hover:bg-card/60 hover:border-signal/40 transition-colors p-5 flex items-center justify-between gap-6"
                data-testid={`environment-${e.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-[9px] text-muted-foreground/60 tabular-nums">
                    /{String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-mono text-[15px] tracking-[-0.01em] text-foreground">
                    {e.name}
                  </h3>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground truncate">
                  {e.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
