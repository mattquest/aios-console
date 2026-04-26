"use client";

import { useMemo, useState } from "react";
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

interface Props {
  events: AiosEvent[];
}

export function Inspector({ events }: Props) {
  return (
    <aside
      data-testid="inspector"
      className="w-[420px] shrink-0 border-l border-border flex flex-col h-full bg-muted/20"
    >
      <Tabs defaultValue="events" className="flex flex-col h-full">
        <TabsList className="rounded-none bg-transparent border-b border-border h-9 p-0 justify-start px-2">
          <TabsTrigger
            value="events"
            className="font-mono text-[10px] uppercase tracking-wider data-[state=active]:bg-muted/50"
          >
            events ({events.length})
          </TabsTrigger>
          <TabsTrigger
            value="spans"
            className="font-mono text-[10px] uppercase tracking-wider data-[state=active]:bg-muted/50"
          >
            spans
          </TabsTrigger>
          <TabsTrigger
            value="triage"
            className="font-mono text-[10px] uppercase tracking-wider data-[state=active]:bg-muted/50"
          >
            triage
          </TabsTrigger>
          <TabsTrigger
            value="payload"
            className="font-mono text-[10px] uppercase tracking-wider data-[state=active]:bg-muted/50"
          >
            payload
          </TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="flex-1 overflow-hidden m-0">
          <EventsTab events={events} />
        </TabsContent>
        <TabsContent value="spans" className="flex-1 overflow-y-auto m-0 p-3">
          <SpansTab events={events} />
        </TabsContent>
        <TabsContent value="triage" className="flex-1 overflow-y-auto m-0 p-3">
          <TriageTab events={events} />
        </TabsContent>
        <TabsContent value="payload" className="flex-1 overflow-y-auto m-0">
          <PayloadTab events={events} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// ── events ────────────────────────────────────────────────────────────

const KIND_COLORS: Record<EventKind, string> = {
  message: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  lifecycle: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  span: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
  interrupt: "bg-destructive/20 text-destructive border-destructive/40",
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
      <div className="flex-1 overflow-y-auto">
        {filtered.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
        {filtered.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground font-mono">
            (no events match)
          </div>
        )}
      </div>
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

  if (spans.length === 0) {
    return (
      <div className="text-xs text-muted-foreground font-mono">
        (no spans yet)
      </div>
    );
  }

  return (
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
              data={s.end.data as { model_usage?: Record<string, number>; is_error?: boolean }}
            />
          )}
        </div>
      ))}
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

  if (decisions.length === 0) {
    return (
      <div className="text-xs text-muted-foreground font-mono space-y-2">
        <div>(no triage decisions)</div>
        <div className="text-muted-foreground/60">
          configure an agent with a ``triage`` block to see per-message gate
          verdicts here
        </div>
      </div>
    );
  }

  return (
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
            <div className="mt-1 text-foreground/80">{d.reason || "(no reason)"}</div>
          </div>
        );
      })}
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

  if (!payload) {
    return (
      <div className="p-3 text-xs text-muted-foreground font-mono">
        (no model call yet)
      </div>
    );
  }

  return (
    <pre className="p-3 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}
