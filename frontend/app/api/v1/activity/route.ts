import { NextResponse, type NextRequest } from "next/server";

import { backendErrorResponse, backendGetJson } from "@/lib/backend-client";
import { authorizeRequest } from "@/lib/require-auth";
import type { ActivityResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request);
  if (auth instanceof NextResponse) return auth;

  const days = request.nextUrl.searchParams.get("days") ?? "30";

  try {
    const data = await backendGetJson<ActivityResponse>(auth, `/v1/activity?days=${encodeURIComponent(days)}`);
    return NextResponse.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
