import React, { useEffect } from 'react';
import { X, FileText, Info, Plus, RefreshCw } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchPaymentDetails, clearDetails } from '@/redux/slices/admin/subscriptions/adminPaymentDetailsSlice';
import { downloadPaymentRecordCSV } from '@/redux/slices/admin/subscriptions/adminDownloadPaymentRecordCSVSlice';

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    id: string; // This is the Invoice ID (e.g. INV-...)
    payment_id: string; // This is the UUID
    retailer: string;
    initial: string;
    color: string;
    plan: string;
    amount: string;
    status: string;
    date: string;
  } | null;
}

const statusStyles: Record<string, string> = {
  Paid: 'bg-[#ECFDF5] text-[#10B981]',
  Failed: 'bg-[#FEF2F2] text-[#EF4444]',
  Refunded: 'bg-[#F3F4F6] text-[#6B7280]',
  Pending: 'bg-[#FFFBEB] text-[#F59E0B]',
};

const formatDateTimeCT = (isoString: string): string => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
};

const ShimmerLoader = () => (
  <div className="space-y-4 animate-pulse">
    <div className="bg-gray-50 h-20 rounded-[20px]" />
    <div className="grid grid-cols-2 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="h-16 bg-gray-50 rounded-[12px]" />
      ))}
    </div>
    <div className="bg-blue-50 h-16 rounded-[16px]" />
  </div>
);

export default function InvoiceDetailsModal({ isOpen, onClose, data }: InvoiceDetailsModalProps) {
  const dispatch = useAppDispatch();
  const { data: details, loading, error } = useAppSelector((state) => state.adminPaymentDetails);
  const { exportingId: downloadingId } = useAppSelector((state) => state.adminDownloadPaymentRecordCSV);

  useEffect(() => {
    if (isOpen && data?.payment_id) {
      dispatch(fetchPaymentDetails(data.payment_id));
    }
    return () => {
      if (isOpen) dispatch(clearDetails());
    };
  }, [isOpen, data?.payment_id, dispatch]);

  const handleDownload = () => {
    if (data?.payment_id) {
      dispatch(downloadPaymentRecordCSV({ paymentId: data.payment_id, invoiceId: details?.invoice_id || data.id }));
    }
  };

  if (!isOpen || !data) return null;

  const displayStatus = details?.status || data.status;
  const statusKey = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1).toLowerCase();

  const isDownloading = downloadingId === data.payment_id;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-xl rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 flex items-center justify-between border-b border-gray-50 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-[12px] bg-[#EFF6FF] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-[#2F68C5]" />
            </div>
            <div>
              <h2 className="text-[15px] sm:text-lg font-bold text-[#111827] leading-tight">Invoice Details</h2>
              <p className="text-[11px] sm:text-[12px] text-[#9CA3AF] font-medium">{details?.invoice_id || data.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 no-scrollbar">
          {loading ? (
            <ShimmerLoader />
          ) : error ? (
            <div className="p-12 text-center rounded-[24px] border border-red-50 bg-red-50/30">
              <p className="text-red-500 font-medium mb-4">{error}</p>
              <button
                onClick={() => data?.payment_id && dispatch(fetchPaymentDetails(data.payment_id))}
                className="flex items-center gap-2 mx-auto text-xs font-bold text-[#2C62B9] underline uppercase tracking-widest"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          ) : (
            <>
              {/* Retailer Card */}
              <div className="bg-[#F9FAFB] rounded-[16px] sm:rounded-[20px] p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 border border-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ${data.color} shrink-0`}>
                    {data.initial}
                  </div>
                  <div className="text-left">
                    <h3 className="text-[13px] sm:text-[14px] font-bold text-[#111827]">{details?.retailer_name || data.retailer}</h3>
                    <p className="text-[12px] sm:text-[13px] text-[#6B7280] font-normal lowercase truncate max-w-[140px] sm:max-w-none">
                      ID: {details?.user_id || '-'}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 ${statusStyles[statusKey] || 'bg-gray-100 text-gray-500'}`}>
                  {displayStatus}
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white border border-[#F3F4F6] rounded-[10px] sm:rounded-[12px] p-3 sm:p-4 transition-all">
                  <label className="block text-[10px] sm:text-[11px] font-normal text-[#6B7280] mb-1 uppercase tracking-wide">Transaction ID</label>
                  <div className="text-[11px] sm:text-[12px] font-bold text-[#111827] break-all">{details?.id || data.payment_id}</div>
                </div>
                <div className="bg-white border border-[#F3F4F6] rounded-[10px] sm:rounded-[12px] p-3 sm:p-4 transition-all">
                  <label className="block text-[10px] sm:text-[11px] font-normal text-[#6B7280] mb-1 uppercase tracking-wide">Issue Date</label>
                  <div className="text-[13px] sm:text-[14px] font-bold text-[#111827]">
                    {details?.created_at ? formatDateTimeCT(details.created_at) : data.date}
                  </div>
                </div>
                <div className="bg-white border border-[#F3F4F6] rounded-[10px] sm:rounded-[12px] p-3 sm:p-4 transition-all">
                  <label className="block text-[10px] sm:text-[11px] font-normal text-[#6B7280] mb-1 uppercase tracking-wide">Subscription Plan</label>
                  <div className="text-[13px] sm:text-[14px] font-bold text-[#111827]">{details?.plan_name || data.plan}</div>
                </div>
                <div className="bg-white border border-[#F3F4F6] rounded-[10px] sm:rounded-[12px] p-3 sm:p-4 transition-all">
                  <label className="block text-[10px] sm:text-[11px] font-normal text-[#6B7280] mb-1 uppercase tracking-wide">Payment Method</label>
                  <div className="text-[13px] sm:text-[14px] font-bold text-[#111827] uppercase">{details?.payment_method || 'N/A'}</div>
                </div>
                <div className="bg-white border border-[#F3F4F6] rounded-[10px] sm:rounded-[12px] p-3 sm:p-4 transition-all overflow-hidden">
                  <label className="block text-[10px] sm:text-11px] font-normal text-[#6B7280] mb-1 uppercase tracking-wide">Stripe Session ID</label>
                  <div className="text-[10px] sm:text-[11px] font-bold text-[#111827] break-all">{details?.stripe_session_id || 'N/A'}</div>
                </div>
                <div className="bg-white border border-[#F3F4F6] rounded-[10px] sm:rounded-[12px] p-3 sm:p-4 transition-all">
                  <label className="block text-[10px] sm:text-[11px] font-normal text-[#6B7280] mb-1 uppercase tracking-wide">Total Amount</label>
                  <div className="text-[15px] sm:text-[16px] font-extrabold text-[#111827]">
                    {details ? `${details.currency === 'USD' ? '$' : details.currency} ${details.amount}` : data.amount}
                  </div>
                </div>
              </div>

              {/* Automatic Note */}
              <div className="bg-[#EFF6FF] rounded-[12px] sm:rounded-[16px] p-3 sm:p-4 flex items-start gap-3 sm:gap-4 border border-[#DBEAFE]">
                <Info className="w-4 h-4 sm:w-5 sm:h-5 text-[#2F68C5] shrink-0 mt-0.5" />
                <p className="text-[12px] sm:text-[13px] text-[#2F68C5] font-medium leading-relaxed">
                  Last updated on {details?.updated_at ? formatDateTimeCT(details.updated_at) : 'N/A'}.
                  For disputes or ref-id queries, contact support.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 pt-2 flex flex-col sm:flex-row items-center gap-3 border-t border-gray-50 shrink-0 mt-auto">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full sm:flex-1 py-2.5 sm:py-3 px-6 bg-[#2F68C5] text-white text-[13px] sm:text-sm font-bold rounded-full transition-all hover:bg-blue-700 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
          >
            {isDownloading && <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />}
            {isDownloading ? 'Downloading...' : 'Download Invoice'}
          </button>
          <button
            onClick={onClose}
            className="w-full sm:flex-1 py-2.5 sm:py-3 px-6 border border-[#2F68C5] text-[#2F68C5] text-[13px] sm:text-sm font-bold rounded-full transition-all hover:bg-blue-50 active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
