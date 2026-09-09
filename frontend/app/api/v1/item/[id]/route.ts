import { NextResponse, type NextRequest } from "next/server";

import { backendDelete, backendErrorResponse } from "@/lib/backend-client";
import { authorizeRequest } from "@/lib/require-auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await authorizeRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  try {
    const data = await backendDelete<{ id: string; deleted: boolean }>(`/v1/item/${encodeURIComponent(id)}`);
    return NextResponse.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
