/**
 * Minimal types for aios resources — just the fields the UI reads.
 *
 * aios events are intentionally loose dicts (``data: Record<string, unknown>``)
 * because the message kind has to round-trip arbitrary LiteLLM extensions.
 * We mirror that here and narrow at read sites.
 */

export type SessionStatus =
  | "idle"
  | "running"
  | "waiting"
  | "rescheduling"
  | "archived";

export interface Session {
  id: string;
  agent_id: string;
  agent_version: number | null;
  status: SessionStatus;
  stop_reason?: Record<string, unknown> | null;
  title?: string | null;
  focal_channel?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  version: number;
  name: string;
  model: string;
  system: string;
  description?: string | null;
  triage?: { model: string; system: string } | null;
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
