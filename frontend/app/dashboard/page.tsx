import { logout } from "./actions";
import Dashboard from "./Dashboard";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h1 className="text-lg font-semibold">Recall</h1>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Log out
          </button>
        </form>
      </header>
      <Dashboard />
    </div>
  );
}
