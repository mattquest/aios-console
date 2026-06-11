import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken, timingSafeEqualStr } from "@/lib/console-auth";

/**
 * Operator login: exchanges CONSOLE_PASSWORD for the session cookie the
 * proxy gate checks. With no CONSOLE_PASSWORD configured the gate is off
 * and this endpoint just says so.
 */
export async function POST(request: Request) {
  const password = process.env.CONSOLE_PASSWORD;
  if (!password) {
    return NextResponse.json({ ok: true, gate: "disabled" });
  }
  let supplied: unknown;
  try {
    supplied = ((await request.json()) as { password?: unknown }).password;
  } catch {
    supplied = undefined;
  }
  if (typeof supplied !== "string" || !timingSafeEqualStr(supplied, password)) {
    return NextResponse.json(
      { error: { type: "unauthorized", message: "wrong password" } },
      { status: 401 },
    );
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: new URL(request.url).protocol === "https:",
  });
  return response;
}
