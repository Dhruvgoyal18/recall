import { NextResponse, type NextRequest } from "next/server";

import { backendErrorResponse, backendGetJson } from "@/lib/backend-client";
import { authorizeRequest } from "@/lib/require-auth";
import type { ActivityResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const unauthorized = await authorizeRequest(request);
  if (unauthorized) return unauthorized;

  const days = request.nextUrl.searchParams.get("days") ?? "30";

  try {
    const data = await backendGetJson<ActivityResponse>(`/v1/activity?days=${encodeURIComponent(days)}`);
    return NextResponse.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
