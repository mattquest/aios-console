"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type HealthResp =
  | { state: "probing" }
  | { state: "ok" }
  | { state: "error"; error: string };

/**
 * Top nav with a live aios-connectivity dot.
 *
 * Pings ``/api/aios/v1/agents?limit=1`` every 10s as a cheap
 * round-trip probe — aios doesn't expose a dedicated /health route,
 * and this path succeeds on a fresh install (empty list) while still
 * exercising the bearer auth + DB pool. Shows the status in one
 * place so users don't have to guess "is aios running?" from a red
 * session list.
 */
export function TopNav() {
  const pathname = usePathname();
  // Start in "probing" so page navigation doesn't briefly flash a
  // false red — the first response usually lands within ~200ms and
  // flipping straight from amber to green is honest; flipping from
  // red→green makes aios look flaky when it isn't.
  const [health, setHealth] = useState<HealthResp>({ state: "probing" });

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const r = await fetch("/api/aios/v1/agents?limit=1", {
          cache: "no-store",
        });
        if (!cancelled) {
          setHealth(
            r.ok
              ? { state: "ok" }
              : { state: "error", error: `${r.status} ${r.statusText}` },
          );
        }
      } catch (e) {
        if (!cancelled) {
          setHealth({
            state: "error",
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    };
    probe();
    const id = setInterval(probe, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const links: { href: string; label: string }[] = [
    { href: "/", label: "sessions" },
    { href: "/agents", label: "agents" },
    { href: "/environments", label: "environments" },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/sessions") : pathname.startsWith(href);

  return (
    <nav
      data-testid="top-nav"
      className="h-9 shrink-0 border-b border-border flex items-center gap-4 px-3 font-mono text-[11px]"
    >
      <span className="font-semibold tracking-wider uppercase text-muted-foreground">
        aios
      </span>
      <div className="flex items-center gap-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "px-2 py-1 rounded hover:bg-muted/40 transition-colors",
              isActive(l.href)
                ? "text-foreground bg-muted/50"
                : "text-muted-foreground",
            )}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <HealthIndicator health={health} />
    </nav>
  );
}

function HealthIndicator({ health }: { health: HealthResp }) {
  const styles = {
    probing: {
      text: "text-muted-foreground",
      dot: "bg-amber-500 animate-pulse",
      label: "probing…",
    },
    ok: {
      text: "text-muted-foreground",
      dot: "bg-emerald-500",
      label: "aios connected",
    },
    error: {
      text: "text-destructive",
      dot: "bg-destructive animate-pulse",
      label: "aios unreachable",
    },
  }[health.state];
  return (
    <div
      data-testid="aios-health"
      data-state={health.state}
      className={cn("ml-auto flex items-center gap-1.5 text-[10px]", styles.text)}
      title={health.state === "error" ? health.error : styles.label}
    >
      <span className={cn("size-1.5 rounded-full", styles.dot)} />
      {styles.label}
    </div>
  );
}
