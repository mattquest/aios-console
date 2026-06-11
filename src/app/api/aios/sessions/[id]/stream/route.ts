import { aiosStream } from "@/lib/aios";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Dedicated SSE proxy. The catch-all ``/api/aios/[...path]`` route would
 * buffer the response and lose streaming; this one pipes the body through
 * verbatim so every ``event:`` and ``data:`` frame reaches the browser as
 * soon as aios flushes it.
 *
 * The request's AbortSignal wires all the way to the upstream fetch — when
 * the browser EventSource closes (tab nav, component unmount) aios stops
 * pushing bytes rather than holding the worker forever.
 */
export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  // Forward the query string so ``?after_seq=N`` reaches aios — the client
  // loads the backlog over the paged events API and tails only the rest.
  let upstream: Response;
  try {
    upstream = await aiosStream(
      `/v1/sessions/${id}/stream${req.nextUrl.search}`,
      req.signal,
    );
  } catch {
    // aios unreachable (or the request aborted mid-connect): a clean 502
    // lets the browser's EventSource back off and retry instead of the
    // route handler crashing with an unhandled fetch rejection.
    return Response.json(
      { detail: "aios unreachable", aios_url: process.env.AIOS_URL ?? null },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
