'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpDown, Info } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';

interface ReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ReorderModal({
  isOpen,
  onClose,
  onConfirm,
}: ReorderModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, onClose);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-9999 transition-opacity" />

      {/* Modal */}
      <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
        <div
          ref={modalRef}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Body */}
          <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
            {/* Icon circle */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: '#FFECD1' }}
            >
              <ArrowUpDown className="w-8 h-8" style={{ color: '#F89402' }} />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Reorder Quiz Question?
            </h2>

            {/* Subtitle */}
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Changing the question order may affect the quiz experience for retailers.
            </p>

            {/* Info box */}
            <div
              className="w-full rounded-xl border p-4 text-left"
              style={{ backgroundColor: '#FFECD1', borderColor: '#F89402' }}
            >
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#F89402' }} />
                <div>
                  <p className="text-sm font-medium mb-1.5" style={{ color: '#F89402' }}>
                    Important:
                  </p>
                  <ul className="space-y-1 list-disc list-inside">
                    {[
                      'Question order affects the quiz flow logic',
                      'Changes apply to new requests immediately',
                      'Existing requests remain unchanged',
                    ].map((bullet) => (
                      <li key={bullet} className="text-sm" style={{ color: '#F89402' }}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 mx-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-full text-sm font-medium tracking-wider text-gray-700 hover:bg-blue-100 transition-colors cursor-pointer"
              style={{ backgroundColor: '#EBF3FE' }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 px-4 py-3 rounded-full text-sm font-medium tracking-wider text-white transition-colors cursor-pointer hover:opacity-85"
              style={{ backgroundColor: '#F89402' }}
            >
              Confirm Reorder
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
