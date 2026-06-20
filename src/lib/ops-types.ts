/** Watchdog / maintainer incident from aios-runtime/ops/incidents/*.json */

export type IncidentStatus =
  | "open"
  | "in_progress"
  | "pr_opened"
  | "issue_opened"
  | "resolved"
  | "wontfix";

export type IncidentKind =
  | "undelivered_dm"
  | "prompt_harness_mismatch"
  | "provision_stale"
  | "infra_down"
  | "lm_studio_down"
  | "model_tool_failure";

export interface OpsIncident {
  id: string;
  kind: IncidentKind | string;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
  symptom: string;
  hypothesis: string;
  suggested_fix: string;
  fingerprint: string;
  in_bounds: boolean;
  outcome_url: string | null;
  evidence: Record<string, unknown>;
  attempts?: number;
}

export interface OpsRuntimeState {
  session_id: string | null;
  agent_id: string | null;
  base: string | null;
}

export interface OpsStatus {
  runtime_path: string;
  checked_at: string;
  incidents: OpsIncident[];
  open_count: number;
  log_tail: string[];
  state: OpsRuntimeState;
  summary: {
    watchdog_label: string;
    maintain_label: string;
    relay_allowed: boolean;
  };
}