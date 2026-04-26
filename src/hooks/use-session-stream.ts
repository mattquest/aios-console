"use client";

import { useEffect, useReducer } from "react";
import type { AiosEvent } from "@/lib/types";

/**
 * Live session-stream reducer.
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

export interface StreamState {
  events: AiosEvent[];
  streamingContent: string;
  connected: boolean;
  error: string | null;
  done: boolean;
}

type Action =
  | { type: "event"; event: AiosEvent }
  | { type: "delta"; delta: string }
  | { type: "open" }
  | { type: "error"; error: string }
  | { type: "done" }
  | { type: "reset" };

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "event": {
      const existing = state.events.findIndex((e) => e.seq === action.event.seq);
      const next = [...state.events];
      if (existing >= 0) next[existing] = action.event;
      else next.push(action.event);
      next.sort((a, b) => a.seq - b.seq);
      // When an assistant message persists, clear the streaming buffer —
      // the final content is now in the event log.
      const isAssistant =
        action.event.kind === "message" &&
        (action.event.data as { role?: string }).role === "assistant";
      return {
        ...state,
        events: next,
        streamingContent: isAssistant ? "" : state.streamingContent,
      };
    }
    case "delta":
      return { ...state, streamingContent: state.streamingContent + action.delta };
    case "open":
      return { ...state, connected: true, error: null };
    case "error":
      return { ...state, connected: false, error: action.error };
    case "done":
      return { ...state, done: true, connected: false };
    case "reset":
      return {
        events: [],
        streamingContent: "",
        connected: false,
        error: null,
        done: false,
      };
  }
}

const initial: StreamState = {
  events: [],
  streamingContent: "",
  connected: false,
  error: null,
  done: false,
};

export function useSessionStream(sessionId: string): StreamState {
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    dispatch({ type: "reset" });
    // Pointing at the proxy keeps the bearer token server-side; the
    // proxy pipes bytes through without buffering (see the route handler).
    const url = `/api/aios/sessions/${sessionId}/stream`;
    const es = new EventSource(url);

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
      es.close();
    });

    es.addEventListener("error", () => {
      dispatch({
        type: "error",
        error: "SSE disconnected — will retry automatically",
      });
    });

    return () => es.close();
  }, [sessionId]);

  return state;
}
