import React from 'react';
import { X, RefreshCcw } from 'lucide-react';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: {
    id: string;
    retailer: string;
    amount: string;
  } | null;
}

export default function RefundModal({ isOpen, onClose, invoiceData }: RefundModalProps) {
  if (!isOpen || !invoiceData) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0F172ACC]/40 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-[0px_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-300">
        <div className="sm:p-8 p-4 flex flex-col items-center">
          {/* Header Icon */}
          <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 24C0 10.7452 10.7452 0 24 0C37.2548 0 48 10.7452 48 24C48 37.2548 37.2548 48 24 48C10.7452 48 0 37.2548 0 24Z" fill="#FEF2F2" />
                <path d="M18.9442 17.5507C19.9789 16.6618 21.1522 16.084 22.4642 15.8173C23.7442 15.5618 25.0135 15.6229 26.2722 16.0007C27.5629 16.4007 28.6935 17.1007 29.6642 18.1007C30.4215 18.9007 31.0029 19.8229 31.4082 20.8673C31.8029 21.8673 32.0002 22.9118 32.0002 24.0007C32.0002 25.0895 31.8029 26.134 31.4082 27.134C31.0029 28.1784 30.4189 29.0979 29.6562 29.8923C28.8935 30.6868 28.0109 31.2951 27.0082 31.7173C26.0482 32.1284 25.0455 32.334 24.0002 32.334C22.9549 32.334 21.9522 32.1284 20.9922 31.7173C19.9895 31.2951 19.1042 30.6895 18.3362 29.9007C17.3442 28.8562 16.6615 27.634 16.2882 26.234C15.9255 24.8784 15.8989 23.5118 16.2082 22.134L16.2562 21.884L17.8082 22.3007C17.5202 23.434 17.5202 24.5618 17.8082 25.684C18.0962 26.8507 18.6509 27.8618 19.4722 28.7173C20.2935 29.5729 21.2642 30.1507 22.3842 30.4507C23.4615 30.7395 24.5389 30.7395 25.6162 30.4507C26.7362 30.1507 27.7069 29.5729 28.5282 28.7173C29.3495 27.8618 29.9042 26.8507 30.1922 25.684C30.4695 24.5618 30.4695 23.4395 30.1922 22.3173C29.9042 21.1507 29.3495 20.1395 28.5282 19.284C27.7922 18.5173 26.9282 17.9729 25.9362 17.6507C24.9762 17.3284 23.9949 17.2507 22.9922 17.4173C21.9895 17.584 21.0775 17.9784 20.2562 18.6007L20.0802 18.734L20.8962 19.584L17.2162 20.4673L18.0642 16.634L18.9442 17.5507ZM24.8002 19.0007V20.6673H26.8002V22.334H22.4002C22.2935 22.334 22.2002 22.3757 22.1202 22.459C22.0402 22.5423 22.0002 22.6368 22.0002 22.7423C22.0002 22.8479 22.0322 22.9395 22.0962 23.0173C22.1602 23.0951 22.2402 23.1451 22.3362 23.1673H22.4002H25.6002C25.9629 23.1673 26.2962 23.2618 26.6002 23.4507C26.9042 23.6395 27.1469 23.8923 27.3282 24.209C27.5095 24.5257 27.6002 24.8729 27.6002 25.2507C27.6002 25.6284 27.5095 25.9757 27.3282 26.2923C27.1469 26.609 26.9042 26.8618 26.6002 27.0507C26.2962 27.2395 25.9629 27.334 25.6002 27.334H24.8002V29.0007H23.2002V27.334H21.2002V25.6673H25.6002C25.7069 25.6673 25.8002 25.6257 25.8802 25.5423C25.9602 25.459 26.0002 25.3645 26.0002 25.259C26.0002 25.1534 25.9682 25.0618 25.9042 24.984C25.8402 24.9062 25.7602 24.8562 25.6642 24.834H25.6002H22.4002C22.0375 24.834 21.7042 24.7395 21.4002 24.5507C21.0962 24.3618 20.8535 24.109 20.6722 23.7923C20.4909 23.4757 20.4002 23.1284 20.4002 22.7507C20.4002 22.3729 20.4909 22.0257 20.6722 21.709C20.8535 21.3923 21.0962 21.1395 21.4002 20.9507C21.7042 20.7618 22.0375 20.6673 22.4002 20.6673H23.2002V19.0007H24.8002Z" fill="#EF4444" />
              </svg>

            </div>
          </div>

          <h2 className="text-lg font-bold text-[#111827] mb-3">Issue Refund?</h2>

          <p className="text-sm text-[#6B7280] text-center leading-relaxed mb-6">
            You are about to issue a refund for invoice <span className="font-bold text-[#6B7280]">{invoiceData.id}</span> — <span className="font-bold text-[#6B7280]">{invoiceData.amount}</span> to <span className="font-bold text-[#6B7280]">{invoiceData.retailer}</span>
          </p>

          {/* Warning Box */}
          <div className="w-full bg-[#FFFBEB] rounded-[16px] p-3 border border-[#FEF3C7] mb-8">
            <p className="text-xs text-[#B45309] font-normal leading-relaxed">
              This action cannot be undone. The refund will be processed within 5–10 business days.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 w-full px-6 py-4 border border-[#E5E7EB] rounded-full text-[15px] font-medium text-[#374151]  order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              className="flex-1 w-full px-6 py-4 bg-[#EF4444] text-white rounded-full text-sm font-medium shadow-lg shadow-red-100 order-1 sm:order-2"
            >
              Confirm Refund
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
