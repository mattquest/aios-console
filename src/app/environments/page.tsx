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

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listEnvironments();
      setEnvironments(r.data);
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
              <span className="tabular-nums text-signal">03</span>
              <span className="h-px w-8 bg-border" />
              <span>resource · environments</span>
            </div>
            <h1
              className="text-display text-5xl tracking-tight"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
            >
              Environments
            </h1>
            <p className="font-sans text-sm text-muted-foreground max-w-xl">
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
          <div className="border border-dashed border-border/60 rounded-sm px-8 py-16 text-center space-y-4">
            <div
              className="text-display text-4xl text-muted-foreground/60"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
            >
              No environments yet
            </div>
            <p className="font-sans text-sm text-muted-foreground max-w-md mx-auto">
              Click{" "}
              <span className="text-foreground font-mono">
                + new environment
              </span>{" "}
              above. A default-named environment is all most setups need.
            </p>
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
                <div className="flex items-center gap-4 min-w-0">
                  <span className="font-mono text-[9px] text-muted-foreground/70 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className="text-display text-2xl tracking-tight"
                    style={{ fontVariationSettings: '"opsz" 36, "SOFT" 60' }}
                  >
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
