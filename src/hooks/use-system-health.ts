"use client";

/**
 * System-health poller for the top-nav status strip.
 *
 * Unlike a probe that overwrites its state every tick (and so can only say
 * "down", never "down since when"), this hook holds a per-component
 * ``downSince`` timestamp: set on the up→down transition (seeded from the
 * backend's last heartbeat when present, else the probe's wall clock),
 * carried across ticks while the component stays down, cleared on recovery.
 */

import { useEffect, useState } from "react";
import { getHealthReady } from "@/lib/client";
import type { HealthReady } from "@/lib/types";

export interface HealthCell {
  up: boolean;
  /** Epoch ms of when the component went down; null while up. */
  downSince: number | null;
}

export interface ConnectionHealth extends HealthCell {
  id: string;
  connector: string;
}

export interface SystemHealth {
  /**
   * Whole-strip state: probing until the first probe lands, error when the
   * api itself is unreachable, degraded when the api answered but the
   * worker or a connection is down, ok otherwise.
   */
  phase: "probing" | "ok" | "degraded" | "error";
  /** Round-trip of the last successful health fetch; null when down. */
  latencyMs: number | null;
  /** Wall clock of the last completed probe — anchors "down for" math. */
  checkedAt: number | null;
  api: HealthCell;
  /** null = unknown (still probing, endpoint not deployed, or api down). */
  worker: HealthCell | null;
  connections: ConnectionHealth[] | null;
}

const INITIAL: SystemHealth = {
  phase: "probing",
  latencyMs: null,
  checkedAt: null,
  api: { up: true, downSince: null },
  worker: null,
  connections: null,
};

/** Carry downSince across ticks; seed it on the up→down edge. */
function nextCell(
  prev: HealthCell | null | undefined,
  up: boolean,
  lastHeartbeat: string | null,
  now: number,
): HealthCell {
  if (up) return { up: true, downSince: null };
  if (prev && !prev.up && prev.downSince !== null) {
    return { up: false, downSince: prev.downSince };
  }
  const fromHeartbeat = lastHeartbeat ? Date.parse(lastHeartbeat) : NaN;
  return {
    up: false,
    downSince: Number.isFinite(fromHeartbeat) ? fromHeartbeat : now,
  };
}

function fold(
  prev: SystemHealth,
  body: HealthReady | null,
  latencyMs: number,
  checkedAt: number,
): SystemHealth {
  const api: HealthCell = { up: true, downSince: null };
  if (!body) {
    // 404 from the proxy: aios is reachable but doesn't expose
    // /v1/health/ready yet — api up, everything else unknown.
    return { phase: "ok", latencyMs, checkedAt, api, worker: null, connections: null };
  }
  const worker = nextCell(
    prev.worker,
    body.worker.alive,
    body.worker.last_heartbeat,
    checkedAt,
  );
  const prevById = new Map((prev.connections ?? []).map((c) => [c.id, c]));
  const connections = body.connections.map((c) => ({
    id: c.id,
    connector: c.connector,
    ...nextCell(prevById.get(c.id), c.alive, c.last_heartbeat_at, checkedAt),
  }));
  const anyDown = !worker.up || connections.some((c) => !c.up);
  return {
    phase: anyDown ? "degraded" : "ok",
    latencyMs,
    checkedAt,
    api,
    worker,
    connections,
  };
}

export function useSystemHealth(intervalMs = 10_000): SystemHealth {
  const [health, setHealth] = useState<SystemHealth>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const t0 = performance.now();
      try {
        const { body } = await getHealthReady();
        const latencyMs = Math.round(performance.now() - t0);
        const checkedAt = Date.now();
        if (!cancelled) {
          setHealth((prev) => fold(prev, body, latencyMs, checkedAt));
        }
      } catch {
        // Network-level failure, or no readiness body at all: the api cell
        // goes down; worker/connector state is unknowable, so drop those
        // cells rather than show stale "online" readings.
        const checkedAt = Date.now();
        if (!cancelled) {
          setHealth((prev) => ({
            phase: "error",
            latencyMs: null,
            checkedAt,
            api: nextCell(prev.api, false, null, checkedAt),
            worker: null,
            connections: null,
          }));
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

  return health;
}
