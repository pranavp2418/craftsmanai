'use client';

/**
 * Route-level error boundary.
 * Triggered when an error is thrown inside a route segment under `app/`.
 *
 * For developers: wire `error` up to your error tracking provider (Sentry,
 * Datadog, etc.) in the `useEffect` below.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO: report to error tracking — e.g. Sentry.captureException(error)
    // Avoid logging the full error object in production to prevent leaking
    // internals. The `digest` is a stable, non-sensitive identifier from Next.js.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[route error]', error);
    }
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 bg-surface-page">
      <div
        className="max-w-md w-full rounded-2xl border border-white/60 p-8 text-center bg-glass-85 backdrop-blur-lg shadow-glow-indigo-tint">
        <div
          className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-tint-danger">
          <span className="ri-error-warning-line text-heading-md text-danger-bright"/>
        </div>
        <h2
          className="text-heading-xs font-semibold text-ink mb-1 font-satoshi">
          Something went wrong
        </h2>
        <p className="text-body-sm text-ink-500 mb-5">
          An unexpected error occurred. You can try again, or return to the dashboard.
        </p>
        {error.digest && (
          <p className="text-label-xs text-ink-400 mb-5 font-mono">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl text-body-sm font-medium text-white cursor-pointer bg-gradient-indigo">
            Try again
          </button>
          {/* <Link
            href="/"
            className="px-4 py-2 rounded-xl text-body-sm font-medium text-ink-700 border border-default hover:bg-surface-hover cursor-pointer"
          >
            Back to dashboard
          </Link> */}
        </div>
      </div>
    </div>
  );
}
