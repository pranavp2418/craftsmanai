/**
 * 404 page — rendered when a route doesn't exist or `notFound()` is called.
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 bg-surface-page">
      <div
        className="max-w-md w-full rounded-2xl border border-white/60 p-8 text-center bg-glass-85 backdrop-blur-lg shadow-glow-indigo-tint">
        <div
          className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-tint-indigo">
          <span className="ri-compass-3-line text-heading-md text-indigo-accent"/>
        </div>
        <h1
          className="text-heading font-semibold text-ink mb-1 font-satoshi">
          Page not found
        </h1>
        <p className="text-body-sm text-ink-500 mb-5">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl text-body-sm font-medium text-white cursor-pointer bg-gradient-indigo">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
