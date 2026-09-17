"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { backendPostJson, BackendError } from "@/lib/backend-client";
import { SESSION_COOKIE } from "@/lib/auth";

interface AuthResponse {
  token: string;
  expiresAt: string;
}

export async function signup(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent("Passwords don't match.")}`);
  }

  let auth: AuthResponse;
  try {
    auth = await backendPostJson<AuthResponse>(null, "/auth/signup", { email, password });
  } catch (err) {
    const message = err instanceof BackendError ? err.message : "Something went wrong. Try again.";
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, auth.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(auth.expiresAt),
  });

  redirect("/dashboard");
}
