/**
 * Browser-side fetch helpers. All calls go through ``/api/aios/...`` so
 * the bearer token stays server-only. These wrappers exist so components
 * don't have to re-encode paths and handle error shapes.
 */

import type {
  Agent,
  AiosEvent,
  ListResponse,
  Session,
} from "@/lib/types";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`/api/aios${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${body}`);
  }
  return resp.json();
}

export const api = {
  listSessions: (): Promise<ListResponse<Session>> =>
    json(`/v1/sessions?limit=50`),
  getSession: (id: string): Promise<Session> => json(`/v1/sessions/${id}`),
  listEvents: (id: string): Promise<ListResponse<AiosEvent>> =>
    json(`/v1/sessions/${id}/events?limit=500`),
  postMessage: (id: string, content: string) =>
    json(`/v1/sessions/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ role: "user", content }),
    }),
  createSession: (agent_id: string, initial_message?: string): Promise<Session> =>
    json(`/v1/sessions`, {
      method: "POST",
      body: JSON.stringify({
        agent_id,
        ...(initial_message ? { initial_message } : {}),
      }),
    }),
  interrupt: (id: string): Promise<void> =>
    json(`/v1/sessions/${id}/interrupt`, { method: "POST" }),
  listAgents: (): Promise<ListResponse<Agent>> => json(`/v1/agents?limit=50`),
};
