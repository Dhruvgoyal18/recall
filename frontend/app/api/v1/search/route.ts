import { NextResponse, type NextRequest } from "next/server";

import { backendErrorResponse, backendGetJson } from "@/lib/backend-client";
import { authorizeRequest } from "@/lib/require-auth";
import type { SearchResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request);
  if (auth instanceof NextResponse) return auth;

  const q = request.nextUrl.searchParams.get("q");
  if (!q || !q.trim()) {
    return NextResponse.json({ detail: "q query parameter is required" }, { status: 400 });
  }

  try {
    const data = await backendGetJson<SearchResponse>(auth, `/v1/search?q=${encodeURIComponent(q)}`);
    return NextResponse.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
