'use client';

import { placeholderImage } from '@/lib/placeholders';

import { useState } from 'react';
import ConfirmModal from './ConfirmModal';
import FeedbackModal from './FeedbackModal';
import Image from 'next/image';

const views = [
  {
    label: 'Front View',
    src: placeholderImage({ query: 'jewelry ring', width: 200, height: 200, seq: 'ring-front', orientation: 'squarish' }),
  },
  {
    label: 'Side View',
    src: placeholderImage({ query: 'jewelry ring', width: 200, height: 200, seq: 'ring-side', orientation: 'squarish' }),
  },
  {
    label: 'Worn View',
    src: placeholderImage({ query: 'jewelry ring', width: 200, height: 200, seq: 'ring-worn', orientation: 'squarish' }),
  },
];

export default function ApprovalPage({ designId }: { designId: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<'none' | 'approved' | 'changes'>('none');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [zoomed, setZoomed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState<boolean[]>([false, false, false]);

  const handleApprove = () => setConfirmOpen(true);

  const confirmApprove = () => {
    setConfirmOpen(false);
    setStatus('approved');
    setSuccessMsg('Design approved successfully');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 4000);
  };

  const handleRequestChanges = () => setFeedbackOpen(true);

  const submitFeedback = (msg: string) => {
    setFeedbackOpen(false);
    setStatus('changes');
    setSuccessMsg('Your feedback has been sent');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 4000);
  };

  return (
    <div className="min-h-screen bg-surface-warm-faint relative">
      {/* Status Banner */}
      {status !== 'none' && (
        <div
          className={`sticky top-0 z-40 px-4 py-3.5 text-center text-body-sm font-medium backdrop-blur-md ${status === 'approved'
            ? 'bg-success-medium/10 text-success-darkest border-b border-success-medium/20'
            : 'bg-warning/10 text-warning-dark border-b border-warning/20'
            }`}
        >
          <span className="w-4 h-4 inline-flex items-center justify-center mr-1.5 ri-check-line text-body-md"></span>
          {status === 'approved' ? 'This design has been approved' : 'Changes requested'}
        </div>
      )}

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-dark-bg-800 text-white text-body-sm font-medium px-6 py-3 rounded-full shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-success-medium ri-check-line text-white text-label"></span>
          {successMsg}
        </div>
      )}

      <div className="max-w-[520px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-36">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-subtle-2xs border border-warm-200 mb-5">
            <img src="/Render_image_1.jpg" alt="Craftsman AI" className="w-8 h-8 object-contain" />
          </div>
          <span className="inline-block px-4 py-1.5 rounded-full bg-surface-warm-tint text-gold text-label-xs font-semibold tracking-widest uppercase mb-3 border border-warm-edge">
            Custom Jewelery Design Preview
          </span>
          <h1 className="text-display-sm font-semibold text-stone-900 leading-tight mb-2 tracking-tight font-satoshi">
            Review Your Design
          </h1>
          <p className="text-body-md text-stone-400">
            Please review your design and share your feedback
          </p>
        </div>

        {/* Hero Image */}
        <div className="mb-8">
          <div
            className="relative w-full aspect-square rounded-container overflow-hidden bg-surface-150 cursor-pointer shadow-subtle-lg border border-warm-200 transition-transform duration-300 active:scale-[0.98]"
            onClick={() => setZoomed(true)}
          >
            {!imgLoaded[activeIndex] && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-stone-100 border-t-gold rounded-full animate-spin" />
              </div>
            )}
            <img
              src={views[activeIndex].src}
              alt={views[activeIndex].label}
              className={`w-full h-full object-cover object-top transition-opacity duration-500 ${imgLoaded[activeIndex] ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(prev => {
                const next = [...prev];
                next[activeIndex] = true;
                return next;
              })}
            />
            <div className="absolute bottom-4 left-4 px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-label font-medium text-stone-700 shadow-lg border border-white/50">
              {views[activeIndex].label}
            </div>
            <div className="absolute top-4 right-4 touch-target rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-white/50 transition-transform hover:scale-110">
              <span className="w-5 h-5 flex items-center justify-center ri-zoom-in-line text-stone-600 text-heading-xs" />
            </div>
          </div>

          {/* Thumbnails */}
          <div className="flex gap-3 mt-5 overflow-x-auto pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6 scrollbar-hide">
            {views.map((v, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setActiveIndex(i)}
                aria-label={`View ${v.label}`}
                aria-pressed={i === activeIndex}
                className={`relative shrink-0 w-[76px] h-[76px] rounded-panel overflow-hidden transition-all duration-200 ${i === activeIndex
                  ? 'ring-2.5 ring-gold ring-offset-[3px] shadow-md scale-105'
                  : 'ring-1 ring-stone-100 opacity-60 hover:opacity-100 hover:shadow-sm'
                  }`}
              >
                <Image src={v.src} alt={v.label} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover object-top" />
              </button>
            ))}
          </div>
        </div>

        {/* Design Details */}
        <div className="bg-white rounded-sheet-lg border border-warm-200 p-5 sm:p-6 mb-5 shadow-subtle-soft">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-surface-warm-tint flex items-center justify-center">
              <span className="w-4 h-4 flex items-center justify-center ri-vip-diamond-line text-gold text-body-md"></span>
            </div>
            <h2 className="text-ui font-semibold text-stone-900 font-satoshi">
              Design Details
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-body-sm text-stone-400">Jewelery Type</span>
              <span className="text-body-sm font-semibold text-stone-900">Solitaire Ring</span>
            </div>
            <div className="w-full h-px bg-surface-150"></div>
            <div className="flex items-center justify-between py-2">
              <span className="text-body-sm text-stone-400">Metal</span>
              <span className="text-body-sm font-semibold text-stone-900">18K Yellow Gold</span>
            </div>
          </div>
        </div>

        {/* Message from Designer */}
        <div className="bg-white rounded-sheet-lg border border-warm-200 p-5 sm:p-6 mb-5 shadow-subtle-soft">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-brand-tint flex items-center justify-center">
              <span className="w-4 h-4 flex items-center justify-center ri-message-3-line text-brand text-body-md"></span>
            </div>
            <h2 className="text-ui font-semibold text-stone-900 font-satoshi">
              Message from Designer
            </h2>
          </div>
          <p className="text-body-md text-stone-600 leading-[1.7] italic border-l-2 border-warm-edge pl-4">
            Hi Sarah, here is the custom solitaire design we discussed. The band features a subtle taper to draw the eye toward the centre stone. Let me know if you would like any adjustments to the stone size or band width.
          </p>
        </div>
      </div>

      {/* Zoom Modal */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-dark-bg-900/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-w-lg w-full">
            <img
              src={views[activeIndex].src}
              alt={views[activeIndex].label}
              className="w-full rounded-sheet-lg object-contain shadow-2xl"
            />
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-label font-medium border border-white/20">
              {views[activeIndex].label}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Close zoom"
            className="absolute top-6 right-6 touch-target rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
          >
            <span className="w-6 h-6 flex items-center justify-center ri-close-line text-white text-heading-md" />
          </button>
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      {status === 'none' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-warm-200 px-4 sm:px-6 py-4 sm:py-5 sm:max-w-[520px] sm:mx-auto sm:rounded-t-[28px] sm:border-x sm:shadow-modal-up">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleApprove}
              className="flex-1 min-h-touch py-3 sm:py-4 rounded-2xl bg-success-medium text-white text-body-md sm:text-ui font-semibold hover:bg-success-deep active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-glow-emerald"
            >
              <span className="w-5 h-5 flex items-center justify-center ri-check-line text-heading-xs" />
              Approve Design
            </button>
            <button
              type="button"
              onClick={handleRequestChanges}
              className="flex-1 min-h-touch py-3 sm:py-4 rounded-2xl border border-stone-100 text-stone-700 text-body-md sm:text-ui font-semibold hover:bg-stone-50 hover:border-stone-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap bg-white"
            >
              <span className="w-5 h-5 flex items-center justify-center ri-edit-line text-heading-xs" />
              Request Changes
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center pb-10 px-6">
        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-warm-200 shadow-lift-xs">
          <span className="w-3.5 h-3.5 flex items-center justify-center ri-sparkling-line text-gold text-label"></span>
          <p className="text-label-xs text-stone-400 font-medium">Powered by Craftsman AI</p>
        </div>
        <p className="text-label-xs text-stone-200 mt-3">
          Questions? Contact your designer
        </p>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onConfirm={confirmApprove}
        onCancel={() => setConfirmOpen(false)}
      />

      <FeedbackModal
        open={feedbackOpen}
        onSubmit={submitFeedback}
        onCancel={() => setFeedbackOpen(false)}
      />
    </div>
  );
}
