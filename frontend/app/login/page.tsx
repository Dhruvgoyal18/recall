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
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enter the password to open your archive.
        </p>
      </div>
      <form action={login} className="flex flex-col gap-3">
        <input type="hidden" name="from" value={from ?? "/dashboard"} />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          autoFocus
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Unlock
        </button>
        {error && <p className="text-sm text-red-600">Incorrect password.</p>}
      </form>
    </main>
  );
}
