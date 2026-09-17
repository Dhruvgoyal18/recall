import { NextResponse, type NextRequest } from "next/server";

import { isSessionTokenValid, SESSION_COOKIE } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/signup"];

/**
 * Gates every dashboard page behind sign-in. /api/* routes authenticate
 * themselves per-request (session cookie for the browser dashboard, bearer
 * token for the extension) — see lib/require-auth.ts, which is also the
 * source of truth: this is just a light expiry check for redirect UX.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") || PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (isSessionTokenValid(session)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
