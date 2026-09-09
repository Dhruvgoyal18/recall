"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        {/* NextError is the default Next.js error page component, reused
            here so this global boundary still gets Next's built-in styling. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
