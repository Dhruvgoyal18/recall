export const metadata = {
  title: "Privacy Policy — Recall",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto mt-16 mb-24 flex max-w-2xl flex-col gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Last updated September 18, 2026.</p>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300">
        Recall is a personal archive: you manually choose what to save, from the Chrome extension or this
        dashboard, and nothing is captured unless you click &quot;Save.&quot; This page explains what data
        that involves.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">What we collect</h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>Your email address and a hashed password, when you sign up.</li>
          <li>
            The content you choose to save — a page URL and title, plus either your text selection or the
            full page text — along with the time it was saved.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">How we use it</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Solely to run Recall: authenticating you, and storing and displaying the items you&apos;ve saved.
          We don&apos;t sell or share your data with third parties, and we don&apos;t run any analytics or
          advertising trackers in the extension or this dashboard.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Error monitoring</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          This dashboard can optionally use Sentry to report crashes so we can fix bugs. It&apos;s off by
          default; if enabled, a crash report may include limited technical metadata (such as browser
          details and a stack trace) — never your password or saved item content.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Deleting your data</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          You can delete any saved item from the dashboard at any time. To delete your account and all
          associated data, email us at the address below and we&apos;ll take care of it.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Contact</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Questions about this policy or your data:{" "}
          <a href="mailto:dhruvgoyal990@gmail.com" className="text-indigo-600 hover:underline dark:text-indigo-400">
            dhruvgoyal990@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
