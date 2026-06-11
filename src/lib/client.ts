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
  HealthReady,
  ListResponse,
  Session,
} from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Raw response body, when one was read — lets UIs surface detail. */
    public readonly body?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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
    throw new ApiError(
      resp.status,
      `${resp.status} ${resp.statusText}: ${body}`,
      body,
    );
  }
  // Tolerate empty bodies (204 No Content or Content-Length: 0) so callers
  // typed as `Promise<void>` (DELETE, interrupt, ...) don't trip JSON.parse.
  if (resp.status === 204 || resp.headers.get("content-length") === "0") {
    return undefined as T;
  }
  const text = await resp.text();
  return (text ? JSON.parse(text) : (undefined as T)) as T;
}

/**
 * Result of probing ``/v1/health/ready``. ``body`` is null when the
 * deployed aios predates the endpoint (404) — the api is reachable but
 * worker/connector state is unknown.
 */
export interface HealthProbe {
  status: number;
  body: HealthReady | null;
}

function isHealthReady(v: unknown): v is HealthReady {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.worker === "object" &&
    o.worker !== null &&
    Array.isArray(o.connections)
  );
}

/**
 * Deliberately not built on ``json<T>``: a 503 from /v1/health/ready still
 * carries the full readiness payload (db down / stale worker), so the body
 * must be parsed regardless of HTTP status. Rejects only when the fetch
 * fails at the network level or the response carries no readiness body at
 * all (e.g. the proxy 500s because aios itself is unreachable) — callers
 * treat a rejection as "api down".
 */
export async function getHealthReady(): Promise<HealthProbe> {
  const resp = await fetch(`/api/aios/v1/health/ready`, { cache: "no-store" });
  if (resp.status === 404) return { status: 404, body: null };
  let parsed: unknown;
  try {
    parsed = await resp.json();
  } catch {
    parsed = undefined;
  }
  if (isHealthReady(parsed)) return { status: resp.status, body: parsed };
  throw new ApiError(resp.status, `${resp.status} ${resp.statusText}`);
}

export const api = {
  listSessions: (): Promise<ListResponse<Session>> =>
    json(`/v1/sessions?limit=50`),
  getSession: (id: string): Promise<Session> => json(`/v1/sessions/${id}`),
  /**
   * Page through a session's event log. First page: ``dir`` + ``limit``
   * (``backward`` loads the newest tail). Subsequent pages: ``cursor``
   * alone — the token carries direction and filters.
   */
  listEvents: (
    id: string,
    opts: { dir?: "forward" | "backward"; limit?: number; cursor?: string } = {},
  ): Promise<ListResponse<AiosEvent>> => {
    const params = new URLSearchParams();
    if (opts.cursor) {
      params.set("cursor", opts.cursor);
    } else {
      if (opts.dir) params.set("dir", opts.dir);
      params.set("limit", String(opts.limit ?? 500));
    }
    return json(`/v1/sessions/${id}/events?${params}`);
  },
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
