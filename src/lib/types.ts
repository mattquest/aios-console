/**
 * Minimal types for aios resources — just the fields the UI reads.
 *
 * aios events are intentionally loose dicts (``data: Record<string, unknown>``)
 * because the message kind has to round-trip arbitrary LiteLLM extensions.
 * We mirror that here and narrow at read sites.
 */

/**
 * Mirror of the backend's derived SessionStatus — exactly {active, idle}.
 * Everything richer (errored, retrying, waiting-on-you) is derived
 * client-side from ``stop_reason`` + ``awaiting``; see deriveDisplayStatus.
 */
export type SessionStatus = "active" | "idle";

export interface AwaitingToolCall {
  tool_call_id: string;
  name: string;
  kind: "builtin" | "mcp" | "custom";
}

export interface Session {
  id: string;
  agent_id: string;
  agent_version: number | null;
  status: SessionStatus;
  stop_reason?: Record<string, unknown> | null;
  awaiting?: AwaitingToolCall[];
  title?: string | null;
  focal_channel?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * What the UI should say about a session right now. Derived, in priority
 * order: terminal error > waiting on the operator > retrying > activity.
 */
export type DisplayStatus = "errored" | "needs you" | "retrying" | "active" | "idle";

export function deriveDisplayStatus(session: Session): DisplayStatus {
  const stop = (session.stop_reason as { type?: string } | null)?.type;
  if (stop === "error") return "errored";
  if ((session.awaiting?.length ?? 0) > 0) return "needs you";
  if (stop === "rescheduling") return "retrying";
  return session.status;
}

export interface ToolSpec {
  type: string;
}

export interface Agent {
  id: string;
  version: number;
  name: string;
  model: string;
  system: string;
  tools?: ToolSpec[];
  description?: string | null;
  triage?: { model: string; system: string } | null;
}

export interface AgentUpdate {
  version: number;
  name?: string;
  model?: string;
  system?: string;
  tools?: ToolSpec[];
}

export interface Environment {
  id: string;
  name: string;
}

export type EventKind = "message" | "lifecycle" | "span" | "interrupt";

export interface AiosEvent {
  id: string;
  session_id: string;
  seq: number;
  kind: EventKind;
  data: Record<string, unknown>;
  created_at: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ListResponse<T> {
  data: T[];
  has_more: boolean;
  next_after: string | null;
}
