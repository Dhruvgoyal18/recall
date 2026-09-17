import Link from "next/link";

import { signup } from "./actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto mt-24 flex max-w-sm flex-col gap-4 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Recall</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create your archive.</p>
      </div>
      <form action={signup} className="flex flex-col gap-3">
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
          placeholder="Password (min 8 characters)"
          minLength={8}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm password"
          minLength={8}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Create account
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 hover:underline dark:text-indigo-400">
          Sign in
        </Link>
      </p>
    </main>
  );
}
