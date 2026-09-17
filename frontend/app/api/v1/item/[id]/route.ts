import { NextResponse, type NextRequest } from "next/server";

import { backendDelete, backendErrorResponse } from "@/lib/backend-client";
import { authorizeRequest } from "@/lib/require-auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const data = await backendDelete<{ id: string; deleted: boolean }>(auth, `/v1/item/${encodeURIComponent(id)}`);
    return NextResponse.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
