"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { cn, toErrorMessage } from "@/lib/utils";
import type { SessionStatus } from "@/lib/types";
import { Send, Square } from "lucide-react";

interface Props {
  sessionId: string;
  status: SessionStatus | "unknown";
}

export function Composer({ sessionId, status }: Props) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // {active, idle} mirrors the backend's derived status. The composer is
  // ALWAYS sendable — aios's headline property is that the model stays
  // responsive while tools run; interrupt appears alongside, not instead.
  const running = status === "active";

  const send = async () => {
    const content = value.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.postMessage(sessionId, content);
      setValue("");
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const interrupt = async () => {
    try {
      await api.interrupt(sessionId);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  };

  const chars = value.length;

  return (
    <div className="border-t border-border/60 bg-background/70 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-4">
        <div className="relative rounded-sm border border-border/60 bg-card/30 focus-within:border-signal/60 transition-colors">
          <div className="absolute left-3 top-2.5 font-mono text-[12px] text-signal/80 select-none pointer-events-none">
            {running ? "›" : "$"}
          </div>
          <Textarea
            data-testid="composer-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="type a message · ⏎ send · ⇧⏎ newline"
            rows={2}
            className="font-sans text-[13px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 pl-7 pb-10"
          />
          <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between gap-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-3">
              {error ? (
                <span className="text-signal-alert normal-case tracking-normal">
                  {error}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-1 rounded-full",
                      running
                        ? "bg-signal animate-signal"
                        : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="bracket-label">status</span>
                  {status}
                </span>
              )}
              <span className="text-muted-foreground/40 tabular-nums normal-case tracking-normal">
                {String(chars).padStart(3, "0")} ch
              </span>
            </div>
            <div className="flex items-center gap-2">
              {running && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={interrupt}
                  className="h-7 font-mono text-[10px] uppercase tracking-wider border-signal-alert/50 text-signal-alert hover:bg-signal-alert/10"
                  data-testid="interrupt-button"
                >
                  <Square className="size-3" />
                  interrupt
                </Button>
              )}
              <Button
                size="sm"
                onClick={send}
                disabled={!value.trim() || submitting}
                className="h-7 font-mono text-[10px] uppercase tracking-wider"
                data-testid="composer-send"
              >
                <Send className="size-3" />
                {submitting ? "sending" : "send ⏎"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
