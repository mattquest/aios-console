/**
 * Console auth primitives, shared by the proxy gate and the login route.
 *
 * Model: a single operator password (CONSOLE_PASSWORD, server-side env).
 * The session cookie carries hex(SHA-256("aios-console-v1:" + password)) —
 * deterministic, so the proxy can validate without any session store, and
 * rotating the password invalidates every outstanding cookie. Web Crypto
 * only, so the same code runs in the proxy and in route handlers.
 *
 * When CONSOLE_PASSWORD is unset the gate is OFF — pair that only with a
 * loopback bind (the default `pnpm start` binds 127.0.0.1).
 */

export const SESSION_COOKIE = "aios_console_session";

const CONTEXT = "aios-console-v1:";

export async function sessionToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(CONTEXT + password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison (over UTF-8 bytes). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // Length leak is fine: token length is fixed, and password length is
  // already observable from the request body.
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
