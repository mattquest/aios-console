"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Session } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
      className="w-64 shrink-0 border-r border-border flex flex-col h-full"
    >
      <header className="px-3 py-3 border-b border-border flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          sessions
        </div>
        <NewSessionDialog />
      </header>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-3 py-4 text-xs text-muted-foreground font-mono">
            loading…
          </div>
        )}
        {error && (
          <div className="px-3 py-4 text-xs text-destructive font-mono">
            {error}
          </div>
        )}
        {!loading && !error && sessions.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground font-mono">
            no sessions yet
          </div>
        )}
        <ul>
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/sessions/${s.id}`}
                className={cn(
                  "block px-3 py-2 border-b border-border/50 hover:bg-muted/40 transition-colors",
                  activeId === s.id && "bg-muted/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[11px] truncate text-foreground/90">
                    {s.title || s.id}
                  </div>
                  <StatusDot status={s.status} />
                </div>
                <div className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
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

function StatusDot({ status }: { status: Session["status"] }) {
  const color =
    status === "running"
      ? "bg-emerald-500"
      : status === "waiting" || status === "rescheduling"
        ? "bg-amber-500"
        : status === "archived"
          ? "bg-zinc-600"
          : "bg-zinc-400";
  return (
    <Badge
      variant="outline"
      className="gap-1.5 px-1.5 py-0 font-mono text-[9px] uppercase"
    >
      <span className={cn("size-1.5 rounded-full", color)} />
      {status}
    </Badge>
  );
}
