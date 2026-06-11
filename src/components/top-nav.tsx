"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn, toErrorMessage } from "@/lib/utils";

type HealthResp =
  | { state: "probing" }
  | { state: "ok"; latencyMs: number }
  | { state: "error"; error: string };

export function TopNav() {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthResp>({ state: "probing" });
  // Build epoch is captured once per page load and rendered as a small
  // mono-uptime readout in the wordmark cluster — pure visual telemetry,
  // not load-bearing. Captured in the effect (not render) so render
  // stays pure.
  const bootRef = useRef<number | null>(null);
  const [uptime, setUptime] = useState("00:00");

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const t0 = performance.now();
      try {
        const r = await fetch("/api/aios/v1/agents?limit=1", {
          cache: "no-store",
        });
        const dt = Math.round(performance.now() - t0);
        if (!cancelled) {
          setHealth(
            r.ok
              ? { state: "ok", latencyMs: dt }
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

  useEffect(() => {
    bootRef.current ??= Date.now();
    const tick = () => {
      const sec = Math.floor((Date.now() - (bootRef.current ?? Date.now())) / 1000);
      const m = Math.floor(sec / 60) % 60;
      const s = sec % 60;
      const h = Math.floor(sec / 3600);
      setUptime(
        h > 0
          ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
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
      <Link href="/" className="flex items-center gap-2.5 group">
        <span
          aria-hidden
          className="size-2 rounded-full bg-signal animate-signal shadow-[0_0_8px_currentColor] text-signal"
        />
        <span className="font-mono text-[13px] font-medium tracking-[-0.02em] text-foreground leading-none">
          aios<span className="text-muted-foreground/50">.</span>console
        </span>
        <span
          aria-hidden
          className="hidden md:inline-block h-3 w-px bg-border/60"
        />
        <span className="hidden md:inline-block font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60 tabular-nums leading-none">
          up {uptime}
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
      label: "online",
    },
    error: {
      text: "text-signal-alert",
      dot: "bg-signal-alert animate-signal",
      label: "offline",
    },
  }[health.state];

  // Right-edge readout: dot · status · vertical hairline · latency · /probe
  // The latency cell stays present even while probing/offline so the column
  // doesn't reflow on every tick; we just mute the value.
  const latency =
    health.state === "ok"
      ? `${health.latencyMs}ms`
      : health.state === "probing"
        ? "—ms"
        : "n/a";
  const latencyClass =
    health.state === "ok" ? "text-foreground/80" : "text-muted-foreground/40";

  return (
    <div
      data-testid="aios-health"
      data-state={health.state}
      className={cn(
        "ml-auto flex items-center gap-2.5 font-mono text-[10px] tracking-[0.15em] uppercase tabular-nums",
        styles.text,
      )}
      title={health.state === "error" ? health.error : styles.label}
    >
      <span className={cn("size-1.5 rounded-full", styles.dot)} />
      <span>aios/{styles.label}</span>
      <span className="h-3 w-px bg-border/60" />
      <span className={cn("normal-case tracking-normal", latencyClass)}>
        {latency}
      </span>
      <span className="text-muted-foreground/40 normal-case tracking-normal">
        /probe
      </span>
    </div>
  );
}
