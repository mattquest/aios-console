"use client";

import { ApiError } from "@/lib/client";
import { cn, toErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Plain-language rendering of an API failure, shared across pages. The
 * translation lives in ``describeError`` so any surface (banner, toast,
 * inline note) says the same thing about the same failure.
 */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) {
      return "The backend rejected the console's API key — check AIOS_API_KEY in .env.local.";
    }
    if (e.status === 502) {
      const url = parseAiosUrl(e.body);
      return `Can't reach aios${url ? ` at ${url}` : ""} — make sure the backend is running.`;
    }
    if (e.status >= 500) {
      return `aios hit an internal error (HTTP ${e.status}). Try again; if it keeps happening, check the backend logs.`;
    }
    if (e.status === 404) {
      return "aios doesn't have that resource (HTTP 404). It may have been deleted.";
    }
    return `aios rejected the request (HTTP ${e.status}).`;
  }
  if (e instanceof TypeError) {
    return "Network error — the console server didn't respond. Check your connection.";
  }
  return toErrorMessage(e);
}

function parseAiosUrl(body?: string): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { aios_url?: unknown };
    return typeof parsed.aios_url === "string" ? parsed.aios_url : null;
  } catch {
    return null;
  }
}

/** FastAPI ``detail`` (or the raw body) for the small technical footnote. */
function errorDetail(e: unknown): string | null {
  if (!(e instanceof ApiError) || !e.body) return null;
  try {
    const parsed = JSON.parse(e.body) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    /* not JSON — fall through to the raw body */
  }
  const raw = e.body.trim();
  if (!raw || raw.startsWith("<")) return null; // skip HTML error pages
  return raw.length > 200 ? raw.slice(0, 199) + "…" : raw;
}

export function ErrorBanner({
  error,
  onRetry,
  className,
  testId = "error-banner",
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  testId?: string;
}) {
  const detail = errorDetail(error);
  return (
    <div
      data-testid={testId}
      className={cn(
        "border border-signal-alert/40 bg-signal-alert/5 rounded-sm px-4 py-3 space-y-1.5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-signal-alert shrink-0 pt-0.5">
          [fault]
        </span>
        <p className="font-sans text-[13px] text-foreground/90 leading-relaxed flex-1 min-w-0">
          {describeError(error)}
        </p>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="h-6 font-mono text-[10px] uppercase tracking-wider shrink-0"
            data-testid={`${testId}-retry`}
          >
            retry
          </Button>
        )}
      </div>
      {detail && (
        <div className="pl-[46px] font-mono text-[10px] text-muted-foreground/70 break-all">
          {detail}
        </div>
      )}
    </div>
  );
}
