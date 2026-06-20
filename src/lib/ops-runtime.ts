import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { OpsIncident, OpsRuntimeState, OpsStatus } from "@/lib/ops-types";

const DEFAULT_RUNTIME = path.join(
  process.env.HOME ?? "/Users/matt",
  "Code",
  "aios-runtime",
);

export function runtimeRoot(): string {
  return process.env.AIOS_RUNTIME_PATH ?? DEFAULT_RUNTIME;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadIncidents(opsDir: string): Promise<OpsIncident[]> {
  const dir = path.join(opsDir, "incidents");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const incidents: OpsIncident[] = [];
  for (const name of names.filter((n) => n.endsWith(".json"))) {
    const data = await readJson<OpsIncident>(path.join(dir, name));
    if (data?.id) incidents.push(data);
  }
  incidents.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return incidents;
}

async function loadLogTail(opsDir: string, lines = 40): Promise<string[]> {
  try {
    const raw = await readFile(path.join(opsDir, "watchdog.log"), "utf8");
    return raw.trim().split("\n").slice(-lines);
  } catch {
    return [];
  }
}

async function loadState(runtime: string): Promise<OpsRuntimeState> {
  const state = await readJson<{
    session_id?: string;
    agent_id?: string;
    base?: string;
  }>(path.join(runtime, "assistant", "state.json"));
  return {
    session_id: state?.session_id ?? null,
    agent_id: state?.agent_id ?? null,
    base: state?.base ?? null,
  };
}

const OPEN_STATUSES = new Set(["open", "in_progress", "pr_opened", "issue_opened"]);

export async function fetchOpsStatus(): Promise<OpsStatus> {
  const runtime_path = runtimeRoot();
  const opsDir = path.join(runtime_path, "ops");
  const incidents = await loadIncidents(opsDir);
  const open_count = incidents.filter((i) => OPEN_STATUSES.has(i.status)).length;

  return {
    runtime_path,
    checked_at: new Date().toISOString(),
    incidents,
    open_count,
    log_tail: await loadLogTail(opsDir),
    state: await loadState(runtime_path),
    summary: {
      watchdog_label: "com.aios.watchdog",
      maintain_label: "com.aios.maintain",
      relay_allowed: process.env.WATCHDOG_ALLOW_RELAY === "1",
    },
  };
}