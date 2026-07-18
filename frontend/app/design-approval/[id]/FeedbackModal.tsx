'use client';

import {useState, useRef} from 'react';
import { useFocusTrap } from '@/lib/useFocusTrap';

export default function FeedbackModal({
  open,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  onSubmit: (message: string) => void;
  onCancel: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, open);

  const [message, setMessage] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSubmit(message.trim());
    setMessage('');
  };

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel}></div>
      <div className="relative w-full sm:max-w-[420px] bg-white rounded-t-[28px] sm:rounded-container p-7 sm:mb-0 shadow-2xl border border-warm-200">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-warning-soft flex items-center justify-center mb-5 shadow-sm">
          <span className="w-6 h-6 flex items-center justify-center ri-edit-line text-warning text-heading-md"></span>
        </div>
        <h3 className="text-center text-heading-xs font-semibold text-stone-900 mb-1 tracking-tight">
          Request Changes
        </h3>
        <p className="text-center text-body-md text-stone-400 mb-6">
          Tell us what you would like different
        </p>
        <textarea
          value={message}
          onChange={(e) => {
            if (e.target.value.length <= 500) setMessage(e.target.value);
          }}
          placeholder="e.g. Make the centre stone larger, change to a round shape..."
          className="w-full h-[140px] p-4 rounded-2xl border border-stone-100 bg-stone-50 text-body-md text-stone-900 placeholder:text-stone-200 resize-none focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold mb-6 transition-all"
        />
        <div className="flex flex-col gap-3">
          <button
            onClick={handleSubmit}
            disabled={!message.trim()}
            className="w-full py-4 rounded-2xl bg-stone-900 text-white text-ui font-semibold hover:bg-dark-bg-600 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shadow-glow-stone"
          >
            Send Feedback
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
