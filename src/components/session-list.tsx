"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { publishSessions } from "@/lib/session-store";
import { deriveDisplayStatus, type DisplayStatus, type Session } from "@/lib/types";
import { ErrorBanner } from "@/components/error-banner";
import { NeedsAttention } from "@/components/needs-attention";
import { NewSessionDialog } from "@/components/new-session-dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  activeId?: string;
}

/** Desktop rail — hidden on small screens, where the drawer takes over. */
export function SessionList({ activeId }: Props) {
  return (
    <aside
      data-testid="session-list"
      className="w-[260px] shrink-0 border-r border-border/70 hidden md:flex flex-col bg-sidebar/40"
    >
      <SessionListContent activeId={activeId} />
    </aside>
  );
}

/**
 * Small-screen drawer holding the same session list. Controlled so a
 * navigation tap closes it instead of covering the destination.
 */
export function MobileSessionsDrawer({ activeId }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        data-testid="sessions-drawer-trigger"
        className="md:hidden inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground border border-border/60 rounded-sm px-2 py-1 transition-colors"
      >
        <PanelLeft className="size-3" />
        <span>sessions</span>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[85vw] max-w-[320px] p-0 gap-0 flex flex-col bg-sidebar"
        data-testid="sessions-drawer"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">sessions</SheetTitle>
        <SessionListContent
          activeId={activeId}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function SessionListContent({
  activeId,
  onNavigate,
}: Props & { onNavigate?: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await api.listSessions();
        if (!cancelled) {
          setSessions(resp.data);
          setError(null);
          // Feed the ⌘K palette's jump-to-session list off this poll.
          publishSessions(resp.data);
        }
      } catch (e) {
        if (!cancelled) setError(e);
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
    <>
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
        {error != null && (
          <ErrorBanner
            error={error}
            className="m-2"
            testId="session-list-error"
          />
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
                onClick={onNavigate}
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
                <div
                  title={s.id}
                  className="font-mono text-[10px] text-muted-foreground/60 truncate mt-1 pl-6"
                >
                  {s.id}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
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
      // The dot is the row's only status carrier — name it for AT.
      role="img"
      aria-label={status}
      className={cn(
        "size-1.5 rounded-full shrink-0",
        STATUS_COLOR[status] ?? "bg-muted-foreground/40",
        status === "active" && "animate-signal",
      )}
      title={status}
    />
  );
}
