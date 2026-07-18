'use client';

import { useState, useEffect, useMemo } from 'react';
import { RequestData } from '@/lib/requestsData';
import ShareCustomerModal from './ShareCustomerModal';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchDesignShares, resetSharesState } from '@/redux/slices/retailer/designVariantSharesSlice';
import { approveDesign } from '@/redux/slices/retailer/designVariantApproveSlice';
import { rejectDesign } from '@/redux/slices/retailer/designVariantRejectSlice';
import { shareVariant } from '@/redux/slices/retailer/designVariantShareSlice';
import { toast } from 'react-toastify';

interface SharedDesign {
  customerName: string;
  email: string;
  dateShared: string;
  status: string;
  note?: string;
  token?: string;
}

interface CustomerApprovalPanelProps {
  request: RequestData;
  variantId?: string | number | null;
  onGoToDesign: () => void;
  onStatusChange?: () => void;
  onGenerateDetailSheet?: () => void;
  activeMetal?: string;
}

export default function CustomerApprovalPanel({ request, variantId, onGoToDesign, onStatusChange, onGenerateDetailSheet, activeMetal }: CustomerApprovalPanelProps) {
  const dispatch = useAppDispatch();
  const { shares, loading, error } = useAppSelector((state) => state.retailerDesignVariantShares);
  const { loading: approveLoading } = useAppSelector((state) => state.retailerDesignVariantApprove);
  const { loading: rejectLoading } = useAppSelector((state) => state.retailerDesignVariantReject);
  const { variantsLoading } = useAppSelector((state) => state.retailerDesignVariant);

  const [sending, setSending] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [simulatedStatus, setSimulatedStatus] = useState<'Approved' | 'Rejected' | null>(null);
  const [resendDate, setResendDate] = useState<string | null>(null);
  const [activeFetchId, setActiveFetchId] = useState<string | number | null>(null);

  const handleUpdateDesign = () => {
    onGoToDesign();
  };

  // Fetch dynamic design shares when variantId changes
  useEffect(() => {
    if (variantId) {
      setActiveFetchId(variantId);
      const promise = dispatch(fetchDesignShares({ variantId }));
      return () => {
        promise.abort();
      };
    } else {
      setActiveFetchId(null);
      dispatch(resetSharesState());
    }
  }, [dispatch, variantId]);

  // Reset simulator override when variantId changes
  useEffect(() => {
    setSimulatedStatus(null);
    setResendDate(null);
  }, [variantId]);

  // Handle status change or new share creation and trigger refresh
  const handleStatusChange = () => {
    if (variantId) {
      dispatch(fetchDesignShares({ variantId }));
    }
    onStatusChange?.();
  };

  const handleResend = async () => {
    if (!variantId) {
      toast.error('No variant ID available to resend.');
      return;
    }
    setSending(true);
    try {
      await dispatch(shareVariant({ variantId })).unwrap();
      toast.success('Design resent to customer successfully!');
      dispatch(fetchDesignShares({ variantId }));
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err || 'Failed to resend design.');
    } finally {
      setSending(false);
    }
  };

  const handleApprove = async () => {
    if (shared?.token) {
      try {
        await dispatch(approveDesign({ token: shared.token })).unwrap();
        toast.success('Design approved successfully!');
        if (variantId) {
          dispatch(fetchDesignShares({ variantId }));
        }
        onStatusChange?.();
      } catch (err: any) {
        toast.error(err || 'Failed to approve design.');
      }
    } else {
      // Mock simulation fallback if token is not available
      setSimulatedStatus('Approved');
      toast.success('Design approved (Simulation Mode)!');
      onStatusChange?.();
    }
  };

  const handleReject = async () => {
    if (shared?.token) {
      try {
        await dispatch(rejectDesign({ token: shared.token })).unwrap();
        toast.success('Design rejected successfully!');
        if (variantId) {
          dispatch(fetchDesignShares({ variantId }));
        }
        onStatusChange?.();
      } catch (err: any) {
        toast.error(err || 'Failed to reject design.');
      }
    } else {
      // Mock simulation fallback if token is not available
      setSimulatedStatus('Rejected');
      toast.success('Design rejected (Simulation Mode)!');
      onStatusChange?.();
    }
  };

  const isCurrentlyFetching = Boolean(variantId) && String(activeFetchId) !== String(variantId);
  const isTabLoading = isCurrentlyFetching || loading || variantsLoading;

  // Gracefully compute active design share using response details, with complete null/undefined/empty fallbacks
  const shared = useMemo<SharedDesign | null>(() => {
    if (isTabLoading) return null;

    const latestShare = shares && shares.length > 0 ? shares[0] : null;

    if (!latestShare) {
      // Fallback to request-based parameters (mimicking original UI behavior) when API is empty/null
      const s = request.status?.toUpperCase();
      if (s === 'SHARED' || s === 'SENT TO CUSTOMER' || s === 'SENT_TO_CUSTOMER' || s === 'APPROVED') {
        const baseStatus: 'Pending Approval' | 'Approved' | 'Rejected' =
          s === 'APPROVED' ? 'Approved' : 'Pending Approval';
        return {
          customerName: request.customer?.name || 'N/A',
          email: request.customer?.email || 'N/A',
          dateShared: resendDate || request.date || 'N/A',
          status: simulatedStatus || baseStatus,
        };
      }
      return null;
    }

    const getFallback = (val: any, fallback = 'N/A') => {
      if (val === null || val === undefined || String(val).trim() === '') {
        return fallback;
      }
      return String(val);
    };

    let formattedDate = 'N/A';
    if (latestShare.shared_on) {
      try {
        formattedDate = new Date(latestShare.shared_on).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      } catch (e) {
        formattedDate = getFallback(latestShare.shared_on);
      }
    }

    const statusMapped = latestShare.status || 'Pending Approval';

    return {
      customerName: getFallback(latestShare.customer_name),
      email: getFallback(latestShare.email),
      dateShared: resendDate || formattedDate,
      status: simulatedStatus || statusMapped,
      note: latestShare.customer_comment_or_feedback ? String(latestShare.customer_comment_or_feedback) : undefined,
      token: latestShare.token ? String(latestShare.token) : undefined,
    };
  }, [shares, isTabLoading, request, simulatedStatus, resendDate]);

  const isApproved = (status: string) => {
    const s = status.toUpperCase();
    return s === 'APPROVED' || s === 'ACCEPTED' || s === 'APPROVED_BY_CUSTOMER' || s === 'QUOTED';
  };

  const isRejected = (status: string) => {
    const s = status.toUpperCase();
    return s === 'REJECTED' || s === 'NEEDS_REFINEMENT';
  };

  const isPending = (status: string) => {
    const s = status.toUpperCase();
    return s === 'PENDING' || s === 'PENDING_APPROVAL' || s === 'PENDING APPROVAL' || s === 'SENT' || s === 'SHARED';
  };

  const getStatusConfig = (status: string) => {
    if (isApproved(status)) {
      let label = status;
      const s = status.toUpperCase();
      if (s === 'ACCEPTED' || s === 'APPROVED' || s === 'APPROVED_BY_CUSTOMER') {
        label = 'Approved';
      }
      return { bgClass: 'bg-[rgba(34,197,94,0.12)]', textClass: 'text-[#16A34A]', dotClass: 'bg-[#22C55E]', label };
    }
    if (isRejected(status)) {
      if (status.toUpperCase() === 'NEEDS_REFINEMENT') {
        return { bgClass: 'bg-[rgba(253,160,24,0.12)]', textClass: 'text-[#D97706]', dotClass: 'bg-[#F59E0B]', label: status };
      }
      return { bgClass: 'bg-[rgba(239,68,68,0.10)]', textClass: 'text-[#DC2626]', dotClass: 'bg-[#EF4444]', label: status };
    }
    return { bgClass: 'bg-[rgba(253,160,24,0.12)]', textClass: 'text-[#D97706]', dotClass: 'bg-[#F59E0B]', label: status };
  };

  const currentStatusConfig = shared ? getStatusConfig(shared.status) : null;

  if (isTabLoading) {
    return (
      <div className="flex flex-col xl:flex-row gap-4 xl:gap-5">
        <div className="flex-1 min-w-0">
          <div className="rounded-[20px] p-4 sm:p-6 mb-4 sm:mb-5 bg-white dark:bg-surface-100 border border-black/[0.05] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div className="h-5 skeleton-shimmer rounded-[6px] w-[140px]" />
              <div className="h-6 skeleton-shimmer rounded-full w-[100px]" />
            </div>

            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full skeleton-shimmer flex-shrink-0" />
              <div className="flex-1 space-y-2 mt-1">
                <div className="h-4 skeleton-shimmer rounded-[4px] w-[160px]" />
                <div className="h-3.5 skeleton-shimmer rounded-[4px] w-[200px]" />
                <div className="h-3 skeleton-shimmer rounded-[4px] w-[120px]" />
              </div>
            </div>

            <div className="h-16 skeleton-shimmer rounded-[12px] w-full" />
          </div>

          <div className="flex items-center gap-2">
            <div className="h-10 skeleton-shimmer rounded-[10px] w-[100px]" />
            <div className="h-10 skeleton-shimmer rounded-[10px] w-[120px]" />
          </div>
        </div>

        <div className="w-full xl:w-[260px] flex-shrink-0">
          <div className="rounded-[20px] p-4 sm:p-5 bg-[#FAFAF8] dark:bg-surface-100 border border-[rgba(0,0,0,0.04)] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
            <div className="h-4 skeleton-shimmer rounded-[4px] w-[120px]" />
            <div className="space-y-2">
              <div className="h-3 skeleton-shimmer rounded-[4px] w-full" />
              <div className="h-3 skeleton-shimmer rounded-[4px] w-[80%]" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-10 skeleton-shimmer rounded-[10px] w-full" />
              <div className="h-10 skeleton-shimmer rounded-[10px] w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {!shared ? (
        <div className="w-full flex flex-col items-center py-8 sm:py-12 px-4 sm:px-8 gap-6">
          <div className="flex flex-col items-center text-center max-w-[420px] w-full rounded-[28px] px-5 sm:px-10 py-8 sm:py-12 bg-white/90 dark:bg-surface-150 shadow-[0_8px_48px_rgba(59,130,246,0.07),_0_2px_12px_rgba(0,0,0,0.04)] border border-[rgba(59,130,246,0.10)] dark:border-border-default">
            <div className="w-[68px] h-[68px] flex items-center justify-center rounded-[20px] mb-6 bg-[linear-gradient(135deg,rgba(59,130,246,0.10)_0%,rgba(139,92,246,0.07)_100%)] border border-[rgba(59,130,246,0.14)] dark:border-border-default">
              <i className="ri-user-heart-line text-[28px] text-[#3B82F6]"></i>
            </div>

            <h3 className="text-[18px] font-semibold text-[#1A1A1A] dark:text-ink mb-3 leading-snug font-satoshi tracking-[-0.2px]">
              No design sent to customer yet
            </h3>

            <p className="text-[13.5px] text-[#9CA3AF] dark:text-ink-600 leading-relaxed mb-8 font-inter">
              Share this design with your customer for review and approval.
            </p>

            <div className="flex flex-col items-center gap-4 w-full">
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-[14px] text-[13.5px] font-semibold text-white transition-all duration-200 cursor-pointer whitespace-nowrap hover:opacity-90 active:scale-[0.98] bg-[#3B82F6] shadow-[0_4px_18px_rgba(59,130,246,0.28)] min-h-touch dark:text-black dark:!bg-[#60A5FA]"
              >
                <i className="ri-send-plane-line text-[15px]"></i>
                Send to Customer
              </button>

              <div className="flex items-start gap-1.5 text-left">
                <i className="ri-arrow-left-up-line text-[12px] text-[#3B82F6] opacity-50 mt-0.5 shrink-0"></i>
                <span className="text-[11.5px] text-[#C4B8A8] dark:text-ink-600 font-inter leading-relaxed">
                  You can also share directly from the{' '}
                  <button type="button" onClick={onGoToDesign} className="text-[#3B82F6] font-medium hover:underline cursor-pointer">Design tab</button>
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-4 xl:gap-5">
          <div className="flex-1 min-w-0">
            <div className="rounded-[20px] p-4 sm:p-6 mb-4 sm:mb-5 bg-white dark:bg-surface-100 shadow-[0_2px_12px_rgba(0,0,0,0.04),_0_0_1px_rgba(0,0,0,0.06)] border border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-5">
                <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#1A1A1A] dark:text-ink font-satoshi">
                  Customer Review
                </h3>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] font-semibold self-start sm:self-auto ${currentStatusConfig?.bgClass} ${currentStatusConfig?.textClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatusConfig?.dotClass}`} />
                  {currentStatusConfig?.label}
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-[rgba(59,130,246,0.08)]">
                  <i className="ri-user-line text-[18px] sm:text-[20px] text-[#3B82F6]"></i>
                </div>
                <div>
                  <p className="text-[13px] sm:text-[14px] font-semibold text-[#1A1A1A] dark:text-ink">{shared.customerName}</p>
                  <p className="text-[11px] sm:text-[12.5px] text-[#9CA3AF] dark:text-[#A1A8B3] mt-0.5 break-all">{shared.email}</p>
                  <p className="text-[10px] sm:text-[11.5px] text-[#C4C4C4] dark:text-[#A1A8B3] mt-1">
                    Shared on {shared.dateShared}
                  </p>
                </div>
              </div>

              {isPending(shared.status) && (
                <div className="flex items-start sm:items-center gap-2 px-4 py-3 rounded-[12px] bg-[#FFFBEB] dark:bg-amber-950/20 border border-[#FDE68A] dark:border-amber-500/30 mb-5">
                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i className="ri-time-line text-[14px] text-[#D97706] dark:text-amber-400"></i>
                  </span>
                  <p className="text-[12px] sm:text-[12.5px] text-[#B45309] dark:text-amber-400 leading-relaxed">
                    Waiting for customer response. They will receive an email with Approve / Reject options.
                  </p>
                </div>
              )}

              {isApproved(shared.status) && (
                <div className="flex items-start sm:items-center gap-2 px-4 py-3 rounded-[12px] bg-[#F0FDF4] dark:bg-green-950/20 border border-[#BBF7D0] dark:border-green-500/30 mb-5">
                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i className="ri-checkbox-circle-line text-[14px] text-[#16A34A] dark:text-green-400"></i>
                  </span>
                  <p className="text-[12px] sm:text-[12.5px] text-[#15803D] dark:text-green-400 leading-relaxed">
                    Customer approved the design. You can now proceed to manufacturer dispatch.
                  </p>
                </div>
              )}

              {isRejected(shared.status) && (
                <div className="flex items-start sm:items-center gap-2 px-4 py-3 rounded-[12px] bg-[#FEF2F2] dark:bg-red-950/20 border border-[#FECACA] dark:border-red-500/30 mb-5">
                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i className="ri-close-circle-line text-[14px] text-[#DC2626] dark:text-red-400"></i>
                  </span>
                  <div>
                    <p className="text-[12px] sm:text-[12.5px] text-[#B91C1C] dark:text-red-400 leading-relaxed">
                      {shared.status.toUpperCase() === 'NEEDS_REFINEMENT' ? 'Customer requested refinement.' : 'Customer requested changes.'}
                    </p>
                    <p className="text-[10px] sm:text-[11.5px] text-[#DC2626] dark:text-red-400 mt-0.5 leading-relaxed">
                      Update the design in the Design tab and reshare for approval.
                    </p>
                  </div>
                </div>
              )}

              {shared.note && (
                <div className="rounded-[12px] px-4 py-3 bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.04] dark:border-white/[0.08] min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">
                    {isApproved(shared.status) || isRejected(shared.status) ? 'Customer Feedback' : 'Your Note'}
                  </p>
                  <p className="text-[12px] sm:text-[13px] text-[#374151] dark:text-ink leading-relaxed break-all break-words whitespace-pre-wrap max-h-[100px] overflow-y-auto custom-scrollbar pr-1">{shared.note}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4 xl:mb-0">
              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-medium text-[#6B7280] dark:text-ink bg-white dark:bg-surface-100 border border-gray-200 dark:border-border-default hover:bg-gray-50 dark:hover:bg-surface-150 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto min-h-touch transition-all duration-150 cursor-pointer whitespace-nowrap"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className={`${sending ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} text-[14px]`}></i>
                </span>
                {sending ? 'Resending...' : 'Resend'}
              </button>

              <button
                type="button"
                onClick={handleUpdateDesign}
                disabled={isApproved(shared.status) || isPending(shared.status)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-medium text-[#3B82F6] dark:text-[#60A5FA] bg-white dark:bg-surface-100 border border-[#3B82F6] dark:border-[#60A5FA] hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto min-h-touch transition-all duration-150 cursor-pointer whitespace-nowrap"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-pencil-line text-[14px]"></i>
                </span>
                Update Design
              </button>

              <div className="flex-1" />

            </div>
          </div>

          <div className="w-full xl:w-[260px] flex-shrink-0">
            <div className="rounded-[20px] p-4 sm:p-5 bg-[#FAFAF8] dark:bg-surface-100 shadow-[0_2px_12px_rgba(0,0,0,0.04),_0_0_1px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] dark:border-white/[0.08]">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#A1A8B3] mb-3">
                Simulate Customer
              </p>
              <p className="text-[11px] sm:text-[12px] text-[#9CA3AF] dark:text-[#D1D5DB] mb-4 leading-relaxed">
                Preview how the customer sees the approval request.
              </p>

              <div className="flex flex-col gap-2">
                {isApproved(shared.status) ? (
                  <button
                    type="button"
                    disabled
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-semibold text-[#16A34A] bg-[#16A34A]/20 cursor-not-allowed whitespace-nowrap border border-[#16A34A]/30 disabled:opacity-100 min-h-touch"
                  >
                    <i className="ri-checkbox-circle-line text-[15px]"></i>
                    Approved
                  </button>
                ) : isRejected(shared.status) ? (
                  <button
                    type="button"
                    disabled
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-semibold text-[#DC2626] bg-[#DC2626]/10 cursor-not-allowed whitespace-nowrap border border-[#DC2626]/20 disabled:opacity-60 opacity-60 min-h-touch"
                  >
                    <i className="ri-prohibited-line text-[15px]"></i>
                    {shared.status.toUpperCase() === 'NEEDS_REFINEMENT' ? 'Needs Refinement' : 'Rejected'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={approveLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-semibold text-white dark:text-black transition-all duration-150 cursor-pointer whitespace-nowrap hover:opacity-90 bg-[#16A34A] disabled:opacity-50 min-h-touch"
                    >
                      {approveLoading ? (
                        <i className="ri-loader-4-line animate-spin text-[15px]"></i>
                      ) : (
                        <i className="ri-checkbox-circle-line text-[15px]"></i>
                      )}
                      {approveLoading ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={rejectLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-medium text-[#DC2626] transition-all duration-150 cursor-pointer whitespace-nowrap hover:bg-[#FEF2F2] dark:hover:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed min-h-touch"
                    >
                      {rejectLoading ? (
                        <i className="ri-loader-4-line animate-spin text-[15px]"></i>
                      ) : (
                        <i className="ri-close-circle-line text-[15px]"></i>
                      )}
                      {rejectLoading ? 'Rejecting...' : 'Reject'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <ShareCustomerModal
          request={request}
          variantId={variantId}
          activeMetal={activeMetal}
          onClose={() => setShowShareModal(false)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
