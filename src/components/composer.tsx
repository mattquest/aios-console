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

  const running = status === "running" || status === "waiting";

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

  return (
    <div className="border-t border-border/60 bg-background/70 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-8 py-4">
        <div className="relative rounded-sm border border-border/60 bg-card/30 focus-within:border-signal/60 transition-colors">
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
            placeholder="send a message · enter to submit · shift+enter newline"
            rows={2}
            className="font-sans text-[13px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 pb-10"
          />
          <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between gap-2">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {error ? (
                <span className="text-signal-alert">{error}</span>
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
            </div>
            {running ? (
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
            ) : (
              <Button
                size="sm"
                onClick={send}
                disabled={!value.trim() || submitting}
                className="h-7 font-mono text-[10px] uppercase tracking-wider"
                data-testid="composer-send"
              >
                <Send className="size-3" />
                {submitting ? "sending" : "send"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
