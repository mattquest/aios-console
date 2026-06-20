/**
 * Module-level snapshot of the most recently polled session list.
 *
 * The session rail (session-list.tsx) already polls ``GET /v1/sessions``
 * every 5s; it publishes each result here so other surfaces — the ⌘K
 * command palette — can read the list without a second poller. Consumers
 * subscribe via ``useSyncExternalStore(subscribeSessions, getSessions)``.
 */

import type { Session } from "@/lib/types";

let sessions: Session[] = [];
const listeners = new Set<() => void>();

export function publishSessions(next: Session[]): void {
  sessions = next;
  for (const listener of listeners) listener();
}

export function getSessions(): Session[] {
  return sessions;
}

export function subscribeSessions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
