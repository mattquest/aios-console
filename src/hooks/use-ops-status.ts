"use client";

import { useEffect, useState } from "react";
import type { OpsStatus } from "@/lib/ops-types";

const INITIAL: OpsStatus | null = null;

export function useOpsStatus(intervalMs = 15_000) {
  const [ops, setOps] = useState<OpsStatus | null>(INITIAL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const resp = await fetch("/api/ops/status");
        if (!resp.ok) {
          const body = await resp.text();
          throw new Error(`${resp.status}: ${body}`);
        }
        const data = (await resp.json()) as OpsStatus;
        if (!cancelled) {
          setOps(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "ops probe failed");
        }
      }
    };
    void probe();
    const id = setInterval(probe, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { ops, error };
}