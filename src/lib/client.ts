/**
 * Browser-side fetch helpers. All calls go through ``/api/aios/...`` so
 * the bearer token stays server-only. These wrappers exist so components
 * don't have to re-encode paths and handle error shapes.
 */

import type {
  Agent,
  AgentUpdate,
  AiosEvent,
  Environment,
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
  // Tolerate empty bodies (204 No Content or Content-Length: 0) so callers
  // typed as `Promise<void>` (DELETE, interrupt, ...) don't trip JSON.parse.
  if (resp.status === 204 || resp.headers.get("content-length") === "0") {
    return undefined as T;
  }
  const text = await resp.text();
  return (text ? JSON.parse(text) : (undefined as T)) as T;
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
      // SessionUserMessage is extra="forbid" and wants only {content, metadata} —
      // sending a role field (chat-completions habit) gets rejected with 422.
      body: JSON.stringify({ content }),
    }),
  createSession: (
    agent_id: string,
    environment_id: string,
    initial_message?: string,
  ): Promise<Session> =>
    json(`/v1/sessions`, {
      method: "POST",
      body: JSON.stringify({
        agent_id,
        environment_id,
        ...(initial_message ? { initial_message } : {}),
      }),
    }),
  interrupt: (id: string): Promise<void> =>
    json(`/v1/sessions/${id}/interrupt`, { method: "POST" }),
  confirmTool: (
    id: string,
    tool_call_id: string,
    result: "allow" | "deny",
  ): Promise<AiosEvent> =>
    json(`/v1/sessions/${id}/tool-confirmations`, {
      method: "POST",
      body: JSON.stringify({ tool_call_id, result }),
    }),
  listAgents: (): Promise<ListResponse<Agent>> => json(`/v1/agents?limit=50`),
  getAgent: (id: string): Promise<Agent> => json(`/v1/agents/${id}`),
  createAgent: (body: {
    name: string;
    model: string;
    system: string;
    tools: { type: string }[];
  }): Promise<Agent> =>
    json(`/v1/agents`, { method: "POST", body: JSON.stringify(body) }),
  updateAgent: (id: string, body: AgentUpdate): Promise<Agent> =>
    json(`/v1/agents/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAgent: (id: string): Promise<void> =>
    json(`/v1/agents/${id}`, { method: "DELETE" }),
  listEnvironments: (): Promise<ListResponse<Environment>> =>
    json(`/v1/environments?limit=50`),
  createEnvironment: (body: { name: string }): Promise<Environment> =>
    json(`/v1/environments`, { method: "POST", body: JSON.stringify(body) }),
};
