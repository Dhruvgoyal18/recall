import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "recall_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionCookieValue(): string {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionCookieValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const [payloadB64, signature] = value.split(".");
  if (!payloadB64 || !signature) return false;

  let expected: string;
  try {
    expected = sign(payloadB64);
  } catch {
    return false;
  }
  if (!constantTimeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as { exp: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function verifyPassword(candidate: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || !candidate) return false;
  return constantTimeEqual(candidate, expected);
}

export function verifyBearerToken(authHeader: string | null): boolean {
  const expected = process.env.BACKEND_AUTH_TOKEN;
  if (!expected || !authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);
  return constantTimeEqual(token, expected);
}
