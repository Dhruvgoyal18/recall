import Link from "next/link";

import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = await searchParams;

  return (
    <main className="mx-auto mt-24 flex max-w-sm flex-col gap-4 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Recall</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sign in to open your archive.</p>
      </div>
      <form action={login} className="flex flex-col gap-3">
        <input type="hidden" name="from" value={from ?? "/dashboard"} />
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          autoFocus
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Sign in
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No account?{" "}
        <Link href="/signup" className="text-indigo-600 hover:underline dark:text-indigo-400">
          Sign up
        </Link>
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
      </p>
    </main>
  );
}
