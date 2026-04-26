"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AiosEvent, ToolCall } from "@/lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only auto-stick when the user's already near the bottom — scrolling
    // up to read history shouldn't be hijacked.
    const nearBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messageEvents.length, streamingContent]);

  const lastMessage = messageEvents.at(-1);
  const showStreaming =
    streamingContent.length > 0 &&
    !(
      lastMessage &&
      (lastMessage.data as { role?: string }).role === "assistant"
    );

  return (
    <div
      ref={scrollRef}
      data-testid="chat-messages"
      className="flex-1 overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">
        {messageEvents.length === 0 && !showStreaming && <ChatEmptyState />}
        {messageEvents.map((e) => (
          <MessageRow key={e.id} event={e} />
        ))}
        {showStreaming && (
          <StreamingAssistant content={streamingContent} connected={connected} />
        )}
      </div>
    </div>
  );
}

function ChatEmptyState() {
  return (
    <div className="pt-16 text-center space-y-3">
      <div
        className="text-display text-5xl text-muted-foreground/50 italic"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
      >
        Say something.
      </div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
        <span className="bracket-label">stdin</span>waiting for first user message
      </div>
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
