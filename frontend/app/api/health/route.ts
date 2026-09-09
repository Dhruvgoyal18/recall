import { NextResponse } from "next/server";

import { backendHealth } from "@/lib/backend-client";

// Intentionally unauthenticated: this is what free uptime checkers (§6.4)
// and the dashboard's own "backend unreachable" banner poll.
export async function GET() {
  const ok = await backendHealth();
  return NextResponse.json({ status: "ok", backend: ok }, { status: ok ? 200 : 503 });
}
