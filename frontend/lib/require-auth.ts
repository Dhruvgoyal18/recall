import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifyBearerToken, verifySessionCookieValue } from "./auth";

/**
 * API proxy routes accept two independent credentials because two different
 * callers use them: the browser dashboard (signed session cookie, set at
 * /login) and the Chrome extension (the shared bearer token it stores in
 * chrome.storage). Neither the token nor the cookie secret ever reaches the
 * frontend's browser bundle — only the resulting cookie does.
 */
export async function authorizeRequest(request: NextRequest): Promise<NextResponse | null> {
  if (verifyBearerToken(request.headers.get("authorization"))) {
    return null;
  }
  const cookieStore = await cookies();
  if (verifySessionCookieValue(cookieStore.get(SESSION_COOKIE)?.value)) {
    return null;
  }
  return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
}
