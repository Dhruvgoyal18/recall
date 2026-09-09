import { NextResponse } from "next/server";

export class BackendError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function backendUrl(path: string): string {
  const base = process.env.BACKEND_URL;
  if (!base) {
    throw new BackendError("BACKEND_URL is not configured", 503);
  }
  return `${base.replace(/\/$/, "")}${path}`;
}

function backendHeaders(extra?: HeadersInit): HeadersInit {
  const token = process.env.BACKEND_AUTH_TOKEN;
  if (!token) {
    throw new BackendError("BACKEND_AUTH_TOKEN is not configured", 503);
  }
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra };
}

async function safeErrorDetail(res: Response): Promise<string | null> {
  try {
    const data = (await res.json()) as { detail?: unknown };
    return typeof data.detail === "string" ? data.detail : null;
  } catch {
    return null;
  }
}

async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(backendUrl(path), {
      ...init,
      headers: backendHeaders(init?.headers),
      cache: "no-store",
    });
  } catch {
    throw new BackendError("Backend is unreachable", 503);
  }
  return res;
}

export async function backendGetJson<T>(path: string): Promise<T> {
  const res = await backendFetch(path);
  if (!res.ok) throw new BackendError((await safeErrorDetail(res)) ?? `Backend returned ${res.status}`, res.status);
  return (await res.json()) as T;
}

export async function backendPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await backendFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new BackendError((await safeErrorDetail(res)) ?? `Backend returned ${res.status}`, res.status);
  return (await res.json()) as T;
}

export async function backendDelete<T>(path: string): Promise<T> {
  const res = await backendFetch(path, { method: "DELETE" });
  if (!res.ok) throw new BackendError((await safeErrorDetail(res)) ?? `Backend returned ${res.status}`, res.status);
  return (await res.json()) as T;
}

export async function backendHealth(): Promise<boolean> {
  try {
    const res = await fetch(backendUrl("/health"), { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export function backendErrorResponse(err: unknown): NextResponse {
  if (err instanceof BackendError) {
    return NextResponse.json({ detail: err.message }, { status: err.status });
  }
  return NextResponse.json({ detail: "unexpected error" }, { status: 500 });
}
