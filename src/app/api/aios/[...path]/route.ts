import { aiosFetch } from "@/lib/aios";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
// aios responses can exceed the default 1MB cache tier; never cache dev-console
// proxy hits anyway — we want live data every time.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  const qs = req.nextUrl.search;
  const upstream = `/${path.join("/")}${qs}`;

  const init: RequestInit = { method: req.method };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
    init.headers = {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
    };
  }

  let upstreamResp: Response;
  try {
    upstreamResp = await aiosFetch(upstream, init);
  } catch {
    // aios itself is unreachable (connection refused, DNS, AIOS_URL unset).
    // Return a structured 502 instead of a bare 500 so the browser can say
    // "can't reach aios at <url>" rather than "something broke".
    return Response.json(
      {
        detail: "aios unreachable",
        aios_url: process.env.AIOS_URL ?? null,
      },
      { status: 502 },
    );
  }
  // Pass body + status straight through so FastAPI error shapes (detail,
  // code) reach the browser unmodified — the dev console needs to see
  // exactly what aios said.
  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: {
      "Content-Type": upstreamResp.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
export const PATCH = forward;
