/**
 * Route-level loading UI. Rendered during navigation between route segments
 * while async server components are streaming.
 */

export default function Loading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-surface-page">
      <div className="flex items-center gap-3">
        <span
          className="w-5 h-5 rounded-full animate-spin border-2 border-indigo-ring border-t-indigo-accent"
        />
        <span className="text-body-sm font-medium text-ink-500">Loading…</span>
      </div>
    </div>
  );
}
