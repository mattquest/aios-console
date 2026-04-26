"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn, toErrorMessage } from "@/lib/utils";

type HealthResp =
  | { state: "probing" }
  | { state: "ok" }
  | { state: "error"; error: string };

export function TopNav() {
  const pathname = usePathname();
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
        if (!cancelled) setHealth({ state: "error", error: toErrorMessage(e) });
      }
    };
    probe();
    const id = setInterval(probe, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const links: { href: string; label: string; num: string }[] = [
    { href: "/", label: "sessions", num: "01" },
    { href: "/agents", label: "agents", num: "02" },
    { href: "/environments", label: "environments", num: "03" },
  ];

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/" || pathname.startsWith("/sessions")
      : pathname.startsWith(href);

  return (
    <nav
      data-testid="top-nav"
      className="h-12 shrink-0 border-b border-border/70 bg-background/80 backdrop-blur-sm flex items-center px-5 gap-6"
    >
      <Link href="/" className="flex items-baseline gap-1.5 group">
        <span
          className="text-display text-2xl leading-none"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
        >
          aios
        </span>
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground translate-y-[-2px]">
          /console
        </span>
      </Link>

      <div className="h-5 w-px bg-border/50" />

      <div className="flex items-center gap-0.5">
        {links.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "group relative flex items-baseline gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono transition-colors",
                active
                  ? "text-foreground bg-muted/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/25",
              )}
            >
              <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                {l.num}
              </span>
              <span>{l.label}</span>
              {active && (
                <span className="absolute left-3 right-3 -bottom-[13px] h-px bg-signal" />
              )}
            </Link>
          );
        })}
      </div>

      <HealthIndicator health={health} />
    </nav>
  );
}

function HealthIndicator({ health }: { health: HealthResp }) {
  const styles = {
    probing: {
      text: "text-muted-foreground",
      dot: "bg-signal-warn animate-signal",
      label: "probing",
    },
    ok: {
      text: "text-muted-foreground",
      dot: "bg-signal animate-signal",
      label: "aios/live",
    },
    error: {
      text: "text-signal-alert",
      dot: "bg-signal-alert animate-signal",
      label: "aios/offline",
    },
  }[health.state];
  return (
    <div
      data-testid="aios-health"
      data-state={health.state}
      className={cn(
        "ml-auto flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase",
        styles.text,
      )}
      title={health.state === "error" ? health.error : styles.label}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          styles.dot,
        )}
      />
      <span>{styles.label}</span>
    </div>
  );
}
