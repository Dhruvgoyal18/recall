import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "./auth";

/**
 * API proxy routes accept the caller's own token, from either of two
 * sources: the browser dashboard's signed-in session cookie, or the Chrome
 * extension's stored personal JWT sent as a bearer token. Whichever one is
 * present is forwarded to the backend as-is, so the backend always knows the
 * real caller's identity and scopes data to that user.
 */
export async function getCallerToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function authorizeRequest(request: NextRequest): Promise<string | NextResponse> {
  const token = await getCallerToken(request);
  if (!token) {
    return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  }
  return token;
}
