"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSystemHealth, type SystemHealth } from "@/hooks/use-system-health";

export function TopNav() {
  const pathname = usePathname();
  const health = useSystemHealth();
  // Build epoch is captured once per page load and rendered as a small
  // mono-uptime readout in the wordmark cluster — pure visual telemetry,
  // not load-bearing. Captured in the effect (not render) so render
  // stays pure.
  const bootRef = useRef<number | null>(null);
  const [uptime, setUptime] = useState("00:00");

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
    { href: "/usage", label: "usage", num: "04" },
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

      <HealthStrip health={health} />
    </nav>
  );
}

function HealthStrip({ health }: { health: SystemHealth }) {
  const apiState =
    health.phase === "probing" ? "probing" : health.api.up ? "up" : "down";
  // The latency cell stays present even while probing/offline so the column
  // doesn't reflow on every tick; we just mute the value.
  const latency =
    health.latencyMs !== null
      ? `${health.latencyMs}ms`
      : health.phase === "probing"
        ? "—ms"
        : "n/a";

  return (
    <div
      data-testid="aios-health"
      data-state={health.phase}
      className="ml-auto flex items-center gap-2.5 font-mono text-[10px] tracking-[0.15em] uppercase tabular-nums"
    >
      <HealthCell
        cellKey="api"
        label="api"
        state={apiState}
        downSince={health.api.downSince}
        now={health.checkedAt}
        detail={latency}
        detailMuted={apiState !== "up"}
      />
      {health.worker && (
        <>
          <span aria-hidden className="h-3 w-px bg-border/60" />
          <HealthCell
            cellKey="wrk"
            label="wrk"
            state={health.worker.up ? "up" : "down"}
            downSince={health.worker.downSince}
            now={health.checkedAt}
          />
        </>
      )}
      {(health.connections ?? []).map((c) => (
        <Fragment key={c.id}>
          <span aria-hidden className="h-3 w-px bg-border/60" />
          <HealthCell
            cellKey={c.connector}
            label={c.connector}
            state={c.up ? "up" : "down"}
            downSince={c.downSince}
            now={health.checkedAt}
          />
        </Fragment>
      ))}
    </div>
  );
}

function HealthCell({
  cellKey,
  label,
  state,
  downSince,
  now,
  detail,
  detailMuted,
}: {
  cellKey: string;
  label: string;
  state: "probing" | "up" | "down";
  downSince: number | null;
  now: number | null;
  detail?: string;
  detailMuted?: boolean;
}) {
  const styles = {
    probing: {
      text: "text-muted-foreground",
      dot: "bg-signal-warn animate-signal",
      word: "probing",
    },
    up: {
      text: "text-muted-foreground",
      dot: "bg-signal animate-signal",
      word: "online",
    },
    down: {
      text: "text-signal-alert",
      dot: "bg-signal-alert animate-signal",
      word: "down",
    },
  }[state];
  // "down 4m" is anchored to the poller's last probe time, not Date.now(),
  // so render stays pure; the 10s poll cadence keeps it fresh enough.
  const isDown = state === "down" && downSince !== null;
  const downFor = isDown ? formatDownFor((now ?? downSince) - downSince) : null;

  return (
    <span
      data-testid={`health-cell-${cellKey}`}
      data-state={state}
      className={cn("flex items-center gap-1.5", styles.text)}
      title={isDown ? new Date(downSince).toISOString() : `${label} ${styles.word}`}
    >
      {/* Decorative — the "{label}/{word}" text beside it carries the state. */}
      <span aria-hidden className={cn("size-1.5 rounded-full", styles.dot)} />
      <span>
        {label}/{styles.word}
        {downFor ? ` ${downFor}` : ""}
      </span>
      {detail !== undefined && (
        <span
          className={cn(
            "normal-case tracking-normal",
            detailMuted ? "text-muted-foreground/40" : "text-foreground/80",
          )}
        >
          {detail}
        </span>
      )}
    </span>
  );
}

function formatDownFor(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}
