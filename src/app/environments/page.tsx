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
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
              environments
            </h1>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              sandbox container config. most setups only need one named
              default.
            </p>
          </div>
          <NewEnvironmentDialog onCreated={reload} />
        </header>
        {loading && (
          <div className="font-mono text-xs text-muted-foreground">
            loading…
          </div>
        )}
        {error && (
          <div
            data-testid="environments-error"
            className="font-mono text-xs text-destructive break-all border border-destructive/40 rounded p-2"
          >
            {error}
          </div>
        )}
        {!loading && !error && environments.length === 0 && (
          <div className="font-mono text-xs text-muted-foreground border border-dashed border-border rounded p-8 text-center space-y-2">
            <div>no environments yet</div>
            <div className="text-muted-foreground/60">
              click <span className="text-foreground">new environment</span>{" "}
              above to create one.
            </div>
          </div>
        )}
        {!loading && !error && environments.length > 0 && (
          <div
            className="space-y-2"
            data-testid="environments-list"
          >
            {environments.map((e) => (
              <div
                key={e.id}
                className="border border-border rounded-md p-3 font-mono text-xs bg-card/30"
                data-testid={`environment-${e.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{e.name}</span>
                  <span className="text-muted-foreground">{e.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
