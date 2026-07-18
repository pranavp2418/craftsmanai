import React from 'react';

interface RestoreItemModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function RestoreItemModal({ open, onClose, onConfirm }: RestoreItemModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restore-title"
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl bg-white dark:bg-surface-100 p-6 sm:p-8 shadow-2xl max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-brand/10">
          <svg xmlns="http://www.w3.org/2000/svg" width="19" height="18" viewBox="0 0 19 18" fill="none" aria-hidden="true">
            <path d="M5.115 5.98535L7.02 7.89035L5.955 8.94035L2.25 5.23535L5.955 1.51535L7.02 2.58035L5.115 4.48535H10.5C11.59 4.48535 12.6 4.75535 13.53 5.29535C14.43 5.82535 15.145 6.54535 15.675 7.45535C16.225 8.38535 16.5 9.39285 16.5 10.4779C16.5 11.5629 16.225 12.5754 15.675 13.5154C15.145 14.4154 14.43 15.1304 13.53 15.6604C12.6 16.2104 11.59 16.4854 10.5 16.4854H3.75V14.9854H10.5C11.31 14.9854 12.065 14.7804 12.765 14.3704C13.445 13.9704 13.985 13.4304 14.385 12.7504C14.795 12.0504 15 11.2929 15 10.4779C15 9.66285 14.795 8.90535 14.385 8.20535C13.985 7.52535 13.445 6.99035 12.765 6.60035C12.065 6.19035 11.31 5.98535 10.5 5.98535H5.115Z" fill="currentColor" className="text-brand dark:text-brand-light" />
          </svg>
        </div>

        <h2 id="restore-title" className="text-center text-xl font-semibold text-ink-900">
          Restore Item
        </h2>
        <p className="mt-2 text-center text-body-sm text-ink-500">
          Are you sure you want to restore this item? It will be moved back to the active workspace.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl bg-surface-100 dark:bg-surface-200 text-body-sm font-semibold text-ink-500 dark:text-ink-300 hover:bg-surface-150 dark:hover:bg-surface-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-xl text-body-sm font-semibold text-white bg-gradient-indigo shadow-glow-indigo-pill-lg hover:opacity-90"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}