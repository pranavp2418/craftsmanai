'use client';

/**
 * Global error boundary — catches errors thrown in the root layout itself.
 * Must render its own <html> and <body> because the layout has failed.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[global error]', error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="font-inter bg-surface-page">
        <div className="min-h-[100vh] flex items-center justify-center p-[24px]"

        >
          <div className="bg-white w-[100%] shadow-card-deep max-w-[420px] rounded-panel text-center p-[32px]"

          >
            <h1 className="text-ink text-heading-xs font-semibold mb-[8px]">
              Application error
            </h1>
            <p className="text-ink-500 text-body-sm mb-[20px]">
              The application failed to load. Please refresh the page.
            </p>
            <button className="text-white bg-gradient-indigo border-0 [padding:8px 16px] text-body-sm font-medium rounded-card-lg cursor-pointer"
              type="button"
              onClick={reset}

            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
