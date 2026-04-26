"use client";

import { useEffect, useRef } from "react";
import type { AiosEvent, ToolCall } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  events: AiosEvent[];
  streamingContent: string;
  connected: boolean;
}

/**
 * Rendered conversation view. Two render slots stack:
 *
 *   1. Persisted message events from the log (user, assistant, tool).
 *   2. A transient "streaming assistant" slot fed by SSE deltas — shown
 *      only when ``streamingContent`` is non-empty AND the tail of the
 *      log isn't already an assistant message. This mirrors how Claude
 *      managed agents surfaces in-progress output without double-rendering.
 *
 * Non-message events (lifecycle, span, triage decisions) live in the
 * inspector pane — the chat view deliberately stays clean.
 */
export function Chat({ events, streamingContent, connected }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageEvents = events.filter((e) => e.kind === "message");

  useEffect(() => {
    // Stick to bottom on new content — standard chat UX. If the user
    // scrolls up, respect it by only auto-scrolling when already near
    // the bottom.
    const el = scrollRef.current;
    if (!el) return;
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
      className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
    >
      {messageEvents.length === 0 && !showStreaming && (
        <div className="font-mono text-xs text-muted-foreground text-center py-8">
          no messages yet — send something below
        </div>
      )}
      {messageEvents.map((e) => (
        <MessageRow key={e.id} event={e} />
      ))}
      {showStreaming && (
        <StreamingAssistant content={streamingContent} connected={connected} />
      )}
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

  if (role === "tool") {
    return <ToolResultRow event={event} />;
  }

  const toolCalls = data.tool_calls ?? [];

  return (
    <div
      data-testid={`message-${role}`}
      data-seq={event.seq}
      className={cn(
        "grid grid-cols-[60px_1fr] gap-3",
        role === "user" && "text-foreground",
        role === "assistant" && "text-foreground",
        role === "system" && "text-muted-foreground",
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground pt-1">
        {role} <span className="text-muted-foreground/60">#{event.seq}</span>
      </div>
      <div className="space-y-2 min-w-0">
        {data.content && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
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
      className="grid grid-cols-[60px_1fr] gap-3 text-foreground"
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground pt-1 flex items-center gap-1">
        asst
        <span
          className={cn(
            "size-1.5 rounded-full",
            connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500",
          )}
        />
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {content}
        <span className="inline-block w-[7px] h-[1em] bg-foreground/60 ml-0.5 align-text-bottom animate-pulse" />
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
      <div className="rounded-md border border-border bg-card/40">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors group">
          <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90 text-muted-foreground" />
          <Wrench className="size-3 text-muted-foreground" />
          <span className="font-mono text-xs">{call.function.name}</span>
          <Badge
            variant="outline"
            className="ml-auto font-mono text-[9px] uppercase"
          >
            {call.id.slice(0, 10)}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="px-3 pb-2 pt-0 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground">
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
        className="grid grid-cols-[60px_1fr] gap-3"
      >
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground pt-1">
          tool <span className="text-muted-foreground/60">#{event.seq}</span>
        </div>
        <div
          className={cn(
            "rounded-md border bg-card/40",
            data.is_error ? "border-destructive/50" : "border-border",
          )}
        >
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors group">
            <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90 text-muted-foreground" />
            <span className="font-mono text-xs">
              {data.name ?? "result"}
              {data.is_error && (
                <span className="ml-2 text-destructive">error</span>
              )}
            </span>
            <Badge
              variant="outline"
              className="ml-auto font-mono text-[9px] uppercase"
            >
              {data.tool_call_id?.slice(0, 10) ?? "?"}
            </Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="px-3 pb-2 pt-0 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground">
              {preview}
            </pre>
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}
