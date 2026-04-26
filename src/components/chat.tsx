"use client";

import { useMemo, useRef } from "react";
import type { AiosEvent, ToolCall } from "@/lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInFlightSpan } from "@/hooks/use-inflight-span";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";

interface Props {
  events: AiosEvent[];
  streamingContent: string;
  connected: boolean;
}

export function Chat({ events, streamingContent, connected }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageEvents = useMemo(
    () => events.filter((e) => e.kind === "message"),
    [events],
  );
  const inFlight = useInFlightSpan(events);

  // Stick the chat to the bottom on new content (tokens, new messages, the
  // generating-indicator elapsed tick) — but only if the user is already
  // near the bottom, so scrolling up to read earlier context is respected.
  useStickToBottom(
    scrollRef,
    `${messageEvents.length}·${streamingContent.length}·${inFlight?.elapsedMs ?? 0}`,
  );

  const lastMessage = messageEvents.at(-1);
  const showStreaming =
    streamingContent.length > 0 &&
    !(
      lastMessage &&
      (lastMessage.data as { role?: string }).role === "assistant"
    );
  // Show a silent-generation badge only when the provider isn't streaming
  // deltas but a model_request_start span is still open. Prevents the UI
  // from pretending nothing's happening during long local-model calls.
  const showGenerating = inFlight && !showStreaming;

  return (
    <div
      ref={scrollRef}
      data-testid="chat-messages"
      className="flex-1 overflow-y-auto overflow-x-hidden"
    >
      <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">
        {messageEvents.length === 0 && !showStreaming && !showGenerating && (
          <ChatEmptyState />
        )}
        {messageEvents.map((e) => (
          <MessageRow key={e.id} event={e} />
        ))}
        {showStreaming && (
          <StreamingAssistant content={streamingContent} connected={connected} />
        )}
        {showGenerating && inFlight && <GeneratingIndicator inFlight={inFlight} />}
      </div>
    </div>
  );
}

function GeneratingIndicator({
  inFlight,
}: {
  inFlight: { name: string; elapsedMs: number };
}) {
  const seconds = (inFlight.elapsedMs / 1000).toFixed(1);
  const concern =
    inFlight.elapsedMs > 30_000
      ? "elevated"
      : inFlight.elapsedMs > 90_000
        ? "prolonged"
        : null;
  return (
    <div
      data-testid="generating-indicator"
      className="grid grid-cols-[72px_1fr] gap-4 animate-rise"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground pt-1 flex items-baseline gap-2">
        <span>model</span>
        <span className="size-1.5 rounded-full bg-signal-warn animate-signal" />
      </div>
      <div className="flex items-baseline gap-3 font-mono text-[11px] text-muted-foreground">
        <span className="text-signal-warn uppercase tracking-[0.18em]">
          generating
        </span>
        <GeneratingBars />
        <span className="tabular-nums text-foreground">{seconds}s</span>
        {concern && (
          <span className="text-signal-warn uppercase tracking-[0.18em]">
            · {concern}
          </span>
        )}
      </div>
    </div>
  );
}

function GeneratingBars() {
  return (
    <span className="inline-flex items-end gap-0.5 h-3">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-signal-warn/70 origin-bottom animate-signal"
          style={{
            animationDelay: `${i * 120}ms`,
            height: `${40 + i * 15}%`,
          }}
        />
      ))}
    </span>
  );
}

function ChatEmptyState() {
  return (
    <div className="pt-12 max-w-xl mx-auto animate-rise">
      <div className="rounded-sm border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
        <div className="px-4 py-2 flex items-center justify-between border-b border-border/50 text-pico text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-signal animate-signal" />
            <span>session/idle</span>
          </div>
          <span className="normal-case tracking-[0.12em]">awaiting stdin</span>
        </div>
        <div className="px-4 py-5 space-y-4">
          <div className="font-mono text-[12px] text-foreground/90 leading-relaxed">
            <span className="text-signal">$</span>{" "}
            <span className="text-muted-foreground">
              compose your first message below.
            </span>
            <span className="inline-block w-[6px] h-[1em] bg-signal/70 ml-1 align-text-bottom animate-signal" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground/80">
            <Hint kbd="⏎" label="send" />
            <Hint kbd="⇧ ⏎" label="newline" />
            <Hint kbd="esc" label="blur" />
            <Hint kbd="⌘ K" label="commands" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Hint({ kbd, label }: { kbd: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <kbd className="inline-flex items-center justify-center min-w-[28px] h-5 px-1.5 rounded-[3px] border border-border/70 bg-background/60 text-foreground/80 text-[9px] tabular-nums">
        {kbd}
      </kbd>
      <span className="text-muted-foreground/70 uppercase tracking-[0.14em]">
        {label}
      </span>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  user: "human",
  assistant: "model",
  system: "system",
  tool: "tool",
};

function RoleGutter({ role, seq }: { role: string; seq: number }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 pt-1 flex items-baseline gap-2">
      <span>{ROLE_LABEL[role] ?? role}</span>
      <span className="text-muted-foreground/40 tabular-nums">
        #{String(seq).padStart(3, "0")}
      </span>
    </div>
  );
}

function MessageRow({ event }: { event: AiosEvent }) {
  const data = event.data as {
    role?: string;
    content?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
  };
  const role = data.role ?? "?";

  if (role === "tool") return <ToolResultRow event={event} />;

  const toolCalls = data.tool_calls ?? [];
  const isAssistant = role === "assistant";

  return (
    <div
      data-testid={`message-${role}`}
      data-seq={event.seq}
      className="grid grid-cols-[72px_1fr] gap-4"
    >
      <RoleGutter role={role} seq={event.seq} />
      <div className="space-y-3 min-w-0">
        {data.content && (
          <div
            className={cn(
              "leading-relaxed whitespace-pre-wrap",
              isAssistant
                ? "font-sans text-[15px] text-foreground"
                : "font-sans text-[14px] text-foreground/90",
            )}
          >
            {data.content}
          </div>
        )}
        {toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} call={tc} />
        ))}
      </div>
    </div>
  );
}

function StreamingAssistant({
  content,
  connected,
}: {
  content: string;
  connected: boolean;
}) {
  return (
    <div
      data-testid="message-streaming"
      className="grid grid-cols-[72px_1fr] gap-4"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground pt-1 flex items-baseline gap-2">
        <span>model</span>
        <span
          className={cn(
            "size-1.5 rounded-full",
            connected ? "bg-signal animate-signal" : "bg-signal-warn",
          )}
        />
      </div>
      <div className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
        {content}
        <span className="inline-block w-[6px] h-[1em] bg-signal/80 ml-1 align-text-bottom animate-signal" />
      </div>
    </div>
  );
}

function ToolCallCard({ call }: { call: ToolCall }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    parsed = call.function.arguments;
  }
  return (
    <Collapsible>
      <div className="rounded-sm border border-border/60 bg-card/40 backdrop-blur-sm">
        <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/30 transition-colors group">
          <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90 text-muted-foreground" />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-signal">
            invoke
          </span>
          <span className="font-mono text-[11px] text-foreground">
            {call.function.name}
          </span>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            {call.id.slice(0, 12)}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="px-3 pb-2 pt-1 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground/90 border-t border-border/40">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ToolResultRow({ event }: { event: AiosEvent }) {
  const data = event.data as {
    tool_call_id?: string;
    name?: string;
    content?: string;
    is_error?: boolean;
  };
  const content = data.content ?? "";
  let preview: string;
  try {
    const parsed = JSON.parse(content);
    preview = JSON.stringify(parsed, null, 2);
  } catch {
    preview = content;
  }

  return (
    <Collapsible>
      <div
        data-testid="message-tool"
        data-seq={event.seq}
        className="grid grid-cols-[72px_1fr] gap-4"
      >
        <RoleGutter role="tool" seq={event.seq} />
        <div
          className={cn(
            "rounded-sm border bg-card/40 backdrop-blur-sm",
            data.is_error ? "border-signal-alert/50" : "border-border/60",
          )}
        >
          <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/30 transition-colors group">
            <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90 text-muted-foreground" />
            <span
              className={cn(
                "font-mono text-[9px] uppercase tracking-[0.18em]",
                data.is_error ? "text-signal-alert" : "text-signal",
              )}
            >
              {data.is_error ? "error" : "result"}
            </span>
            <span className="font-mono text-[11px] text-foreground">
              {data.name ?? "tool"}
            </span>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
              {data.tool_call_id?.slice(0, 12) ?? "?"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="px-3 pb-2 pt-1 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground/90 border-t border-border/40">
              {preview}
            </pre>
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}
