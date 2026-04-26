"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { Send, Square } from "lucide-react";

interface Props {
  sessionId: string;
  status: string;
}

/**
 * Message composer + interrupt control. Enter submits, Shift+Enter
 * inserts a newline — matching Claude's conversation UX. The interrupt
 * button replaces the send button whenever the session is running so
 * devs can kill a turn without pulling out curl.
 */
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const interrupt = async () => {
    try {
      await api.interrupt(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="border-t border-border bg-background">
      <div className="p-3">
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
          placeholder="send a message (enter to send, shift+enter for newline)"
          rows={2}
          className="font-mono text-xs resize-none bg-muted/30 border-border/50"
        />
        <div className="flex items-center justify-between pt-2">
          <div className="text-[10px] font-mono text-muted-foreground">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              `status: ${status}`
            )}
          </div>
          {running ? (
            <Button
              size="sm"
              variant="outline"
              onClick={interrupt}
              className="font-mono text-xs"
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
              className="font-mono text-xs"
              data-testid="composer-send"
            >
              <Send className="size-3" />
              send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
