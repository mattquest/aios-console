"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { deriveDisplayStatus, type DisplayStatus, type Session } from "@/lib/types";
import { NeedsAttention } from "@/components/needs-attention";
import { NewSessionDialog } from "@/components/new-session-dialog";
import { cn, toErrorMessage } from "@/lib/utils";

interface Props {
  activeId?: string;
}

export function SessionList({ activeId }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await api.listSessions();
        if (!cancelled) {
          setSessions(resp.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(toErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <aside
      data-testid="session-list"
      className="w-[260px] shrink-0 border-r border-border/70 flex flex-col bg-sidebar/40"
    >
      <header className="px-4 py-3 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-hairline text-muted-foreground">sessions</span>
          {sessions.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
              {String(sessions.length).padStart(2, "0")}
            </span>
          )}
        </div>
        <NewSessionDialog />
      </header>
      <div className="flex-1 overflow-y-auto">
        <NeedsAttention sessions={sessions} />
        {loading && <RowPlaceholder text="loading" />}
        {error && (
          <div className="px-4 py-3 font-mono text-[10px] text-signal-alert break-all">
            <span className="bracket-label">fault</span>
            {error}
          </div>
        )}
        {!loading && !error && sessions.length === 0 && (
          <div className="px-4 py-6 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="bracket-label">empty</span>no sessions
            </p>
            <p className="font-sans text-[11px] text-muted-foreground/70 leading-relaxed">
              Create your first one with{" "}
              <span className="text-foreground">+ new</span> above.
            </p>
          </div>
        )}
        <ul>
          {sessions.map((s, i) => (
            <li key={s.id}>
              <Link
                href={`/sessions/${s.id}`}
                className={cn(
                  "group relative block px-4 py-2.5 border-b border-border/30 transition-colors",
                  activeId === s.id
                    ? "bg-muted/60"
                    : "hover:bg-muted/30",
                )}
              >
                {activeId === s.id && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-signal" />
                )}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted-foreground/60 tabular-nums shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[11px] truncate text-foreground/90 flex-1">
                    {s.title || s.id.slice(0, 16) + "…"}
                  </span>
                  <StatusDot session={s} />
                </div>
                <div className="font-mono text-[9px] text-muted-foreground/60 truncate mt-1 pl-6">
                  {s.id}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function RowPlaceholder({ text }: { text: string }) {
  return (
    <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
      <span className="bracket-label">{text}</span>…
    </div>
  );
}

const STATUS_COLOR: Record<DisplayStatus, string> = {
  idle: "bg-muted-foreground/40",
  active: "bg-signal",
  "needs you": "bg-signal-warn",
  retrying: "bg-signal-warn",
  errored: "bg-signal-alert",
};

function StatusDot({ session }: { session: Session }) {
  const status = deriveDisplayStatus(session);
  return (
    <span
      className={cn(
        "size-1.5 rounded-full shrink-0",
        STATUS_COLOR[status] ?? "bg-muted-foreground/40",
        status === "active" && "animate-signal",
      )}
      title={status}
    />
  );
}
