"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSessionStream } from "@/hooks/use-session-stream";
import { Chat } from "@/components/chat";
import { Composer } from "@/components/composer";
import { Inspector } from "@/components/inspector";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client";
import { deriveDisplayStatus, type AiosEvent, type DisplayStatus, type Session } from "@/lib/types";
import { cn, toErrorMessage } from "@/lib/utils";

interface Props {
  sessionId: string;
}

export function SessionView({ sessionId }: Props) {
  const stream = useSessionStream(sessionId);
  const [session, setSession] = useState<Session | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await api.getSession(sessionId);
        if (cancelled) return;
        setNotFound(false);
        setSession((prev) => (sessionEqual(prev, next) ? prev : next));
      } catch (e) {
        // A missing session must NOT render as a healthy empty chat —
        // users with a stale link would type into the void.
        if (!cancelled && e instanceof ApiError && e.status === 404) {
          setNotFound(true);
        }
        /* other failures surface via the stream error banner */
      }
    };
    void load();
    const id = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId]);

  const displayStatus = session ? deriveDisplayStatus(session) : null;

  if (notFound) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="session-not-found"
      >
        <div className="text-center space-y-3 max-w-md px-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal-alert">
            [404] session not found
          </div>
          <p className="font-sans text-[13px] text-muted-foreground leading-relaxed">
            No session exists with id{" "}
            <code className="text-foreground/80 break-all">{sessionId}</code>.
            It may have been deleted, or the link is stale.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-sm border border-border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground hover:border-foreground/60 transition-colors"
          >
            ← back to sessions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <SessionHeader
        session={session}
        displayStatus={displayStatus}
        connected={stream.connected}
        events={stream.events}
      />
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <SessionNotices
            session={session}
            displayStatus={displayStatus}
            events={stream.events}
            streamError={stream.connected ? null : stream.error}
          />
          <Chat
            events={stream.events}
            streamingContent={stream.streamingContent}
            connected={stream.connected}
          />
          <Composer
            sessionId={sessionId}
            status={session?.status ?? "unknown"}
          />
        </div>
        <Inspector events={stream.events} />
      </div>
    </div>
  );
}

function sessionEqual(a: Session | null, b: Session): boolean {
  if (!a) return false;
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.agent_version === b.agent_version &&
    a.title === b.title &&
    a.focal_channel === b.focal_channel &&
    a.updated_at === b.updated_at &&
    JSON.stringify(a.stop_reason ?? null) === JSON.stringify(b.stop_reason ?? null) &&
    JSON.stringify(a.awaiting ?? []) === JSON.stringify(b.awaiting ?? [])
  );
}

/**
 * The latest failure recorded in the log: lifecycle ``turn_ended`` events
 * carry ``error_type``/``error_message`` since aios stamps them on the
 * retry and terminal paths.
 */
function latestFailureDetail(events: AiosEvent[]): { type?: string; message?: string } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind !== "lifecycle") continue;
    const d = e.data as { stop_reason?: string; error_type?: string; error_message?: string };
    if (d.stop_reason === "error" || d.stop_reason === "rescheduling") {
      return { type: d.error_type, message: d.error_message };
    }
    if (d.stop_reason === "end_turn") return null; // recovered since
  }
  return null;
}

function SessionNotices({
  session,
  displayStatus,
  events,
  streamError,
}: {
  session: Session | null;
  displayStatus: DisplayStatus | null;
  events: AiosEvent[];
  streamError: string | null;
}) {
  const failure = useMemo(() => latestFailureDetail(events), [events]);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const confirm = async (toolCallId: string, result: "allow" | "deny") => {
    if (!session) return;
    setConfirming(toolCallId);
    setConfirmError(null);
    try {
      await api.confirmTool(session.id, toolCallId, result);
    } catch (e) {
      setConfirmError(toErrorMessage(e));
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div data-testid="session-notices" className="shrink-0">
      {streamError && (
        <Notice tone="warn" label="connection">
          Lost the live connection to aios — reconnecting automatically. The
          conversation below may be behind.
        </Notice>
      )}
      {displayStatus === "errored" && (
        <Notice tone="alert" label="stopped">
          The assistant hit a problem and has stopped retrying
          {failure?.type ? ` (${failure.type})` : ""}.
          {failure?.message ? ` Detail: ${failure.message}.` : ""} Send a
          message below to wake it and try again.
        </Notice>
      )}
      {displayStatus === "retrying" && (
        <Notice tone="warn" label="retrying">
          The assistant hit a problem{failure?.type ? ` (${failure.type})` : ""}{" "}
          and is retrying automatically — no action needed yet.
        </Notice>
      )}
      {(session?.awaiting ?? []).map((a) =>
        a.kind === "custom" ? (
          <Notice key={a.tool_call_id} tone="warn" label="waiting">
            Waiting for an external tool result: <code>{a.name}</code>. The
            connected client (e.g. the connector) must complete it.
          </Notice>
        ) : (
          <Notice key={a.tool_call_id} tone="warn" label="approval">
            <span className="flex-1">
              The assistant wants to run <code>{a.name}</code> and needs your
              approval.
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="h-6 font-mono text-[10px] uppercase tracking-wider"
                disabled={confirming === a.tool_call_id}
                onClick={() => void confirm(a.tool_call_id, "allow")}
                data-testid={`approve-${a.name}`}
              >
                allow
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 font-mono text-[10px] uppercase tracking-wider border-signal-alert/50 text-signal-alert hover:bg-signal-alert/10"
                disabled={confirming === a.tool_call_id}
                onClick={() => void confirm(a.tool_call_id, "deny")}
                data-testid={`deny-${a.name}`}
              >
                deny
              </Button>
            </span>
          </Notice>
        ),
      )}
      {confirmError && (
        <Notice tone="alert" label="error">
          Couldn&apos;t submit that decision: {confirmError}
        </Notice>
      )}
    </div>
  );
}

function Notice({
  tone,
  label,
  children,
}: {
  tone: "warn" | "alert";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 border-b text-[12px] font-sans",
        tone === "alert"
          ? "border-signal-alert/40 bg-signal-alert/10 text-signal-alert"
          : "border-signal-warn/40 bg-signal-warn/10 text-foreground/90",
      )}
    >
      <span
        className={cn(
          "font-mono text-[9px] uppercase tracking-[0.16em] shrink-0",
          tone === "alert" ? "text-signal-alert" : "text-signal-warn",
        )}
      >
        [{label}]
      </span>
      {children}
    </div>
  );
}

function SessionHeader({
  session,
  displayStatus,
  connected,
  events,
}: {
  session: Session | null;
  displayStatus: DisplayStatus | null;
  connected: boolean;
  events: AiosEvent[];
}) {
  const stats = useMemo(() => deriveStats(events), [events]);

  return (
    <header
      data-testid="session-header"
      className="shrink-0 border-b border-border/70 bg-background/60 backdrop-blur-sm"
    >
      <div className="px-4 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-pico text-muted-foreground/70 shrink-0">
            sid
          </span>
          <span className="text-muted-foreground/40 shrink-0">›</span>
          <span className="font-mono text-[11px] text-foreground/90 truncate">
            {session?.id ?? "…"}
          </span>
        </div>

        <div className="h-4 w-px bg-border/60 shrink-0" />

        <div className="shrink-0">
          <StatusPill status={displayStatus} />
        </div>

        {session?.agent_version != null && (
          <span className="font-mono text-[10px] text-muted-foreground/90 border border-border/60 rounded-sm px-1.5 py-0.5 tracking-[0.14em] uppercase shrink-0 tabular-nums">
            v{session.agent_version}
          </span>
        )}

        <div className="flex items-center gap-4 shrink-0">
          <Stat label="evt" value={stats.events} />
          <Stat label="spn" value={stats.spans} />
          <Stat label="tool" value={stats.tools} />
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                connected ? "bg-signal animate-signal" : "bg-signal-warn",
              )}
            />
            <span>sse/{connected ? "live" : "idle"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

interface SessionStats {
  events: number;
  spans: number;
  tools: number;
}

function deriveStats(events: AiosEvent[]): SessionStats {
  let spans = 0;
  let tools = 0;
  for (const e of events) {
    if (e.kind === "span") spans++;
    if (e.kind === "message" && (e.data as { role?: string }).role === "tool") {
      tools++;
    }
  }
  return { events: events.length, spans, tools };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-pico text-muted-foreground/70">{label}</span>
      <span className="font-mono text-[12px] tabular-nums text-foreground">
        {String(value).padStart(3, "0")}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: DisplayStatus | null }) {
  const map: Record<DisplayStatus, { color: string; label: string }> = {
    idle: { color: "bg-muted-foreground/50", label: "idle" },
    active: { color: "bg-signal animate-signal", label: "active" },
    "needs you": { color: "bg-signal-warn animate-signal", label: "needs you" },
    retrying: { color: "bg-signal-warn animate-signal", label: "retrying" },
    errored: { color: "bg-signal-alert animate-signal", label: "errored" },
  };
  const entry = status ? map[status] : null;
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/85 border border-border/60 rounded-sm px-1.5 py-0.5">
      <span
        className={cn(
          "size-1.5 rounded-full",
          entry?.color ?? "bg-muted-foreground/40",
        )}
      />
      <span>{entry?.label ?? "…"}</span>
    </div>
  );
}
