"use client";

import { useEffect, useState } from "react";
import { useSessionStream } from "@/hooks/use-session-stream";
import { Chat } from "@/components/chat";
import { Composer } from "@/components/composer";
import { Inspector } from "@/components/inspector";
import { api } from "@/lib/client";
import type { Session } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
        // Keep the same reference when nothing the UI cares about changed —
        // prevents a render cascade through Chat/Inspector every poll tick.
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
      <SessionHeader session={session} connected={stream.connected} />
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
}: {
  session: Session | null;
  connected: boolean;
}) {
  return (
    <header
      data-testid="session-header"
      className="h-10 shrink-0 border-b border-border px-4 flex items-center gap-3 font-mono text-xs"
    >
      <div className="text-muted-foreground">session</div>
      <div className="text-foreground/90">{session?.id ?? "…"}</div>
      <Badge variant="outline" className="font-mono text-[9px] uppercase">
        {session?.status ?? "…"}
      </Badge>
      {session?.agent_version !== null && session?.agent_version !== undefined && (
        <Badge variant="outline" className="font-mono text-[9px] uppercase">
          v{session.agent_version}
        </Badge>
      )}
      <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span
          className={cn(
            "size-1.5 rounded-full",
            connected ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
        {connected ? "sse live" : "sse idle"}
      </div>
    </header>
  );
}
