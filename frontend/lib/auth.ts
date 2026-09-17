export const SESSION_COOKIE = "recall_session";

/**
 * The session cookie holds the backend-issued JWT directly. The frontend
 * never holds the signing secret — the backend is the sole authority that
 * verifies the signature on every API call. This is only a light, unverified
 * decode of the payload so middleware can redirect to /login on an obviously
 * expired/malformed token without a network round trip; a tampered or
 * revoked token still gets rejected by the backend on the next API call.
 */
export function decodeJwtExpiryMs(token: string | undefined | null): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isSessionTokenValid(token: string | undefined | null): boolean {
  const expMs = decodeJwtExpiryMs(token);
  return typeof expMs === "number" && expMs > Date.now();
}
