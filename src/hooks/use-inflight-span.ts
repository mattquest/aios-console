"use client";

import { useEffect, useState } from "react";
import type { AiosEvent } from "@/lib/types";

interface InFlightSpan {
  name: string;
  startedAt: number;
  elapsedMs: number;
}

/**
 * Find the most recent ``*_request_start`` span that has no matching
 * ``*_request_end`` yet. Drives the "generating…" badge: when MLX
 * / local model calls take minutes and the provider isn't streaming,
 * the UI would otherwise show a blank pane with no signal that work
 * is happening. Derived from event data instead of session.status
 * because status transitions can lag behind the actual model call.
 */
export function useInFlightSpan(events: AiosEvent[]): InFlightSpan | null {
  const [now, setNow] = useState(() => Date.now());

  const start = findInFlightStart(events);
  const startId = start?.id;

  useEffect(() => {
    if (!startId) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startId]);

  if (!start) return null;
  const startedAt = new Date(start.created_at).getTime();
  const name =
    (start.data as { event?: string }).event?.replace(/_start$/, "") ??
    "generating";
  return {
    name,
    startedAt,
    elapsedMs: Math.max(0, now - startedAt),
  };
}

function findInFlightStart(events: AiosEvent[]): AiosEvent | null {
  const endedIds = new Set<string>();
  for (const e of events) {
    if (e.kind !== "span") continue;
    const d = e.data as {
      event?: string;
      model_request_start_id?: string;
    };
    if (d.event?.endsWith("_end") && d.model_request_start_id) {
      endedIds.add(d.model_request_start_id);
    }
  }
  let latest: AiosEvent | null = null;
  for (const e of events) {
    if (e.kind !== "span") continue;
    const d = e.data as { event?: string };
    // Only consider *_request_start spans (matches the docstring intent).
    // Bare `_start` matches sweep_start / step_start / context_build_start too,
    // whose `_end` events carry their own *_start_id field (sweep_start_id,
    // step_start_id, ...), which the endedIds loop above doesn't track —
    // so those start events stay "in-flight" forever, leaving the
    // post-turn sweep's step_start permanently lit up as "generating".
    if (!d.event?.endsWith("_request_start")) continue;
    if (endedIds.has(e.id)) continue;
    if (!latest || e.seq > latest.seq) latest = e;
  }
  return latest;
}
