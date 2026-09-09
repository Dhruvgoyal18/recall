import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionCookieValue } from "./lib/auth";

const PUBLIC_PATHS = ["/login"];

/**
 * Gates every dashboard page behind the single-user password login (FR18).
 * /api/* routes authenticate themselves per-request (session cookie for the
 * browser dashboard, bearer token for the extension) — see lib/require-auth.ts.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") || PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionCookieValue(session)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
