import { NextResponse, type NextRequest } from "next/server";

import { backendErrorResponse, backendGetJson } from "@/lib/backend-client";
import { authorizeRequest } from "@/lib/require-auth";
import type { ItemsResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const unauthorized = await authorizeRequest(request);
  if (unauthorized) return unauthorized;

  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ detail: "date query parameter is required" }, { status: 400 });
  }

  try {
    const data = await backendGetJson<ItemsResponse>(`/v1/items?date=${encodeURIComponent(date)}`);
    return NextResponse.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
