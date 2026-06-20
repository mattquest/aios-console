import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionToken, timingSafeEqualStr } from "@/lib/console-auth";

/**
 * Console auth gate. Every request — pages AND the /api/aios/* proxy that
 * injects the full-privilege AIOS_API_KEY — requires the operator session
 * cookie when CONSOLE_PASSWORD is set. Without it, anyone who can reach
 * this port can read every session, every memory, and act as the
 * assistant's operator.
 *
 * CONSOLE_PASSWORD unset → gate off. That is only safe together with the
 * loopback bind (`pnpm start` defaults to -H 127.0.0.1); set a password
 * before exposing the console beyond localhost.
 */
export async function proxy(request: NextRequest) {
  const password = process.env.CONSOLE_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && timingSafeEqualStr(cookie, await sessionToken(password))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { type: "unauthorized", message: "console login required" } },
      { status: 401 },
    );
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Gate everything except Next's static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
