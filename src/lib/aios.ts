import "server-only";

/**
 * Server-only helpers for talking to the aios backend.
 *
 * aios exposes a single shared bearer token via ``AIOS_API_KEY``. Rather
 * than hand that key to the browser (where any extension could scrape it),
 * the UI goes through Next.js route handlers that forward to ``AIOS_URL``
 * with the key injected server-side. Client components call ``/api/aios/...``
 * and never see the key.
 */

export function aiosBase(): string {
  const url = process.env.AIOS_URL;
  if (!url) throw new Error("AIOS_URL is not set");
  return url.replace(/\/$/, "");
}

function authHeader(): string {
  const key = process.env.AIOS_API_KEY;
  if (!key) throw new Error("AIOS_API_KEY is not set");
  return `Bearer ${key}`;
}

/**
 * Forward a request to aios with the bearer token attached.
 *
 * Pass-through for JSON bodies, headers, and status codes. Preserves the
 * content-type so the browser can read JSON errors straight from aios's
 * FastAPI responses without reshape.
 */
export async function aiosFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", authHeader());
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(`${aiosBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

/**
 * Stream an SSE response from aios. Returns the raw Response so the caller
 * can pipe the body straight through to the browser without buffering.
 */
export async function aiosStream(path: string, signal?: AbortSignal): Promise<Response> {
  return fetch(`${aiosBase()}${path}`, {
    headers: {
      Authorization: authHeader(),
      Accept: "text/event-stream",
    },
    signal,
    cache: "no-store",
  });
}
