'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CircleCheck, CircleAlert, Info } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';

interface ToggleQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'enable' | 'disable';
  questionText: string;
  onConfirm: () => void;
}

export default function ToggleQuestionModal({
  isOpen,
  onClose,
  mode,
  questionText,
  onConfirm,
}: ToggleQuestionModalProps) {
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

  const isEnable = mode === 'enable';

  const config = isEnable
    ? {
        iconBg: '#DCFCE7',
        iconColor: '#1D8C1D',
        title: 'Enable Quiz Question?',
        infoBg: '#DCFCE7',
        infoBorder: '#1D8C1D',
        infoColor: '#1D8C1D',
        infoTitle: 'This action will:',
        bullets: [
          'Add this question back to the retailer quiz flow',
          'Include this question in all new design requests',
          'Take effect immediately for new requests',
        ],
        confirmLabel: 'Enable Question',
        confirmBg: '#22A121',
        confirmHover: '#1a8a19',
      }
    : {
        iconBg: '#FFEBEB',
        iconColor: '#D8201D',
        title: 'Disable Quiz Question?',
        infoBg: '#FFEBEB',
        infoBorder: '#F29E9C',
        infoColor: '#D8201D',
        infoTitle: 'This action will:',
        bullets: [
          'Remove this question from the retailer quiz flow',
          'Skip this question in all new design requests',
          'Not affect existing requests or historical data',
        ],
        confirmLabel: 'Disable Question',
        confirmBg: '#D8201D',
        confirmHover: '#b81b18',
      };

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
              style={{ backgroundColor: config.iconBg }}
            >
              {isEnable ? (
                <CircleCheck className="w-8 h-8" style={{ color: config.iconColor }} />
              ) : (
                <CircleAlert className="w-8 h-8" style={{ color: config.iconColor }} />
              )}
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 mb-3">{config.title}</h2>

            {/* Question preview */}
            <p className="text-sm text-gray-500 mb-6">
              &ldquo;{questionText}&rdquo;
            </p>

            {/* Info box */}
            <div
              className="w-full rounded-xl border p-4 text-left"
              style={{
                backgroundColor: config.infoBg,
                borderColor: config.infoBorder,
              }}
            >
              <div className="flex items-start gap-2">
                <Info
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: config.infoColor }}
                />
                <div>
                  <p
                    className="text-sm font-medium mb-1.5"
                    style={{ color: config.infoColor }}
                  >
                    {config.infoTitle}
                  </p>
                  <ul className="space-y-1 list-disc list-inside">
                    {config.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="text-sm"
                        style={{ color: config.infoColor }}
                      >
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
              className="flex-1 px-4 py-3 rounded-full text-sm font-medium text-gray-700 hover:opacity-80 hover:bg-blue-100 transition-colors cursor-pointer"
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
              className="flex-1 px-4 py-3 rounded-full text-sm font-medium text-white transition-colors cursor-pointer"
              style={{ backgroundColor: config.confirmBg }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  config.confirmHover)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  config.confirmBg)
              }
            >
              {config.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
