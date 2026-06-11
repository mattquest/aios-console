"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { api } from "@/lib/client";
import type { AiosEvent } from "@/lib/types";

/**
 * Live session transcript: paged backlog + SSE tail.
 *
 * On mount the hook loads the newest page of the event log
 * (``GET /events?dir=backward&limit=100``), then opens the SSE stream at
 * ``after_seq=<newest loaded seq>`` so aios only replays what the page
 * didn't cover. ``loadEarlier`` pages older history in via the cursor the
 * backward listing returned.
 *
 * The aios SSE endpoint emits three frame types:
 *
 *   event  → full persisted event row (one per append)
 *   delta  → transient per-token delta, shape ``{delta: string}``
 *   done   → session terminated; stream ends
 *
 * We accumulate persisted events by ``seq`` (upserting so re-deliveries
 * during reconnect are idempotent) and buffer streaming deltas into a
 * separate ``streamingContent`` string. When the final assistant event
 * arrives its ``content`` replaces the streaming buffer naturally —
 * since the assistant message ends up in ``events``, callers render the
 * two slots differently (see ``Chat``).
 */

const FIRST_PAGE_LIMIT = 100;

export interface StreamState {
  events: AiosEvent[];
  streamingContent: string;
  connected: boolean;
  error: string | null;
  done: boolean;
  /** Older history exists beyond the oldest loaded event. */
  hasEarlier: boolean;
  loadingEarlier: boolean;
}

export interface SessionStream extends StreamState {
  /** Page one chunk of older history in. Resolves when it landed. */
  loadEarlier: () => Promise<void>;
}

type Action =
  | { type: "event"; event: AiosEvent }
  | { type: "page"; events: AiosEvent[]; hasEarlier: boolean }
  | { type: "loading-earlier"; loading: boolean }
  | { type: "delta"; delta: string }
  | { type: "open" }
  | { type: "error"; error: string }
  | { type: "done" }
  | { type: "reset" };

function upsert(events: AiosEvent[], incoming: AiosEvent[]): AiosEvent[] {
  const bySeq = new Map<number, AiosEvent>();
  for (const e of events) bySeq.set(e.seq, e);
  for (const e of incoming) bySeq.set(e.seq, e);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "event": {
      // When an assistant message persists, clear the streaming buffer —
      // the final content is now in the event log.
      const isAssistant =
        action.event.kind === "message" &&
        (action.event.data as { role?: string }).role === "assistant";
      return {
        ...state,
        events: upsert(state.events, [action.event]),
        streamingContent: isAssistant ? "" : state.streamingContent,
      };
    }
    case "page":
      return {
        ...state,
        events: upsert(state.events, action.events),
        hasEarlier: action.hasEarlier,
        loadingEarlier: false,
      };
    case "loading-earlier":
      return { ...state, loadingEarlier: action.loading };
    case "delta":
      return { ...state, streamingContent: state.streamingContent + action.delta };
    case "open":
      return { ...state, connected: true, error: null };
    case "error":
      return { ...state, connected: false, error: action.error };
    case "done":
      return { ...state, done: true, connected: false };
    case "reset":
      return { ...initial };
  }
}

const initial: StreamState = {
  events: [],
  streamingContent: "",
  connected: false,
  error: null,
  done: false,
  hasEarlier: false,
  loadingEarlier: false,
};

export function useSessionStream(sessionId: string): SessionStream {
  const [state, dispatch] = useReducer(reducer, initial);
  // Cursor for the next older page — lives in a ref because only the
  // loadEarlier callback reads it; renders don't.
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    cursorRef.current = null;
    dispatch({ type: "reset" });

    const open = (afterSeq: number) => {
      if (cancelled) return;
      es = new EventSource(
        `/api/aios/sessions/${sessionId}/stream?after_seq=${afterSeq}`,
      );

      es.addEventListener("open", () => dispatch({ type: "open" }));

      es.addEventListener("event", (ev) => {
        try {
          const parsed = JSON.parse((ev as MessageEvent).data) as AiosEvent;
          dispatch({ type: "event", event: parsed });
        } catch {
          // Malformed frame — keep the connection alive but log to console
          // so a dev poking at network traffic sees it.
          console.warn("aios: malformed event frame", ev);
        }
      });

      es.addEventListener("delta", (ev) => {
        try {
          const parsed = JSON.parse((ev as MessageEvent).data) as { delta?: string };
          if (typeof parsed.delta === "string") {
            dispatch({ type: "delta", delta: parsed.delta });
          }
        } catch {
          console.warn("aios: malformed delta frame", ev);
        }
      });

      es.addEventListener("done", () => {
        dispatch({ type: "done" });
        es?.close();
      });

      es.addEventListener("error", () => {
        dispatch({
          type: "error",
          error: "SSE disconnected — will retry automatically",
        });
      });
    };

    // Newest page first, then tail from where it ended. If the backlog
    // fetch fails (older aios, transient error) fall back to a full
    // replay from seq 0 — slower, never wrong.
    api
      .listEvents(sessionId, { dir: "backward", limit: FIRST_PAGE_LIMIT })
      .then((page) => {
        if (cancelled) return;
        cursorRef.current = page.has_more ? page.next_cursor : null;
        dispatch({
          type: "page",
          events: page.data,
          hasEarlier: page.has_more && page.next_cursor !== null,
        });
        const newestSeq = page.data.reduce((m, e) => Math.max(m, e.seq), 0);
        open(newestSeq);
      })
      .catch(() => open(0));

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [sessionId]);

  const loadEarlier = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    cursorRef.current = null; // guard against double-clicks while in flight
    dispatch({ type: "loading-earlier", loading: true });
    try {
      const page = await api.listEvents(sessionId, { cursor });
      cursorRef.current = page.has_more ? page.next_cursor : null;
      dispatch({
        type: "page",
        events: page.data,
        hasEarlier: page.has_more && page.next_cursor !== null,
      });
    } catch {
      // Restore the cursor so the affordance can be retried.
      cursorRef.current = cursor;
      dispatch({ type: "loading-earlier", loading: false });
    }
  }, [sessionId]);

  return { ...state, loadEarlier };
}
