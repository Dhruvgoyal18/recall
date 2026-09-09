import { NextResponse, type NextRequest } from "next/server";

import { backendErrorResponse, backendPostJson } from "@/lib/backend-client";
import { authorizeRequest } from "@/lib/require-auth";
import type { CapturedItem } from "@/lib/types";

export async function POST(request: NextRequest) {
  const unauthorized = await authorizeRequest(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "invalid JSON body" }, { status: 400 });
  }

  try {
    const data = await backendPostJson<{ item: CapturedItem }>("/v1/save", body);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return backendErrorResponse(err);
  }
}
