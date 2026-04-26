"use client";

import { useEffect, useMemo, useState } from "react";
import { useSessionStream } from "@/hooks/use-session-stream";
import { Chat } from "@/components/chat";
import { Composer } from "@/components/composer";
import { Inspector } from "@/components/inspector";
import { api } from "@/lib/client";
import type { AiosEvent, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
}

export function SessionView({ sessionId }: Props) {
  const stream = useSessionStream(sessionId);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await api.getSession(sessionId);
        if (cancelled) return;
        setSession((prev) => (sessionEqual(prev, next) ? prev : next));
      } catch {
        /* surfaced via stream error banner */
      }
    };
    void load();
    const id = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <SessionHeader
        session={session}
        connected={stream.connected}
        events={stream.events}
      />
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
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
    a.updated_at === b.updated_at
  );
}

function SessionHeader({
  session,
  connected,
  events,
}: {
  session: Session | null;
  connected: boolean;
  events: AiosEvent[];
}) {
  const stats = useMemo(() => deriveStats(events), [events]);

  return (
    <header
      data-testid="session-header"
      className="shrink-0 border-b border-border/70 bg-background/60 backdrop-blur-sm"
    >
      <div className="px-5 py-3 flex items-center gap-6">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-hairline text-muted-foreground">session</span>
          <span className="font-mono text-[11px] text-foreground/90 truncate">
            {session?.id ?? "…"}
          </span>
        </div>

        <div className="h-4 w-px bg-border/60" />

        <StatusPill status={session?.status} />

        {session?.agent_version != null && (
          <span className="font-mono text-[10px] text-muted-foreground border border-border/60 rounded-sm px-1.5 py-0.5 tracking-wider uppercase">
            v{session.agent_version}
          </span>
        )}

        <div className="ml-auto flex items-center gap-5">
          <Stat label="events" value={stats.events} />
          <Stat label="spans" value={stats.spans} />
          <Stat label="tools" value={stats.tools} />
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-2 text-hairline text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                connected
                  ? "bg-signal animate-signal"
                  : "bg-signal-warn",
              )}
            />
            <span>{connected ? "sse/live" : "sse/idle"}</span>
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
    <div className="flex items-baseline gap-2">
      <span className="text-hairline text-muted-foreground">{label}</span>
      <span className="font-mono text-[12px] tabular-nums text-foreground">
        {String(value).padStart(2, "0")}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status?: Session["status"] }) {
  const map: Record<string, { color: string; label: string }> = {
    idle: { color: "bg-muted-foreground/50", label: "idle" },
    running: { color: "bg-signal animate-signal", label: "running" },
    waiting: { color: "bg-signal-warn animate-signal", label: "waiting" },
    rescheduling: {
      color: "bg-signal-warn animate-signal",
      label: "rescheduling",
    },
    archived: { color: "bg-muted-foreground/25", label: "archived" },
  };
  const entry = status ? map[status] : null;
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      <span
        className={cn("size-1.5 rounded-full", entry?.color ?? "bg-muted-foreground/40")}
      />
      <span>{entry?.label ?? "…"}</span>
    </div>
  );
}
