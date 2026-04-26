"use client";

import { useMemo, useRef, useState } from "react";
import type { AiosEvent, EventKind } from "@/lib/types";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";

interface Props {
  events: AiosEvent[];
}

const TAB_DEFS = [
  { value: "events", label: "events" },
  { value: "spans", label: "spans" },
  { value: "triage", label: "triage" },
  { value: "payload", label: "payload" },
] as const;

export function Inspector({ events }: Props) {
  return (
    <aside
      data-testid="inspector"
      className="w-[440px] shrink-0 border-l border-border/70 flex flex-col bg-muted/10"
    >
      <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2 text-hairline text-muted-foreground">
          <span>inspector</span>
          <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
            {String(events.length).padStart(3, "0")}
          </span>
        </div>
        <span className="text-hairline text-muted-foreground/50">
          event log / read-only
        </span>
      </div>
      <Tabs defaultValue="events" className="flex flex-col flex-1 min-h-0">
        <TabsList className="rounded-none bg-transparent border-b border-border/60 h-9 p-0 justify-start px-2 gap-0">
          {TAB_DEFS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 relative rounded-none before:absolute before:inset-x-3 before:-bottom-px before:h-px before:bg-signal before:opacity-0 data-[state=active]:before:opacity-100 transition-colors"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="events" className="flex-1 overflow-hidden m-0">
          <EventsTab events={events} />
        </TabsContent>
        <TabsContent value="spans" className="flex-1 overflow-hidden m-0">
          <SpansTab events={events} />
        </TabsContent>
        <TabsContent value="triage" className="flex-1 overflow-hidden m-0">
          <TriageTab events={events} />
        </TabsContent>
        <TabsContent value="payload" className="flex-1 overflow-hidden m-0">
          <PayloadTab events={events} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// ── events ────────────────────────────────────────────────────────────

const KIND_COLORS: Record<EventKind, string> = {
  message: "bg-signal-info/15 text-signal-info border-signal-info/40",
  lifecycle: "bg-signal-system/15 text-signal-system border-signal-system/40",
  span: "bg-muted/60 text-muted-foreground border-border",
  interrupt: "bg-signal-alert/15 text-signal-alert border-signal-alert/40",
};

const EVENT_KINDS: readonly EventKind[] = [
  "message",
  "lifecycle",
  "span",
  "interrupt",
];

function EventsTab({ events }: { events: AiosEvent[] }) {
  const [filter, setFilter] = useState("");
  const [activeKinds, setActiveKinds] = useState<Set<EventKind>>(
    () => new Set(EVENT_KINDS),
  );

  const filtered = useMemo(() => {
    const needle = filter.toLowerCase();
    return events.filter((e) => {
      if (!activeKinds.has(e.kind)) return false;
      if (!needle) return true;
      return JSON.stringify(e.data).toLowerCase().includes(needle);
    });
  }, [events, filter, activeKinds]);

  const toggle = (k: EventKind) =>
    setActiveKinds((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 space-y-2 border-b border-border">
        <Input
          data-testid="event-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter (jsonb substring)…"
          className="h-7 text-xs font-mono"
        />
        <div className="flex gap-1 flex-wrap">
          {EVENT_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => toggle(k)}
              className={cn(
                "font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border transition-opacity",
                KIND_COLORS[k],
                !activeKinds.has(k) && "opacity-30",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <EventRowsScroller events={filtered} />
    </div>
  );
}

function EventRowsScroller({ events }: { events: AiosEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useStickToBottom(ref, events.length);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto">
      {events.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
      {events.length === 0 && (
        <div className="p-3 text-xs text-muted-foreground font-mono">
          (no events match)
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: AiosEvent }) {
  const [open, setOpen] = useState(false);
  const summary = summariseEvent(event);
  return (
    <div
      data-testid={`event-row-${event.seq}`}
      data-kind={event.kind}
      className="border-b border-border/50 px-2 py-1.5 font-mono text-[10px]"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-start gap-2 hover:bg-muted/30 -mx-2 px-2 py-0.5 rounded-sm"
      >
        <span className="text-muted-foreground shrink-0">
          #{String(event.seq).padStart(3, "0")}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "px-1 py-0 text-[8px] uppercase shrink-0",
            KIND_COLORS[event.kind],
          )}
        >
          {event.kind}
        </Badge>
        <span className="truncate">{summary}</span>
      </button>
      {open && (
        <pre className="mt-1 px-2 py-1 text-[9px] bg-background/60 border border-border/50 rounded overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(event.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function summariseEvent(event: AiosEvent): string {
  const data = event.data;
  if (event.kind === "message") {
    const role = (data as { role?: string }).role ?? "?";
    const content = (data as { content?: string }).content ?? "";
    const tc = (data as { tool_calls?: { function?: { name?: string } }[] })
      .tool_calls;
    if (tc && tc.length) {
      const names = tc
        .map((t) => t.function?.name ?? "?")
        .join(", ");
      return `${role} → tool_calls: ${names}`;
    }
    return `${role}: ${content.slice(0, 120)}`;
  }
  if (event.kind === "lifecycle") {
    const ev = (data as { event?: string }).event ?? "?";
    const status = (data as { status?: string }).status;
    return status ? `${ev} (${status})` : ev;
  }
  if (event.kind === "span") {
    return (data as { event?: string }).event ?? "span";
  }
  return JSON.stringify(data).slice(0, 120);
}

// ── spans ─────────────────────────────────────────────────────────────

function SpansTab({ events }: { events: AiosEvent[] }) {
  const spans = useMemo(() => {
    const starts = new Map<string, AiosEvent>();
    const pairs: {
      start: AiosEvent;
      end?: AiosEvent;
      name: string;
      duration_ms?: number;
    }[] = [];
    for (const e of events) {
      if (e.kind !== "span") continue;
      const d = e.data as {
        event?: string;
        model_request_start_id?: string;
        model_usage?: Record<string, number>;
        is_error?: boolean;
      };
      if (d.event?.endsWith("_start")) {
        starts.set(e.id, e);
        pairs.push({ start: e, name: d.event.replace(/_start$/, "") });
      } else if (d.event?.endsWith("_end") && d.model_request_start_id) {
        const start = starts.get(d.model_request_start_id);
        if (!start) continue;
        const pair = pairs.find((p) => p.start.id === start.id);
        if (!pair) continue;
        pair.end = e;
        pair.duration_ms =
          new Date(e.created_at).getTime() -
          new Date(start.created_at).getTime();
      }
    }
    return pairs;
  }, [events]);

  const ref = useRef<HTMLDivElement>(null);
  useStickToBottom(ref, spans.length);

  return (
    <div ref={ref} className="h-full overflow-y-auto p-4">
      {spans.length === 0 ? (
        <div className="text-xs text-muted-foreground font-mono">
          (no spans yet)
        </div>
      ) : (
        <div className="space-y-2">
          {spans.map((s) => (
            <div
              key={s.start.id}
              className="border border-border rounded-md p-2 bg-card/30 font-mono text-[10px]"
            >
              <div className="flex items-center justify-between">
                <span>{s.name}</span>
                <span className="text-muted-foreground">
                  {s.duration_ms !== undefined
                    ? `${s.duration_ms}ms`
                    : "in flight…"}
                </span>
              </div>
              {s.end && (
                <SpanUsage
                  data={
                    s.end.data as {
                      model_usage?: Record<string, number>;
                      is_error?: boolean;
                    }
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpanUsage({
  data,
}: {
  data: { model_usage?: Record<string, number>; is_error?: boolean };
}) {
  const usage = data.model_usage;
  if (!usage) return null;
  const entries = Object.entries(usage).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 text-muted-foreground grid grid-cols-2 gap-x-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex justify-between">
          <span>{k}</span>
          <span>{v.toLocaleString()}</span>
        </div>
      ))}
      {data.is_error && <span className="text-destructive">errored</span>}
    </div>
  );
}

// ── triage ────────────────────────────────────────────────────────────

function TriageTab({ events }: { events: AiosEvent[] }) {
  const decisions = useMemo(
    () =>
      events.filter(
        (e) =>
          e.kind === "lifecycle" &&
          (e.data as { event?: string }).event === "triage_decision",
      ),
    [events],
  );

  const ref = useRef<HTMLDivElement>(null);
  useStickToBottom(ref, decisions.length);

  return (
    <div ref={ref} className="h-full overflow-y-auto p-4">
      {decisions.length === 0 ? (
        <div className="text-xs text-muted-foreground font-mono space-y-2">
          <div>(no triage decisions)</div>
          <div className="text-muted-foreground/60">
            configure an agent with a ``triage`` block to see per-message gate
            verdicts here
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {decisions.map((e) => {
            const d = e.data as {
              decision?: string;
              reason?: string;
              reacting_to?: number;
            };
            const admit = d.decision === "respond";
            return (
              <div
                key={e.id}
                data-testid={`triage-${e.seq}`}
                className={cn(
                  "border rounded-md p-2 font-mono text-[10px]",
                  admit
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-amber-500/40 bg-amber-500/5",
                )}
              >
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1 py-0 text-[9px] uppercase",
                      admit ? "text-emerald-300" : "text-amber-300",
                    )}
                  >
                    {d.decision ?? "?"}
                  </Badge>
                  <span className="text-muted-foreground">
                    seq={e.seq} · reacting_to={d.reacting_to ?? "?"}
                  </span>
                </div>
                <div className="mt-1 text-foreground/80">
                  {d.reason || "(no reason)"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── payload ───────────────────────────────────────────────────────────

function PayloadTab({ events }: { events: AiosEvent[] }) {
  // Reconstruct what the model saw most recently by walking messages
  // up to the last model_request_start span. Approximates build_messages
  // without the augmentation layers (no skill injection, no channel tail) —
  // the tradeoff is that this is a client-side view; the authoritative
  // dump lives at AIOS_DUMP_CONTEXT on the worker.
  const payload = useMemo(() => {
    const lastStart = [...events]
      .reverse()
      .find(
        (e) =>
          e.kind === "span" &&
          (e.data as { event?: string }).event === "model_request_start",
      );
    if (!lastStart) return null;
    const upTo = events.filter(
      (e) =>
        e.seq <= lastStart.seq &&
        e.kind === "message" &&
        (e.data as { role?: string }).role !== undefined,
    );
    return upTo.map((e) => e.data);
  }, [events]);

  const ref = useRef<HTMLDivElement>(null);
  // Payload tab re-latches to the bottom when the reconstructed message
  // list grows — i.e. when a fresh model_request_start lands and the
  // upstream conversation window shifts.
  useStickToBottom(ref, payload?.length ?? 0);

  return (
    <div ref={ref} className="h-full overflow-y-auto">
      {!payload ? (
        <div className="p-3 text-xs text-muted-foreground font-mono">
          (no model call yet)
        </div>
      ) : (
        <pre className="p-3 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
