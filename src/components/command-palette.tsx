"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NewSessionDialog } from "@/components/new-session-dialog";
import { api } from "@/lib/client";
import { getSessions, publishSessions, subscribeSessions } from "@/lib/session-store";
import { cn } from "@/lib/utils";

/**
 * ⌘K command palette — the thing the composer help row advertises.
 * A controlled input over a filtered, keyboard-navigable command list:
 * navigation, new session, jump-to-session (fed by the session rail's
 * existing poll via session-store), and inspector toggling on session
 * pages (wired through a window CustomEvent so the palette doesn't need
 * a handle on SessionView's state).
 */

export const TOGGLE_INSPECTOR_EVENT = "aios:toggle-inspector";

interface Command {
  id: string;
  /** Mono-uppercase row text. */
  label: string;
  /** Right-aligned category tag. */
  tag: string;
  /** Extra match material (ids, titles) beyond the label. */
  keywords?: string;
  run: () => void;
}

/** Every whitespace-separated query token must appear as a substring. */
function matches(query: string, command: Command): boolean {
  const haystack = `${command.label} ${command.keywords ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

const MAX_RESULTS = 12;

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const sessions = useSyncExternalStore(subscribeSessions, getSessions, getSessions);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) {
          setOpen(false);
          return;
        }
        setQuery("");
        setSelected(0);
        setOpen(true);
        // Pages without the session rail (agents/environments/usage) have
        // nothing publishing to the store — fetch once so jump-to-session
        // still works there.
        if (getSessions().length === 0) {
          api
            .listSessions()
            .then((resp) => publishSessions(resp.data))
            .catch(() => {
              /* palette stays useful without session entries */
            });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onSessionPage = pathname.startsWith("/sessions/");

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };
    const list: Command[] = [
      { id: "nav-sessions", label: "go to sessions", tag: "nav", run: go("/") },
      { id: "nav-agents", label: "go to agents", tag: "nav", run: go("/agents") },
      {
        id: "nav-environments",
        label: "go to environments",
        tag: "nav",
        run: go("/environments"),
      },
      { id: "nav-usage", label: "go to usage", tag: "nav", run: go("/usage") },
      {
        id: "new-session",
        label: "new session",
        tag: "action",
        keywords: "create start",
        run: () => {
          setOpen(false);
          setNewSessionOpen(true);
        },
      },
    ];
    if (onSessionPage) {
      list.push({
        id: "toggle-inspector",
        label: "toggle inspector",
        tag: "action",
        keywords: "events spans payload rail",
        run: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent(TOGGLE_INSPECTOR_EVENT));
        },
      });
    }
    for (const s of sessions) {
      list.push({
        id: `session-${s.id}`,
        label: `open: ${s.title || s.id}`,
        tag: "session",
        keywords: `${s.id} ${s.title ?? ""}`,
        run: go(`/sessions/${s.id}`),
      });
    }
    return list;
  }, [router, onSessionPage, sessions]);

  const filtered = useMemo(
    () => commands.filter((c) => matches(query, c)).slice(0, MAX_RESULTS),
    [commands, query],
  );
  // Clamp instead of resetting state — the list can shrink under the cursor
  // while the user types.
  const cursor = filtered.length === 0 ? -1 : Math.min(selected, filtered.length - 1);

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, filtered]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(cursor < 0 ? 0 : Math.min(cursor + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(Math.max(cursor - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (cursor >= 0) filtered[cursor].run();
    }
    // Escape: the dialog primitive closes itself.
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          data-testid="command-palette"
          aria-label="command palette"
          className="top-[18%] translate-y-0 max-w-lg gap-0 rounded-sm border-border/70 bg-background/95 p-0 overflow-hidden"
        >
          <DialogTitle className="sr-only">command palette</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
            <span className="font-mono text-[12px] text-signal/80 select-none">
              ›
            </span>
            <input
              data-testid="command-palette-input"
              aria-label="filter commands"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="type a command or session…"
              className="flex-1 bg-transparent font-mono text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            <kbd className="inline-flex h-5 items-center rounded-[3px] border border-border/70 bg-background/60 px-1.5 font-mono text-[10px] text-muted-foreground">
              esc
            </kbd>
          </div>
          <ul
            ref={listRef}
            role="listbox"
            aria-label="commands"
            className="max-h-[320px] overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <span className="bracket-label">empty</span>no matching commands
              </li>
            )}
            {filtered.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={i === cursor}
                data-testid={`palette-item-${c.id}`}
                onClick={c.run}
                onMouseMove={() => setSelected(i)}
                className={cn(
                  "flex cursor-pointer items-baseline gap-2 px-3 py-2 font-mono text-[11px] transition-colors",
                  i === cursor
                    ? "bg-muted/60 text-foreground"
                    : "text-muted-foreground hover:bg-muted/30",
                )}
              >
                {i === cursor && (
                  <span aria-hidden className="text-signal select-none">
                    ›
                  </span>
                )}
                <span className="truncate uppercase tracking-[0.08em]">
                  {c.label}
                </span>
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
                  {c.tag}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border/60 px-3 py-1.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
            <span>↑↓ move</span>
            <span>⏎ run</span>
            <span>esc close</span>
          </div>
        </DialogContent>
      </Dialog>
      <NewSessionDialog open={newSessionOpen} onOpenChange={setNewSessionOpen} />
    </>
  );
}
