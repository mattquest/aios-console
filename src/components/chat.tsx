"use client";

import { useMemo, useRef } from "react";
import type { AiosEvent, AwaitingToolCall, ToolCall } from "@/lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import {
  channelLabel,
  channelLabelFromSendResult,
  parseMessageMetadata,
  type ChannelLabel,
} from "@/lib/channels";
import {
  connectorSendText,
  contentParts,
  contentText,
  isMonologue,
  stripMonologue,
} from "@/lib/messages";
import { useInFlightSpan } from "@/hooks/use-inflight-span";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";

interface Props {
  events: AiosEvent[];
  streamingContent: string;
  connected: boolean;
  /** Pending always_ask tool calls rendered as inline approval cards. */
  awaiting?: AwaitingToolCall[];
  agentName?: string | null;
  confirmingId?: string | null;
  onConfirm?: (toolCallId: string, result: "allow" | "deny") => void;
  /** Older history exists beyond the loaded window. */
  hasEarlier?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => Promise<void>;
}

export function Chat({
  events,
  streamingContent,
  connected,
  awaiting,
  agentName,
  confirmingId,
  onConfirm,
  hasEarlier,
  loadingEarlier,
  onLoadEarlier,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageEvents = useMemo(
    () => events.filter((e) => e.kind === "message"),
    [events],
  );
  const inFlight = useInFlightSpan(events);
  const approvals = useMemo(
    () => (awaiting ?? []).filter((a) => a.kind !== "custom"),
    [awaiting],
  );

  // Stick the chat to the bottom on new content (tokens, new messages, the
  // generating-indicator elapsed tick) — but only if the user is already
  // near the bottom, so scrolling up to read earlier context is respected.
  useStickToBottom(
    scrollRef,
    `${messageEvents.length}·${streamingContent.length}·${inFlight?.elapsedMs ?? 0}·${approvals.length}`,
  );

  // Screen-reader announcement: the latest user-visible assistant utterance.
  // Completed messages only (the streaming buffer would announce per-token);
  // monologues opted out of delivery, so they stay silent here too. When the
  // text changes, the polite live region below reads it out.
  const announcement = useMemo(() => {
    for (let i = messageEvents.length - 1; i >= 0; i--) {
      const data = messageEvents[i].data as {
        role?: string;
        content?: unknown;
        tool_calls?: ToolCall[];
      };
      if (data.role !== "assistant") continue;
      const text = contentText(data.content);
      if (text) return isMonologue(text) ? null : text;
      const sends = (data.tool_calls ?? [])
        .map((tc) => connectorSendText(tc))
        .filter((t): t is string => t !== null);
      return sends.length > 0 ? sends.join("\n") : null;
    }
    return null;
  }, [messageEvents]);

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

  // Prepending history would otherwise shove the viewport down by the
  // height of the new rows — restore the visual position afterwards.
  const handleLoadEarlier = () => {
    if (!onLoadEarlier) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    void onLoadEarlier().then(() => {
      requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (node) node.scrollTop = prevTop + (node.scrollHeight - prevHeight);
      });
    });
  };

  return (
    <>
      {/* Outside the scroll container so transcript text queries (and the
          visual tree) see each message exactly once. */}
      <div
        role="status"
        aria-live="polite"
        data-testid="chat-live-region"
        className="sr-only"
      >
        {announcement}
      </div>
      <div
        ref={scrollRef}
        data-testid="chat-messages"
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 space-y-8">
          {hasEarlier && (
            <div className="flex justify-center">
              <button
                type="button"
                data-testid="load-earlier"
                onClick={handleLoadEarlier}
                disabled={loadingEarlier}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground border border-border/60 hover:border-foreground/40 rounded-sm px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {loadingEarlier ? "loading…" : "↑ load earlier"}
              </button>
            </div>
          )}
          {messageEvents.length === 0 && !showStreaming && !showGenerating && (
            <ChatEmptyState />
          )}
          {messageEvents.map((e) => (
            <MessageRow key={e.id} event={e} />
          ))}
          {approvals.map((a) => (
            <ApprovalCard
              key={a.tool_call_id}
              awaiting={a}
              events={events}
              agentName={agentName}
              confirming={confirmingId === a.tool_call_id}
              onConfirm={onConfirm}
            />
          ))}
          {showStreaming && (
            <StreamingAssistant content={streamingContent} connected={connected} />
          )}
          {showGenerating && inFlight && <GeneratingIndicator inFlight={inFlight} />}
        </div>
      </div>
    </>
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
        <span aria-hidden className="size-1.5 rounded-full bg-signal-warn animate-signal" />
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
            <span aria-hidden className="size-1.5 rounded-full bg-signal animate-signal" />
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
  human: "human",
  signal: "signal",
  assistant: "model",
  system: "system",
  tool: "tool",
};

function formatTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function RoleGutter({
  role,
  seq,
  at,
}: {
  role: string;
  seq: number;
  at?: string;
}) {
  const time = at ? formatTime(at) : null;
  return (
    <div className="pt-1 space-y-1">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 flex items-baseline gap-2">
        <span>{ROLE_LABEL[role] ?? role}</span>
        <span className="text-muted-foreground/40 tabular-nums">
          #{String(seq).padStart(3, "0")}
        </span>
      </div>
      {time && (
        <div
          data-testid="message-time"
          title={at}
          className="font-mono text-[10px] tabular-nums text-muted-foreground/50"
        >
          {time}
        </div>
      )}
    </div>
  );
}

function ChannelProvenance({ label }: { label: ChannelLabel }) {
  return (
    <div
      data-testid="channel-provenance"
      title={label.channel}
      className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70 flex items-center gap-1.5"
    >
      <span className="text-signal-system">{label.source}</span>
      <span className="text-muted-foreground/40">/</span>
      <span className="normal-case tracking-normal text-muted-foreground">
        {label.detail}
      </span>
    </div>
  );
}

function MessageRow({ event }: { event: AiosEvent }) {
  const data = event.data as {
    role?: string;
    content?: unknown;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
    metadata?: unknown;
  };
  const role = data.role ?? "?";

  if (role === "tool") return <ToolResultRow event={event} />;

  const toolCalls = data.tool_calls ?? [];
  const isAssistant = role === "assistant";

  // Connector sends are what the user actually received — promote them to
  // first-class assistant bubbles. Everything else stays an invoke card.
  const sends: { call: ToolCall; text: string }[] = [];
  const plumbing: ToolCall[] = [];
  for (const tc of toolCalls) {
    const text = isAssistant ? connectorSendText(tc) : null;
    if (text !== null) sends.push({ call: tc, text });
    else plumbing.push(tc);
  }

  const parts = contentParts(data.content);
  const fullText = contentText(data.content);
  const monologue = isAssistant && isMonologue(fullText);
  const inbound =
    role === "user" ? channelLabel(parseMessageMetadata(data)) : null;

  return (
    <div
      data-testid={`message-${role}`}
      data-seq={event.seq}
      className="grid grid-cols-[72px_1fr] gap-4"
    >
      <RoleGutter
        role={inbound?.source === "console" ? role : inbound?.source ?? role}
        seq={event.seq}
        at={event.created_at}
      />
      <div className="space-y-3 min-w-0">
        {inbound && <ChannelProvenance label={inbound} />}
        {monologue ? (
          <MonologueDisclosure text={stripMonologue(fullText)} />
        ) : (
          parts.map((part, i) =>
            part.type === "text" ? (
              <Markdown
                key={i}
                className={cn(
                  "leading-relaxed",
                  isAssistant
                    ? "font-sans text-[15px] text-foreground"
                    : "font-sans text-[14px] text-foreground/90",
                )}
              >
                {part.text}
              </Markdown>
            ) : (
              <ImagePart key={i} url={part.url} />
            ),
          )
        )}
        {sends.map(({ call, text }) => (
          <ConnectorSend
            key={call.id}
            name={call.function.name}
            text={text}
          />
        ))}
        {plumbing.map((tc) => (
          <ToolCallCard key={tc.id} call={tc} />
        ))}
      </div>
    </div>
  );
}

/**
 * Assistant text that opted out of delivery — collapsed by default so the
 * conversation reads as what the user actually saw.
 */
function MonologueDisclosure({ text }: { text: string }) {
  return (
    <Collapsible>
      <div data-testid="monologue" className="min-w-0">
        <CollapsibleTrigger
          data-testid="monologue-toggle"
          className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-muted-foreground transition-colors group"
        >
          <ChevronRight className="size-3 transition-transform group-data-[panel-open]:rotate-90" />
          <span>thinking</span>
          <span className="text-muted-foreground/40 normal-case tracking-normal tabular-nums">
            {text.length} ch · not sent to user
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 pl-3 border-l border-border/60">
            <Markdown className="font-sans text-[13px] leading-relaxed text-muted-foreground">
              {text}
            </Markdown>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/** A connector send (signal_send, telegram_send, …) — speech, not plumbing. */
function ConnectorSend({ name, text }: { name: string; text: string }) {
  return (
    <div data-testid="connector-send" className="space-y-1 min-w-0">
      <ChannelProvenance
        label={{ source: name.replace(/_send$/, ""), detail: "outbound" }}
      />
      <Markdown className="font-sans text-[15px] leading-relaxed text-foreground">
        {text}
      </Markdown>
    </div>
  );
}

function ImagePart({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      data-testid="message-image-link"
      className="block w-fit max-w-full"
      title="open full size in a new tab"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- message images
          are arbitrary user/agent-supplied URLs (incl. data: URIs); the Next
          image optimizer can't proxy those. */}
      <img
        src={url}
        alt="message attachment"
        data-testid="message-image"
        className="max-h-72 w-auto max-w-full rounded-sm border border-border/60"
      />
    </a>
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
          aria-hidden
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

/** Search the log for the pending call's arguments to summarise them. */
function findToolCallArgs(events: AiosEvent[], toolCallId: string): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind !== "message") continue;
    const calls = (e.data as { tool_calls?: ToolCall[] }).tool_calls ?? [];
    const match = calls.find((c) => c.id === toolCallId);
    if (match) return match.function.arguments;
  }
  return null;
}

function summariseArgs(raw: string | null): string | null {
  if (!raw) return null;
  let rendered = raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      rendered = Object.entries(parsed as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join("\n");
    } else {
      rendered = JSON.stringify(parsed, null, 2);
    }
  } catch {
    /* show raw arguments as-is */
  }
  return rendered.length > 600 ? rendered.slice(0, 599) + "…" : rendered;
}

/**
 * Inline approval card for an always_ask tool call. The session is paused
 * on this decision — it belongs in the conversation, not in a header bar.
 */
function ApprovalCard({
  awaiting,
  events,
  agentName,
  confirming,
  onConfirm,
}: {
  awaiting: AwaitingToolCall;
  events: AiosEvent[];
  agentName?: string | null;
  confirming: boolean;
  onConfirm?: (toolCallId: string, result: "allow" | "deny") => void;
}) {
  const args = summariseArgs(findToolCallArgs(events, awaiting.tool_call_id));
  return (
    <div
      data-testid={`approval-card-${awaiting.name}`}
      className="grid grid-cols-[72px_1fr] gap-4 animate-rise"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-warn pt-1 flex items-baseline gap-2">
        <span>hold</span>
        <span aria-hidden className="size-1.5 rounded-full bg-signal-warn animate-signal" />
      </div>
      <div className="rounded-sm border border-signal-warn/40 bg-signal-warn/5 min-w-0">
        <div className="px-3 py-2 border-b border-signal-warn/20 flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-signal-warn">
            [approval]
          </span>
          <span className="font-sans text-[13px] text-foreground/90">
            {agentName || "the assistant"} wants to run{" "}
            <code className="font-mono text-[12px] text-foreground">
              {awaiting.name}
            </code>
          </span>
        </div>
        {args && (
          <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-all text-muted-foreground/90 border-b border-signal-warn/20 max-h-48 overflow-y-auto">
            {args}
          </pre>
        )}
        <div className="px-3 py-2 flex items-center gap-2">
          <Button
            size="sm"
            className="h-6 font-mono text-[10px] uppercase tracking-wider"
            disabled={confirming || !onConfirm}
            onClick={() => onConfirm?.(awaiting.tool_call_id, "allow")}
            data-testid={`approve-${awaiting.name}`}
          >
            allow
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 font-mono text-[10px] uppercase tracking-wider border-signal-alert/50 text-signal-alert hover:bg-signal-alert/10"
            disabled={confirming || !onConfirm}
            onClick={() => onConfirm?.(awaiting.tool_call_id, "deny")}
            data-testid={`deny-${awaiting.name}`}
          >
            deny
          </Button>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
            {confirming ? "submitting…" : "session paused on this decision"}
          </span>
        </div>
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
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
            invoke
          </span>
          <span className="font-mono text-[11px] text-foreground">
            {call.function.name}
          </span>
          <span
            title={call.id}
            className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60"
          >
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
    content?: unknown;
    is_error?: boolean;
  };
  const content = contentText(data.content);
  const delivery = channelLabelFromSendResult(data.name, data.content);
  let preview: string;
  try {
    const parsed = JSON.parse(content);
    preview = JSON.stringify(parsed, null, 2);
  } catch {
    preview = content;
  }

  if (delivery && !data.is_error) {
    return (
      <div
        data-testid="message-tool"
        data-seq={event.seq}
        className="grid grid-cols-[72px_1fr] gap-4"
      >
        <RoleGutter role="tool" seq={event.seq} at={event.created_at} />
        <div className="font-mono text-[10px] text-muted-foreground/80 space-y-1 min-w-0">
          <ChannelProvenance label={delivery} />
          <span className="text-signal/80">delivered via {data.name}</span>
        </div>
      </div>
    );
  }

  return (
    <Collapsible>
      <div
        data-testid="message-tool"
        data-seq={event.seq}
        className="grid grid-cols-[72px_1fr] gap-4"
      >
        <RoleGutter role="tool" seq={event.seq} at={event.created_at} />
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
                "font-mono text-[10px] uppercase tracking-[0.18em]",
                data.is_error ? "text-signal-alert" : "text-signal",
              )}
            >
              {data.is_error ? "error" : "result"}
            </span>
            <span className="font-mono text-[11px] text-foreground">
              {data.name ?? "tool"}
            </span>
            <span
              title={data.tool_call_id}
              className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60"
            >
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
