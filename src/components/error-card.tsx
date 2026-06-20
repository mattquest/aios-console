"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Fallback UI for route error boundaries (error.tsx). A rendering bug
 * must show a plain-language card with a way out — never a white screen.
 */
export function ErrorCard({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Keep the full error visible to developers in the console.
    console.error(error);
  }, [error]);

  return (
    <div
      className="flex-1 flex items-center justify-center p-6"
      data-testid="error-card"
    >
      <div className="max-w-md w-full rounded-sm border border-signal-alert/40 bg-card/40 backdrop-blur-sm overflow-hidden">
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border/50 text-pico text-signal-alert">
          <span className="size-1.5 rounded-full bg-signal-alert animate-signal" />
          <span>render fault</span>
        </div>
        <div className="px-4 py-5 space-y-4">
          <p className="font-sans text-[13px] text-foreground/90 leading-relaxed">
            Something went wrong while drawing this view. Your sessions and
            data are safe on the backend — only the display failed.
          </p>
          {error.digest && (
            <p className="font-mono text-[10px] text-muted-foreground/70">
              ref {error.digest}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => window.location.reload()}
              className="h-7 font-mono text-[10px] uppercase tracking-wider"
              data-testid="error-reload"
            >
              reload
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={retry}
              className="h-7 font-mono text-[10px] uppercase tracking-wider"
              data-testid="error-retry"
            >
              try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
