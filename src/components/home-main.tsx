"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { ErrorBanner } from "@/components/error-banner";
import { FirstRunWizard } from "@/components/first-run-wizard";
import { LandingHero } from "@/components/landing-hero";

/**
 * Home main pane: probes the backend once and picks the right face —
 * the guided first-run wizard when zero agents exist, the landing hero
 * otherwise, a plain-language banner when the probe itself fails.
 */
export function HomeMain() {
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  const probe = useCallback(
    () =>
      api
        .listAgents()
        .then((r) => {
          setAgentCount(r.data.length);
          setError(null);
        })
        .catch((e: unknown) => setError(e)),
    [],
  );

  useEffect(() => {
    void probe();
  }, [probe]);

  if (error != null) {
    return (
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-10">
          <ErrorBanner
            error={error}
            testId="home-error"
            onRetry={() => {
              setError(null);
              setAgentCount(null);
              void probe();
            }}
          />
        </div>
      </main>
    );
  }

  if (agentCount === null) {
    return (
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-10 flex items-center gap-2 text-pico text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-signal-warn animate-signal" />
          <span>probing backend…</span>
        </div>
      </main>
    );
  }

  return agentCount === 0 ? <FirstRunWizard /> : <LandingHero />;
}
