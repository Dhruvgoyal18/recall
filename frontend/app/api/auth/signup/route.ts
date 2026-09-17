import { NextResponse, type NextRequest } from "next/server";

import { backendErrorResponse, backendPostJson } from "@/lib/backend-client";

interface AuthResponse {
  token: string;
  expiresAt: string;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "invalid JSON body" }, { status: 400 });
  }

  try {
    const data = await backendPostJson<AuthResponse>(null, "/auth/signup", body);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return backendErrorResponse(err);
  }
}
