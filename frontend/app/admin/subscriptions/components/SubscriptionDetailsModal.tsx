import React, { useState, useEffect } from 'react';
import { X, CreditCard } from 'lucide-react';
import axiosInstance from '@/src/utils/axios';

type Status = 'Active' | 'Trial' | 'Past Due' | 'Paused' | 'Cancelled';

interface RetailerData {
  id: string;
  user_id: string;
  name: string;
  initials: string;
  business: string;
  plan: string;
  cycle: string;
  status: Status;
  usage: number;
  nextBilling: string;
  avatarColor: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onChangePlan: (data: RetailerData) => void;
  data: RetailerData | null;
}

const statusStyles: Record<Status, string> = {
  Active: 'bg-[#ECFDF5] text-[#10B981]',
  Trial: 'bg-[#EEF2FF] text-[#6366F1]',
  'Past Due': 'bg-[#FEF2F2] text-[#EF4444]',
  Paused: 'bg-[#FFFBEB] text-[#F59E0B]',
  Cancelled: 'bg-[#F3F4F6] text-[#6B7280]',
};

export default function SubscriptionDetailsModal({ isOpen, onClose, onChangePlan, data }: Props) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && data?.user_id) {
      setLoading(true);
      setError(null);
      axiosInstance
        .get('/api/v2/admin/subscription-plans/get-user-detail', {
          params: { user_id: data.user_id },
        })
        .then((response) => {
          setDetails(response.data);
        })
        .catch((err) => {
          console.error('Failed to fetch user subscription details:', err);
          setError('Failed to load subscription details.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setDetails(null);
      setError(null);
    }
  }, [isOpen, data?.user_id]);

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-[500px] rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 flex items-center justify-between border-b border-gray-50 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-[#111827]">Subscription Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-200">

          {/* Main Profile Card */}
          <div className="bg-[#F9FAFB] rounded-[12px] sm:rounded-[20px] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-gray-50">
            <div className="flex items-center gap-3 self-start sm:self-center">
              <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-base ${data.avatarColor} shrink-0 shadow-sm`}>
                {data.initials}
              </div>
              <div className="text-left">
                <h3 className="text-[13px] sm:text-sm font-semibold text-[#111827]">{data.name}</h3>
                <p className="text-[13px] sm:text-sm text-[#6B7280] font-normal leading-tight">{data.business}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 self-start sm:self-center ${statusStyles[data.status] || 'bg-gray-100 text-gray-500'}`}>
              {data.status}
            </span>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-medium text-center">
              {error}
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white border border-[#F3F4F6] rounded-[8px] p-3 sm:p-[12px]">
              <label className="block text-[11px] sm:text-xs font-normal text-[#6B7280] mb-1">Current Plan</label>
              {loading ? (
                <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
              ) : (
                <div className="text-[13px] sm:text-sm font-medium text-[#111827]">
                  {details?.plan_name || data.plan}
                </div>
              )}
            </div>
            <div className="bg-white border border-[#F3F4F6] rounded-[8px] p-3 sm:p-[12px]">
              <label className="block text-[11px] sm:text-xs font-normal text-[#6B7280] mb-1">Billing Cycle</label>
              {loading ? (
                <div className="h-5 w-20 bg-gray-100 rounded animate-pulse" />
              ) : (
                <div className="text-[13px] sm:text-sm font-medium text-[#111827]">
                  {details?.billing_cycle || data.cycle}
                </div>
              )}
            </div>
            <div className="bg-white border border-[#F3F4F6] rounded-[8px] p-3 sm:p-[12px]">
              <label className="block text-[11px] sm:text-xs font-normal text-[#6B7280] mb-1">Next Billing</label>
              {loading ? (
                <div className="h-5 w-28 bg-gray-100 rounded animate-pulse" />
              ) : (
                <div className="text-[13px] sm:text-sm font-medium text-[#111827]">
                  {(() => {
                    const dateVal = details?.next_billing || data.nextBilling;
                    if (!dateVal) return '-';
                    const date = new Date(dateVal);
                    if (isNaN(date.getTime())) return '-';
                    const formatted = date.toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: "America/Chicago",
                    });
                    return `${formatted}`;
                  })()}
                </div>
              )}
            </div>
            <div className="bg-white border border-[#F3F4F6] rounded-[8px] p-3 sm:p-[12px]">
              <label className="block text-[11px] sm:text-xs font-normal text-[#6B7280] mb-1">Renders Used</label>
              {loading ? (
                <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <div className="text-[13px] sm:text-sm font-medium text-[#111827]">
                  {details?.render_used !== undefined ? `${details.render_used}` : `${data.usage} this month`}
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Section */}
          <div className="bg-white border border-[#F3F4F6] rounded-[12px] p-4">
            <label className="block text-[11px] sm:text-xs font-normal text-[#6B7280] mb-3">Payment Method</label>
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-7 bg-gray-100 rounded animate-pulse shrink-0" />
                <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-7 sm:w-11 sm:h-8 bg-[#2F68C5] rounded-md flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="text-[13px] sm:text-sm font-medium text-[#111827]">
                  {details?.payment_method?.brand ? (
                    <span className="capitalize">
                      {details.payment_method.brand} ending in {details.payment_method.last4}
                      {details.payment_method.exp_month && details.payment_method.exp_year && (
                        <span className="text-gray-400 font-normal text-xs ml-1">
                          ({details.payment_method.exp_month}/{details.payment_method.exp_year})
                        </span>
                      )}
                    </span>
                  ) : (
                    'No saved card details'
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 border-t border-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 sm:py-3 px-6 border border-[#2F68C5] text-[#2F68C5] text-[13px] sm:text-sm font-bold rounded-full transition-all hover:bg-blue-50 order-2 sm:order-1"
          >
            Close
          </button>
          {/* <button
            onClick={() => data && onChangePlan(data)}
            className="flex-1 py-2.5 sm:py-3 px-6 bg-[#2F68C5] text-white text-[13px] sm:text-sm font-bold rounded-full transition-all hover:bg-blue-700 shadow-md shadow-blue-200 order-1 sm:order-2"
          >
            Change Plan
          </button> */}
        </div>
      </div>
    </div>
  );
}
