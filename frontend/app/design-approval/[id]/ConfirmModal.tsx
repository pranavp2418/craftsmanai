'use client';
import { useRef } from 'react';
import { useFocusTrap } from '@/lib/useFocusTrap';

export default function ConfirmModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, open);

  if (!open) return null;

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel}></div>
      <div className="relative w-full sm:max-w-[380px] bg-white rounded-t-[28px] sm:rounded-container p-7 sm:mb-0 shadow-2xl border border-warm-200">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-success-lighter flex items-center justify-center mb-5 shadow-sm">
          <span className="w-6 h-6 flex items-center justify-center ri-check-line text-success-medium text-heading-md"></span>
        </div>
        <h3 className="text-center text-heading-xs font-semibold text-stone-900 mb-2 tracking-tight">
          Approve this design?
        </h3>
        <p className="text-center text-body-md text-stone-400 mb-8 leading-relaxed px-2">
          Once approved, your designer will begin crafting your piece.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-4 rounded-2xl bg-success-medium text-white text-ui font-semibold hover:bg-success-deep active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-glow-emerald-soft"
          >
            Yes, Approve Design
          </button>
          <button
            onClick={onCancel}
            className="w-full py-4 rounded-2xl border border-stone-100 text-stone-700 text-ui font-medium hover:bg-stone-50 hover:border-stone-200 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap bg-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
