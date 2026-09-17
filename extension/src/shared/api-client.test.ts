import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, login, signup } from "./api-client";

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("posts to /api/auth/login with a trailing-slash-normalized base URL", async () => {
    mockFetchOnce(200, { token: "jwt-token", expiresAt: "2026-10-01T00:00:00Z" });

    const result = await login("https://dashboard.example.com/", "a@b.com", "pw123456");

    expect(fetch).toHaveBeenCalledWith(
      "https://dashboard.example.com/api/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "pw123456" }),
      }),
    );
    expect(result).toEqual({ token: "jwt-token", expiresAt: "2026-10-01T00:00:00Z" });
  });

  it("throws ApiError with the backend's detail message on failure", async () => {
    mockFetchOnce(401, { detail: "invalid email or password" });

    await expect(login("https://dashboard.example.com", "a@b.com", "wrong")).rejects.toMatchObject({
      message: "invalid email or password",
      status: 401,
    });
  });

  it("throws ApiError with a generic message when the error body isn't JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );

    const err = await login("https://dashboard.example.com", "a@b.com", "pw").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("HTTP 500");
    expect(err.status).toBe(500);
  });

  it("throws a network-error ApiError when fetch itself rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(login("https://dashboard.example.com", "a@b.com", "pw")).rejects.toMatchObject({
      message: "network error",
    });
  });
});

describe("signup", () => {
  it("posts to /api/auth/signup", async () => {
    mockFetchOnce(201, { token: "jwt-token", expiresAt: "2026-10-01T00:00:00Z" });

    await signup("https://dashboard.example.com", "new@user.com", "pw12345678");

    expect(fetch).toHaveBeenCalledWith(
      "https://dashboard.example.com/api/auth/signup",
      expect.objectContaining({
        body: JSON.stringify({ email: "new@user.com", password: "pw12345678" }),
      }),
    );
  });

  it("surfaces a 409 conflict detail", async () => {
    mockFetchOnce(409, { detail: "an account with that email already exists" });

    await expect(signup("https://dashboard.example.com", "dup@user.com", "pw12345678")).rejects.toMatchObject({
      message: "an account with that email already exists",
      status: 409,
    });
  });
});
