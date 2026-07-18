'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchMyPlan } from '@/redux/slices/retailer/billing/myPlanSlice';
import { fetchSubscriptions } from '@/redux/slices/retailer/billing/subscriptionsSlice';
import { fetchTokenStatus } from '@/redux/slices/retailer/billing/tokenStatusSlice';
import { fetchPaymentHistory } from '@/redux/slices/retailer/billing/paymentHistorySlice';
import { fetchInvoices } from '@/redux/slices/retailer/billing/invoicesSlice';
import { downloadInvoicePdf } from '@/redux/slices/retailer/billing/invoiceDownloadSlice';
import { createCheckoutSession } from '@/redux/slices/retailer/billing/checkoutSlice';
import { createTopUpCheckoutSession } from '@/redux/slices/retailer/billing/topUpCheckoutSlice';
import { fetchUserProfile } from '@/redux/slices/retailer/settings/profileSlice';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchCancelPlans } from '@/redux/slices/retailer/billing/cancelPlansSlice';
import { fetchTopupPacks } from '@/redux/slices/retailer/billing/topupPacksSlice';
import { toast } from 'react-toastify';
import SubscriptionCancellationFlow from './SubscriptionCancellationFlow';

export const PLAN_LIMITS = [
  'Render usage resets monthly based on your plan.',
  'Unused renders do not roll over.',
  'Top-up renders are consumed after your base plan quota.',
];

const getStatusStyles = (status?: string | null) => {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'COMPLETED':
    case 'SUCCESS':
    case 'PAID':
      return {
        label: 'Completed',
        bg: 'bg-tint-emerald',
        color: 'text-success-medium',
        icon: 'ri-checkbox-circle-line',
        iconBg: 'bg-tint-emerald',
        iconColor: 'text-success-medium',
      };
    case 'PENDING':
      return {
        label: 'Pending',
        bg: 'bg-tint-warning',
        color: 'text-warning',
        icon: 'ri-time-line',
        iconBg: 'bg-tint-warning',
        iconColor: 'text-warning',
      };
    case 'FAILED':
    case 'CANCELLED':
      return {
        label: s.charAt(0) + s.slice(1).toLowerCase(),
        bg: 'bg-tint-danger-soft',
        color: 'text-danger',
        icon: 'ri-close-circle-line',
        iconBg: 'bg-tint-danger-soft',
        iconColor: 'text-danger',
      };
    default:
      return {
        label: status || 'N/A',
        bg: 'bg-tint-gray',
        color: 'text-ink-500',
        icon: 'ri-wallet-3-line',
        iconBg: 'bg-tint-gray',
        iconColor: 'text-ink-500',
      };
  }
};

const formatPaymentDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    // Parse ISO string to extract exact time from API without timezone conversion
    // Format: 2026-07-03T07:36:19.559818-05:00
    const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!dateMatch) return 'N/A';

    const [, year, month, day, hourStr, minuteStr] = dateMatch;
    const dayNum = parseInt(day, 10);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(month, 10) - 1];
    const hours = parseInt(hourStr, 10);
    const minutes = minuteStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;

    return `${dayNum} ${monthName} ${year} at ${displayHour}:${minutes} ${ampm}`;
  } catch {
    return 'N/A';
  }
};

const formatInvoiceDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

const formatInvoiceAmount = (amt: any, currency: string) => {
  if (amt === undefined || amt === null) return '0.00';
  const num = parseFloat(String(amt));
  if (isNaN(num)) return '0.00';
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const currencyStr = currency || 'USD';
  const absNum = Math.abs(num);
  const displayAmt = absNum > 1e12 ? absNum.toExponential(2) : absNum.toFixed(2);
  return `${symbol}${displayAmt} ${currencyStr}`;
};

const getBrandingText = (plan: any) => {
  const canUseLogo = Boolean(plan.can_use_logo);
  const canUseBrandName = Boolean(plan.can_use_brand_name);
  const canUseCustomColor = Boolean(plan.can_use_custom_color);

  if (!canUseLogo && !canUseBrandName && !canUseCustomColor) {
    return 'No branding on external pages';
  }

  if (canUseLogo && canUseBrandName && canUseCustomColor) {
    return 'Full custom branding';
  }

  if (canUseLogo && !canUseBrandName && !canUseCustomColor) {
    return 'Logo + Powered by CraftsmanAI';
  }

  if (canUseLogo && !canUseBrandName && canUseCustomColor) {
    return 'Logo + Powered by CraftsmanAI';
  }

  return 'Tailored';
};

const getRendersText = (renders: number) => {
  if (renders === -1) return 'Unlimited renders per month';
  return `${renders} renders per month`;
};

export default function UsagePlanCard() {
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isDowngradeFlow, setIsDowngradeFlow] = useState(false);
  const [isPurchaseFlow, setIsPurchaseFlow] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [confirmUpgradePlan, setConfirmUpgradePlan] = useState<{
    planId: string;
    planName: string;
  } | null>(null);

  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showManagePlanModal, setShowManagePlanModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showContactSalesModal, setShowContactSalesModal] = useState(false);
  const [docsSubmitted, setDocsSubmitted] = useState(false);
  const [docsForm, setDocsForm] = useState({
    email: '',
    message: '',
  });

  const dispatch = useAppDispatch();
  const { plan: myPlan, status: myPlanStatus } = useAppSelector((state) => state.retailerMyPlan);
  const { items: subscriptions, status: subscriptionsStatus } = useAppSelector(
    (state) => state.retailerSubscriptions,
  );
  const cancelPlansState = useAppSelector((state) => state.retailerCancelPlans);
  const { data: tokenStatus, status: tokenStatusStatus } = useAppSelector(
    (state) => state.retailerTokenStatus,
  );
  const {
    payments,
    status: paymentHistoryStatus,
    pagination: paymentPagination,
  } = useAppSelector((state) => state.retailerPaymentHistory);
  const {
    invoices,
    status: invoicesStatus,
    pagination: invoicesPagination,
  } = useAppSelector((state) => state.retailerInvoices);
  const { status: checkoutStatus } = useAppSelector((state) => state.retailerCheckout);
  const { status: topUpCheckoutStatus } = useAppSelector((state) => state.retailerTopUpCheckout);
  const { items: topupPacksItems, status: topupPacksStatus } = useAppSelector((state) => state.retailerTopupPacks);
  const { downloadingPaymentIds } = useAppSelector((state) => state.retailerInvoiceDownload);
  const { profileItem, profileStatus } = useAppSelector((state) => state.retailerProfile);

  const [currentPage, setCurrentPage] = useState(1);
  const [currentInvoicesPage, setCurrentInvoicesPage] = useState(1);
  const [pageSize] = useState(10);

  useEffect(() => {
    dispatch(fetchMyPlan());
    dispatch(fetchTokenStatus());
    dispatch(fetchPaymentHistory({ page: 1, limit: 10 }))
      .unwrap()
      .catch((err) => {
        toast.error(err || 'Failed to load payment history');
      });
    dispatch(fetchInvoices({ page: 1, limit: 10 }))
      .unwrap()
      .catch((err) => {
        toast.error(err || 'Failed to load invoices');
      });
    dispatch(fetchUserProfile());
    dispatch(fetchTopupPacks({ onlyActive: true }));
  }, [dispatch]);

  useEffect(() => {
    if (profileItem?.email) {
      setDocsForm((prev) => ({ ...prev, email: profileItem.email }));
    }
  }, [profileItem]);

  const isFetchingRef = useRef(false);
  const isFetchingInvoicesRef = useRef(false);
  const paymentsScrollRef = useRef<HTMLDivElement>(null);
  const invoicesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paymentHistoryStatus !== 'loading') {
      isFetchingRef.current = false;
    }
  }, [paymentHistoryStatus]);

  useEffect(() => {
    if (invoicesStatus !== 'loading') {
      isFetchingInvoicesRef.current = false;
    }
  }, [invoicesStatus]);

  const activeTopupPacks = [...topupPacksItems]
    .map((pack) => {
      const renders = Number(pack.renders) || 0;
      const price = Number(pack.price) || 0;
      return {
        id: pack.id,
        renders,
        price,
        perRender: renders > 0 ? price / renders : 0,
        bestValue: false,
      };
    })
    .sort((a, b) => a.renders - b.renders);
  const maxRenders = activeTopupPacks.reduce((max, pack) => Math.max(max, pack.renders), 0);
  const topupPackCards = activeTopupPacks.map((pack) => ({
    ...pack,
    label: `${pack.renders} Renders`,
    bestValue: pack.renders === maxRenders && maxRenders > 0,
  }));
  const selectedTopUpPack = topupPackCards.find((pack) => pack.id === selectedPackId) ?? null;

  const loadMorePayments = useCallback(() => {
    if (isFetchingRef.current || !paymentPagination?.hasNext) return;
    isFetchingRef.current = true;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    dispatch(fetchPaymentHistory({ page: nextPage, limit: pageSize }))
      .unwrap()
      .catch(() => {
        isFetchingRef.current = false;
      });
  }, [dispatch, paymentPagination, currentPage, pageSize]);

  const loadMoreInvoices = useCallback(() => {
    if (isFetchingInvoicesRef.current || !invoicesPagination?.hasNext) return;
    isFetchingInvoicesRef.current = true;
    const nextPage = currentInvoicesPage + 1;
    setCurrentInvoicesPage(nextPage);
    dispatch(fetchInvoices({ page: nextPage, limit: pageSize }))
      .unwrap()
      .catch(() => {
        isFetchingInvoicesRef.current = false;
      });
  }, [dispatch, invoicesPagination, currentInvoicesPage, pageSize]);

  const handleInvoiceAction = useCallback((url?: string | null) => {
    if (!url) {
      toast.error('Invoice PDF is not available');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  useEffect(() => {
    const scrollContainer = paymentsScrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const nearBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop <=
        scrollContainer.clientHeight + 100;
      if (nearBottom) {
        loadMorePayments();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [loadMorePayments, payments.length]);

  useEffect(() => {
    const scrollContainer = invoicesScrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const nearBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop <=
        scrollContainer.clientHeight + 100;
      if (nearBottom) {
        loadMoreInvoices();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [loadMoreInvoices, invoices.length]);

  const used = tokenStatus?.monthly_renders_used ?? 0;
  const limit = tokenStatus?.monthly_renders_limit ?? 0;
  const topupRenders = tokenStatus?.topup_renders ?? 0;
  const isUnlimited = tokenStatus?.is_unlimited ?? false;

  const isAllExhausted = !isUnlimited && (used >= limit + topupRenders);
  const isTopUpActive = !isUnlimited && !isAllExhausted && (used >= limit) && (topupRenders > 0);
  const isBasePlanActive = !isUnlimited && !isAllExhausted && !isTopUpActive;

  let displayUsed = used;
  let displayLimit = limit;
  let displayRemaining = Math.max(limit - used, 0);
  let usageLabel = 'Renders Used';
  let usageStatusText = '';

  if (isUnlimited) {
    displayUsed = used;
    displayLimit = 0;
    displayRemaining = 0;
    usageLabel = 'Renders Used';
    usageStatusText = 'Unlimited renders remaining';
  } else if (isBasePlanActive) {
    displayUsed = used;
    displayLimit = limit;
    displayRemaining = Math.max(limit - used, 0);
    usageLabel = 'Renders Used';
    usageStatusText = `${displayRemaining} renders remaining`;
  } else if (isTopUpActive) {
    displayUsed = Math.max(used - limit, 0);
    displayLimit = topupRenders;
    displayRemaining = Math.max(topupRenders - displayUsed, 0);
    usageLabel = 'Top-Up renders Used';
    usageStatusText = `${displayRemaining} renders remaining`;
  } else if (isAllExhausted) {
    displayUsed = topupRenders > 0 ? topupRenders : limit;
    displayLimit = topupRenders > 0 ? topupRenders : limit;
    displayRemaining = 0;
    usageLabel = topupRenders > 0 ? 'Top-Up renders Used' : 'Renders Used';
    usageStatusText = topupRenders > 0
      ? 'You have reached your monthly plan and top up render limit'
      : 'You have reached your monthly plan render limit';
  }

  let pct = 0;
  if (!isUnlimited && displayLimit > 0) {
    pct = Math.min(100, Math.round((displayUsed / displayLimit) * 100));
  }

  const resetDateText = myPlan?.end_date
    ? `Resets on ${new Date(myPlan.end_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
    : 'N/A';
  const isTopUpProcessing = topUpCheckoutStatus === 'loading';

  useEffect(() => {
    const anyModalOpen =
      showUpgradeModal ||
      showDocsModal ||
      showManagePlanModal ||
      showPurchaseModal ||
      Boolean(confirmUpgradePlan);
    const main = document.querySelector('main') as HTMLElement | null;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalMainOverflow = main?.style.overflow ?? '';

    if (anyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (main) main.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      if (main) main.style.overflow = originalMainOverflow;
    };
  }, [
    showUpgradeModal,
    showDocsModal,
    showManagePlanModal,
    showPurchaseModal,
    confirmUpgradePlan,
  ]);

  const openUpgrade = (isDowngrade: boolean | React.MouseEvent<any> = false, isPurchase = false) => {
    const isDowngradeBool = typeof isDowngrade === 'boolean' ? isDowngrade : false;
    setBillingCycle('monthly');
    setIsDowngradeFlow(isDowngradeBool);
    setIsPurchaseFlow(isPurchase);
    setShowUpgradeModal(true);
    if (isDowngradeBool) {
      dispatch(fetchCancelPlans());
    } else {
      dispatch(fetchSubscriptions());
    }
  };

  const handleTopUpCheckout = async () => {
    if (!selectedTopUpPack?.id) {
      toast.error('This top-up pack is currently unavailable.');
      return;
    }

    try {
      const response = await dispatch(
        createTopUpCheckoutSession({ topUpPackId: selectedTopUpPack.id }),
      ).unwrap();

      if (response.message) {
        toast.success(response.message);
      }

      if (response.checkout_url) {
        window.location.href = response.checkout_url;
        return;
      }

      throw new Error('Checkout URL not returned from server.');
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.notification_message ||
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to create top-up checkout session.';
      toast.error(message);
    }
  };

  const handlePlanClick = (planId: string, planName: string) => {
    setLoadingPlanId(planId);
    dispatch(createCheckoutSession({ planId, billingCycle }))
      .unwrap()
      .then((res) => {
        if (res.checkout_url) {
          toast.success(`Redirecting to checkout for the ${planName}...`);
          window.location.href = res.checkout_url;
        } else {
          toast.error('Checkout URL not returned from server.');
          setLoadingPlanId(null);
        }
      })
      .catch((err) => {
        toast.error(err || `Failed to initiate checkout for ${planName}.`);
        setLoadingPlanId(null);
      });
  };

  const openDocsModal = () => {
    setDocsSubmitted(false);
    setDocsForm({ email: profileItem?.email || '', message: '' });
    setShowDocsModal(true);
  };

  const handleDocsSubmit = () => {
    setDocsSubmitted(true);
  };

  const cardCN = 'bg-glass-80 backdrop-blur-xl shadow-card-deeper border border-glass-vivid';

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-1">
        <h2 className="text-heading-md font-bold text-ink-900 font-satoshi dark:text-[#E7EAEE]">
          Usage &amp; Plan
        </h2>
        <p className="text-body-sm text-ink-400 mt-0.5">
          Monitor your render usage and plan details.
        </p>
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-brand">
            <span className="ri-bar-chart-2-line text-ui-md text-brand w-4 h-4 flex items-center justify-center"></span>
          </div>
          <div>
            <p className="text-body-md font-semibold text-ink-900 font-satoshi">
              Your Usage This Month
            </p>
            <p className="text-label-sm text-ink-400">
              Each render represents a generated jewelery design.
            </p>
          </div>
        </div>

        {tokenStatusStatus === 'loading' || tokenStatusStatus === 'idle' ? (
          <div className="animate-pulse">
            <div className="flex items-end justify-between mb-3">
              <div>
                <Skeleton className="h-10 w-48 mb-1" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full mb-3" />
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-3">
              <div>
                <p className={`text-3xl sm:text-display font-bold font-satoshi ${isAllExhausted ? 'text-[#DC2626] dark:text-[#EF4444]' : 'text-ink-900'} whitespace-nowrap`}>
                  {displayUsed}{' '}
                  <span className={`text-sm sm:text-ui-md font-medium ${isAllExhausted ? 'text-[#DC2626]/80 dark:text-[#EF4444]/80' : 'text-ink-400'}`}>
                    / {isUnlimited ? 'Unlimited' : `${displayLimit}`} {usageLabel}
                  </span>
                </p>
              </div>
              {!isUnlimited && (
                <span className={`text-body-sm font-semibold self-end sm:self-auto ${isAllExhausted ? 'text-[#DC2626] dark:text-[#EF4444]' : 'text-brand'}`}>{pct} %</span>
              )}
            </div>

            {!isUnlimited && (
              <div className="relative h-2.5 rounded-full overflow-hidden mb-3 bg-muted-bg-70">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 bg-gradient-brand shadow-glow-brand-spot"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-4">
              <p className="text-label text-ink-400">
                <span className={`font-semibold ${isAllExhausted ? 'text-[#DC2626] dark:text-[#EF4444]' : 'text-ink-700'}`}>
                  {usageStatusText}
                </span>
              </p>
              <p className="text-label text-ink-400">{resetDateText}</p>
            </div>
          </>
        )}

        <div className="flex flex-col gap-3.5 mb-4 px-1">
          {/* Base Plan Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-400">Base Plan</span>
              {isBasePlanActive && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B9811A] text-[#10B981] dark:bg-[#137333]/20 dark:text-[#81C784]">
                  Active
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-[#6B7280] dark:text-[#6B7280]">{limit} Renders</p>
          </div>

          {/* Top up Plan Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-400">Top up Plan</span>
              {isTopUpActive && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EA] text-[#137333] dark:bg-[#137333]/20 dark:text-[#81C784]">
                  Active
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-[#6B7280] dark:text-[#6B7280]">{topupRenders} Extra Render</p>
          </div>
        </div>

        {!isAllExhausted && (
          <div className="rounded-[20px] p-5 flex flex-col gap-4 bg-gray-50/50 dark:bg-surface-150 border border-gray-100 dark:border-white/5">
            <div className="flex items-start gap-3">
              <span className="w-4 h-4 flex items-center justify-center ri-information-line text-[15px] text-blue-500 mt-0.5 shrink-0"></span>
              <p className="text-xs text-gray-500 dark:text-[#A1A8B3] leading-relaxed">Your current usage is within plan limits.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-4 h-4 flex items-center justify-center ri-alert-line text-[15px] text-amber-500 mt-0.5 shrink-0"></span>
              <p className="text-xs text-gray-500 dark:text-[#A1A8B3] leading-relaxed">At 80% usage, you will receive a usage alert.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-4 h-4 flex items-center justify-center ri-indeterminate-circle-line text-[15px] text-red-500 mt-0.5 shrink-0"></span>
              <p className="text-xs text-gray-500 dark:text-[#A1A8B3] leading-relaxed">
                At 100% usage, new render generation will be paused until you upgrade or purchase
                additional renders.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#EEF2FF] dark:bg-[#171C22]">
              <span className="ri-vip-crown-2-line text-lg text-[#6366F1] w-5 h-5 flex items-center justify-center"></span>
            </div>
            <p className="text-body-md font-semibold text-ink-900 font-satoshi">Current Plan</p>
          </div>
          {myPlanStatus === 'loading' || myPlanStatus === 'idle' ? (
            <div className="h-6 w-16 bg-muted-bg-70 rounded-full animate-pulse"></div>
          ) : myPlan ? (
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${myPlan.status?.toLowerCase() === 'active' ? 'bg-[#ECFDF5] text-[#10B981]' : 'bg-tint-warning text-warning'}`}
            >
              {myPlan.status
                ? myPlan.status.charAt(0).toUpperCase() + myPlan.status.slice(1)
                : 'N/A'}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-tint-danger-soft text-danger">
              Inactive
            </span>
          )}
        </div>

        {myPlanStatus === 'loading' || myPlanStatus === 'idle' ? (
          <div className="rounded-2xl p-5 mb-4 bg-section border border-sand">
            <Skeleton className="h-8 w-1/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ) : (
          (() => {
            if (!myPlan) {
              return (
                <div className="rounded-2xl p-6 mb-4 bg-section border border-sand flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-tint-danger-soft mb-3">
                    <span className="w-6 h-6 flex items-center justify-center ri-error-warning-line text-heading text-danger"></span>
                  </div>
                  <p className="text-body-md font-bold text-ink-900 font-satoshi mb-1">
                    No Active Plan
                  </p>
                  <p className="text-label-md text-ink-500 mb-4 max-w-[340px]">
                    You do not currently have an active subscription. Upgrade to start generating
                    custom jewelery renders.
                  </p>
                  <button
                    onClick={() => openUpgrade(false, true)}
                    className="px-5 py-2.5 bg-gradient-indigo shadow-glow-indigo text-white rounded-xl text-body-sm font-semibold transition-all"
                  >
                    Purchase Plan
                  </button>
                </div>
              );
            }

            const currentSub = subscriptions?.find((p) => p.id === myPlan.plan_id);
            const activePlan = myPlan.plan || currentSub;
            const durationDays = activePlan?.duration_days;
            const isYearly = durationDays ? durationDays > 300 : false;
            const billingCycleVal = isYearly ? 'Yearly' : 'Monthly';
            const nextBillingDateVal = myPlan?.end_date
              ? new Date(myPlan.end_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
              : 'N/A';

            const startDateVal = myPlan?.start_date
              ? new Date(myPlan.start_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
              : 'N/A';

            const featuresList = activePlan?.feature_points || [];

            return (
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl p-5 bg-[#F9FAFB]/90 dark:bg-[#171C22] border border-[#E5E7EB]/50 dark:border-[#E5E7EB]/10 flex flex-col gap-4">
                  <h3 className="text-2xl font-bold text-[#2F68C5] dark:text-brand font-satoshi">
                    {myPlan?.plan_name || activePlan?.name || 'Unnamed Plan'}
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-24 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#6B7280] dark:text-[#A1A8B3]">Start Date:</span>
                      <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]/90">
                        {startDateVal}
                      </span>
                    </div>
                    {!(myPlan.status == "CANCELLED") && <div className="flex items-center gap-1.5">
                      <span className="text-[#6B7280] dark:text-[#A1A8B3]">Next Billing Date:</span>
                      <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]/90">
                        {nextBillingDateVal}
                      </span>
                    </div>}
                  </div>
                </div>

                <hr className="border-[#E5E7EB]/70 dark:border-[#E5E7EB]/10" />

                <div>
                  <h4 className="text-sm font-bold text-[#374151] dark:text-[#F9FAFB]/90 mb-4">
                    What You Get
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {featuresList.map((feature, i) => (
                      <div
                        key={i}
                        className="
      group flex items-center gap-3 p-4 rounded-2xl
      bg-[#F9F9F9] dark:bg-[#171C22]/80
      backdrop-blur-sm
      border border-gray-200/70 dark:border-white/10
      shadow-sm hover:shadow-md
      transition-all duration-200
      hover:-translate-y-0.5
    "
                      >
                        <div
                          className="
        w-9 h-9 rounded-xl shrink-0
        flex items-center justify-center
        bg-blue-50 dark:bg-blue-500/10
        border border-blue-100 dark:border-blue-500/20
        transition-transform duration-200
        group-hover:scale-105
      "
                        >
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 8C0 3.58172 3.58172 0 8 0H20C24.4183 0 28 3.58172 28 8V20C28 24.4183 24.4183 28 20 28H8C3.58172 28 0 24.4183 0 20V8Z" fill="#EBF3FE" />
                            <path d="M15.4879 12.9291C15.2767 12.7157 15.1519 12.4557 15.1135 12.1491L14.9215 10.6091L13.6063 11.3491C13.3503 11.4957 13.0751 11.5424 12.7807 11.4891L11.3119 11.1991L11.5903 12.7291C11.6415 13.0357 11.5967 13.3224 11.4559 13.5891L10.7455 14.9591L12.2239 15.1591C12.5183 15.1991 12.7679 15.3291 12.9727 15.5491L13.9999 16.6791L14.6335 15.2791C14.7615 14.9991 14.9599 14.7924 15.2287 14.6591L16.5727 13.9991L15.4879 12.9291ZM15.5071 15.7091L14.4415 18.0291C14.4095 18.1091 14.3551 18.1624 14.2783 18.1891C14.2015 18.2157 14.1279 18.2124 14.0575 18.1791C14.0255 18.1591 13.9967 18.1357 13.9711 18.1091L12.2719 16.2391C12.2271 16.1857 12.1695 16.1557 12.0991 16.1491L9.65115 15.8191C9.57435 15.8057 9.51035 15.7657 9.45915 15.6991C9.40795 15.6324 9.38875 15.5591 9.40155 15.4791C9.40795 15.4391 9.41755 15.4057 9.43035 15.3791L10.6111 13.1091C10.6495 13.0491 10.6623 12.9857 10.6495 12.9191L10.1887 10.3791C10.1759 10.2991 10.1919 10.2257 10.2367 10.1591C10.2815 10.0924 10.3423 10.0491 10.4191 10.0291C10.4575 10.0224 10.4927 10.0224 10.5247 10.0291L12.9631 10.5091C13.0271 10.5224 13.0879 10.5091 13.1455 10.4691L15.3247 9.23906C15.3887 9.19906 15.4591 9.19073 15.5359 9.21406C15.6127 9.2374 15.6703 9.28573 15.7087 9.35906C15.7279 9.3924 15.7407 9.42906 15.7471 9.46906L16.0639 12.0191C16.0703 12.0924 16.0991 12.1524 16.1503 12.1991L17.9455 13.9691C18.0031 14.0291 18.0335 14.0991 18.0367 14.1791C18.0399 14.2591 18.0127 14.3324 17.9551 14.3991C17.9295 14.4257 17.9007 14.4457 17.8687 14.4591L15.6415 15.5691C15.5775 15.5957 15.5327 15.6424 15.5071 15.7091ZM15.8815 16.6691L16.5631 15.9591L18.5983 18.0891L17.9263 18.7891L15.8815 16.6691Z" fill="#2F68C5" />
                          </svg>

                        </div>

                        <span className="text-label-md font-medium text-gray-800 dark:text-gray-100">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2 w-full">
                  <button
                    onClick={openUpgrade}
                    className="w-full sm:w-auto px-6 py-2.5 flex items-center justify-center gap-3 rounded-full text-sm font-semibold text-nowrap text-white dark:text-black bg-gradient-to-br from-[#6366F1] to-[#3B82F6] hover:bg-[#25529C] transition-colors cursor-pointer"
                  >
                    Upgrade Plan  <svg className='stroke-white dark:stroke-black' width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4.16675 9.99935H15.8334M10.0001 15.8327L15.8334 9.99935L10.0001 4.16602" stroke="" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>

                  </button>
                  {!(myPlan.status == "CANCELLED") && <button
                    onClick={() => setShowManagePlanModal(true)}
                    className="w-full sm:w-auto px-6 py-2.5 flex items-center justify-center rounded-full text-sm font-semibold  bg-[#EBF3FF] text-[#2F68C5] dark:text-brand border border-[#2F68C5] dark:border-brand  dark:bg-transparent hover:bg-[#F3F4F6] dark:hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    Cancel Plan
                  </button>}
                </div>
              </div>
            );
          })()
        )}
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-emerald">
            <span className="ri-add-circle-line text-ui-md text-success-medium w-4 h-4 flex items-center justify-center"></span>
          </div>
          <p className="text-body-md font-semibold text-ink-900 font-satoshi">Top-Up Packs</p>
        </div>
        <p className="text-label-md text-ink-500 mb-5 ml-[42px]">
          Add additional render capacity when you reach your monthly limit.
        </p>

        {topupPacksStatus === 'loading' || topupPacksStatus === 'idle' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 flex flex-col items-center gap-1.5 bg-white dark:bg-surface-100 border border-gray-100 dark:border-border-default shadow-sm animate-pulse"
              >
                <Skeleton className="w-10 h-10 rounded-xl mb-1 bg-gray-200 dark:bg-surface-150" />
                <Skeleton className="h-8 w-16 mb-1 bg-gray-200 dark:bg-surface-150" />
                <Skeleton className="h-4 w-20 mb-2 bg-gray-200 dark:bg-surface-150" />
                <Skeleton className="h-6 w-12 mb-2 bg-gray-200 dark:bg-surface-150" />
                <Skeleton className="h-5 w-24 bg-gray-200 dark:bg-surface-150" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {topupPackCards.map((pack) => {
              const isSelected = selectedPackId === pack.id;
              return (
                <button
                  type="button"
                  key={pack.id}
                  onClick={() => setSelectedPackId(isSelected ? null : pack.id)}
                  className={`relative rounded-2xl p-5 flex flex-col items-center gap-1.5 transition-all duration-200 cursor-pointer ${isSelected
                    ? 'bg-[#fafafe] dark:bg-[#1a1a2e] border-2 border-[#6366F1] shadow-md scale-[103%]'
                    : 'bg-white dark:bg-surface-100 border border-[#E5E7EB] dark:border-[#E5E7EB]/10 hover:border-[#C7D2FE] hover:shadow-sm'
                    }`}
                >
                  {/* Best Value badge */}
                  {pack.bestValue && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] uppercase tracking-wide shadow-sm whitespace-nowrap">
                      Best Value
                    </span>
                  )}

                  {/* Selected checkmark */}
                  {isSelected && (
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#6366F1] flex items-center justify-center">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}

                  {/* Stack icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 ${isSelected
                      ? 'bg-gradient-to-br from-[#6366F11F] to-[#3B82F61A]  dark:bg-[#6366F1]/20'
                      : 'bg-gradient-to-br from-[#10B9811A] to-[#3B82F614]  dark:bg-[#171C22]'
                      }`}
                  >
                    {pack.bestValue ? (
                      <span
                        className={` text-xl ${isSelected ? 'text-[#6366F1]' : 'text-[#10B981]'}`}
                      >
                        {' '}
                        <svg
                          width="18"
                          height="19"
                          viewBox="0 0 18 19"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 9.5C2 9.67333 2.12 9.88 2.36 10.12C2.64 10.3867 3.03333 10.6467 3.54 10.9C4.23333 11.2467 5.05333 11.5167 6 11.71C6.94667 11.9033 7.94667 12 9 12C10.0533 12 11.0533 11.9033 12 11.71C12.9467 11.5167 13.7667 11.2467 14.46 10.9C14.9667 10.6467 15.36 10.3867 15.64 10.12C15.88 9.88 16 9.67333 16 9.5V7.32C15.16 7.84 14.14 8.24667 12.94 8.54C11.7 8.84667 10.3867 9 9 9C7.61333 9 6.3 8.84667 5.06 8.54C3.86 8.24667 2.84 7.84 2 7.32V9.5ZM16 12.32C15.16 12.84 14.14 13.2467 12.94 13.54C11.7 13.8467 10.3867 14 9 14C7.61333 14 6.3 13.8467 5.06 13.54C3.86 13.2467 2.84 12.84 2 12.32V14.5C2 14.6733 2.12 14.88 2.36 15.12C2.64 15.3867 3.03333 15.6467 3.54 15.9C4.23333 16.2467 5.05333 16.5167 6 16.71C6.94667 16.9033 7.94667 17 9 17C10.0533 17 11.0533 16.9033 12 16.71C12.9467 16.5167 13.7667 16.2467 14.46 15.9C14.9667 15.6467 15.36 15.3867 15.64 15.12C15.88 14.88 16 14.6733 16 14.5V12.32ZM0 14.5V4.5C0 3.68667 0.406667 2.92667 1.22 2.22C2.02 1.55333 3.1 1.02 4.46 0.620001C5.86 0.206667 7.37333 0 9 0C10.6267 0 12.14 0.206667 13.54 0.620001C14.9 1.02 15.98 1.55333 16.78 2.22C17.5933 2.92667 18 3.68667 18 4.5V14.5C18 15.3133 17.5933 16.0733 16.78 16.78C15.98 17.4467 14.9 17.98 13.54 18.38C12.14 18.7933 10.6267 19 9 19C7.37333 19 5.86 18.7933 4.46 18.38C3.1 17.98 2.02 17.4467 1.22 16.78C0.406667 16.0733 0 15.3133 0 14.5ZM9 7C10.0533 7 11.0533 6.90333 12 6.71C12.9467 6.51667 13.7667 6.24667 14.46 5.9C14.9667 5.64667 15.36 5.38667 15.64 5.12C15.88 4.88 16 4.67333 16 4.5C16 4.32667 15.88 4.12 15.64 3.88C15.36 3.61333 14.9667 3.35333 14.46 3.1C13.7667 2.75333 12.9467 2.48333 12 2.29C11.0533 2.09667 10.0533 2 9 2C7.94667 2 6.94667 2.09667 6 2.29C5.05333 2.48333 4.23333 2.75333 3.54 3.1C3.03333 3.35333 2.64 3.61333 2.36 3.88C2.12 4.12 2 4.32667 2 4.5C2 4.67333 2.12 4.88 2.36 5.12C2.64 5.38667 3.03333 5.64667 3.54 5.9C4.23333 6.24667 5.05333 6.51667 6 6.71C6.94667 6.90333 7.94667 7 9 7Z"
                            fill="#10B981"
                          />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className={`ri-stack-line text-xl ${isSelected ? 'text-[#6366F1]' : 'text-[#10B981]'
                          }`}
                      ></span>
                    )}
                  </div>

                  {/* Renders count */}
                  <span
                    className={`text-[32px] leading-tight font-bold font-satoshi ${isSelected ? 'text-[#6366F1]' : 'text-ink-900 dark:text-[#E7EAEE]'
                      }`}
                  >
                    {pack.renders}
                  </span>
                  <span className="text-label-sm text-ink-500 font-medium text-[#6B7280]">
                    Extra Renders
                  </span>

                  {/* Price */}
                  <div className="flex items-baseline gap-0.5 mt-2">
                    <div className=" relative text-[22px] font-bold text-ink-900 dark:text-[#E7EAEE] font-satoshi leading-tight">
                      <span className="absolute top-0 -left-2 text-label-xs text-ink-400">$</span>
                      {pack.price.toFixed(2)}
                    </div>
                  </div>

                  {/* Per render cost */}
                  <span className="text-label-xs font-semibold text-[#10B981] p-1 px-2 rounded-full bg-[#10B98114]">
                    ${pack.perRender.toFixed(2)} per render
                  </span>

                  {/* Auto-renew note */}
                  {/* <p className="text-[10px] text-ink-400  leading-tight text-center mt-2 p-2 bg-[#F9FAFBD9] dark:bg-[#171c227a] rounded-md border border-transparent dark:border-[#2A313A]">
                    Auto-renews monthly. Expires with subscription end date.
                  </p> */}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={() => {
              if (selectedPackId) {
                setShowPurchaseModal(true);
              }
            }}
            disabled={!selectedPackId}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-body-sm font-semibold whitespace-nowrap transition-all duration-200 dark:text-black dark:border dark:border-gray-900 w-full sm:w-auto ${selectedPackId
              ? 'text-white cursor-pointer bg-gradient-indigo shadow-glow-indigo'
              : 'text-ink-400 cursor-not-allowed bg-[#E5E7EB] dark:bg-gray-500'
              }`}
          >
            Continue to Payment
            <span className="ri-arrow-right-line text-ui"></span>
          </button>
          {!selectedPackId && (
            <span className="text-label-sm text-ink-400 text-center sm:text-left">Select a pack above to continue</span>
          )}
        </div>
      </div>

      {/* Purchase Summary Modal */}
      {showPurchaseModal &&
        selectedTopUpPack &&
        typeof document !== 'undefined' &&
        (() => {
          const currentPlanName = myPlan?.plan?.name || 'Pro Plan';
          return createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-45 backdrop-blur">
              <div className="w-[calc(100vw-2rem)] max-w-[440px] rounded-sheet-lg p-6 sm:p-8 max-h-[90vh] overflow-y-auto mx-4 sm:mx-8 md:mx-12 shadow-modal-deep bg-glass-100 border border-glass-bright">
                {/* Header */}
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-heading-xs font-bold text-ink-900 font-satoshi">
                    Purchase Summary
                  </h3>
                  <button
                    onClick={() => setShowPurchaseModal(false)}
                    disabled={isTopUpProcessing}
                    className="touch-target rounded-full hover:bg-black/5 transition-colors -mt-1 -mr-1"
                    aria-label="Close"
                  >
                    <span className="ri-close-line text-heading text-ink-500"></span>
                  </button>
                </div>
                <p className="text-label-md text-ink-400 mb-5">
                  Review your top-up pack before proceeding.
                </p>

                {/* Pack info card */}
                <div className="rounded-xl p-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gradient-to-r from-[#6366F10F] to-[#3B82F60A] dark:bg-surface-150 border border-[#6366F11F] dark:border-[#E5E7EB]/10">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#E0E0FF] dark:bg-[#6366F1]/20 shrink-0">
                      <span className="ri-stack-line text-xl text-[#6366F1]"></span>
                    </div>
                    <div className="flex-1 min-w-0 sm:hidden">
                      <p className="text-body-sm font-bold text-ink-900 dark:text-[#E7EAEE] font-satoshi truncate">
                        {selectedTopUpPack.renders} Extra Renders
                      </p>
                      <p className="text-label-sm text-ink-500 truncate">
                        Added to {currentPlanName}
                      </p>
                    </div>
                  </div>

                  {/* Desktop text details */}
                  <div className="hidden sm:block flex-1 min-w-0">
                    <p className="text-body-sm font-bold text-ink-900 dark:text-[#E7EAEE] font-satoshi">
                      {selectedTopUpPack.renders} Extra Renders
                    </p>
                    <p className="text-label-sm text-ink-500">
                      {selectedTopUpPack.renders} additional renders added to your {currentPlanName}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center w-full sm:w-auto border-t border-gray-100 dark:border-gray-800 sm:border-t-0 pt-3 sm:pt-0 shrink-0">
                    <div className="sm:hidden text-label-xs text-ink-500">
                      Price:
                    </div>
                    <div className="text-right">
                      <p className="text-heading-xs font-bold text-ink-900 dark:text-[#E7EAEE] font-satoshi">
                        ${selectedTopUpPack.price.toFixed(2)}
                      </p>
                      <p className="text-label-xs text-ink-400">USD / month</p>
                    </div>
                  </div>
                </div>

                {/* Order breakdown */}
                <div className="mb-5 p-5 rounded-lg bg-[#F9FAFBD9] dark:bg-[#1c2229] border border-[#E5E7EB8C] dark:border-[#2A313A]">
                  <p className="text-body-sm font-bold text-ink-900 dark:text-[#E7EAEE] font-satoshi mb-3">
                    Order Breakdown
                  </p>
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-label-md text-ink-500">Subtotal</span>
                      <span className="text-label-md font-semibold text-ink-700 dark:text-[#E7EAEE]">
                        ${selectedTopUpPack.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-label-md text-ink-500">Tax (estimated)</span>
                      <span className="text-label-md font-semibold text-ink-700 dark:text-[#E7EAEE]">
                        $0.00
                      </span>
                    </div>
                    {/* <div className="flex items-center justify-between">
                      <span className="text-label-md text-ink-500">Billing</span>
                      <span className="text-label-md font-semibold text-[#6366F1]">
                        Monthly · Auto-renew
                      </span>
                    </div> */}
                  </div>
                  <hr className="my-4 border-[#E5E7EB] dark:border-[#E5E7EB]/10" />
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm font-bold text-ink-900 dark:text-[#E7EAEE] font-satoshi">
                      Total Due Today
                    </span>
                    <span className="text-heading-xs font-bold text-ink-900 dark:text-[#E7EAEE] font-satoshi">
                      ${selectedTopUpPack.price.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Auto-renewal notice */}
                {/* <div className="rounded-xl p-3.5 mb-5 bg-[#F59E0B0F] dark:bg-[#78350F]/10 border border-[#F59E0B26] dark:border-[#F59E0B]/20">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 flex items-center justify-center ri-error-warning-line text-ui text-[#F59E0B] mt-0.5 shrink-0"></span>
                    <div>
                      <p className="text-label-sm font-bold text-[#92400E] dark:text-[#FDE68A]">
                        Auto-renewal notice
                      </p>
                      <p className="text-label-xs text-[#78350F] dark:text-[#FCD34D]/80 mt-0.5 leading-relaxed">
                        This pack renews automatically each month and expires when your{' '}
                        {currentPlanName} subscription ends. You can cancel anytime from Billing
                        settings.
                      </p>
                    </div>
                  </div>
                </div> */}

                {/* Proceed to Payment button */}
                <button
                  onClick={() => {
                    void handleTopUpCheckout();
                  }}
                  disabled={isTopUpProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-body-sm font-semibold text-white whitespace-nowrap dark:text-black transition-all duration-200 bg-gradient-indigo shadow-glow-indigo disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {isTopUpProcessing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="ri-lock-line text-ui"></span>
                  )}
                  {isTopUpProcessing ? 'Proceeding...' : 'Proceed to Payment'}
                </button>

                <p className="text-center text-label-xs text-ink-400 mt-3">
                  By proceeding you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>,
            document.body,
          );
        })()}

      {/* <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-warning">
            <span className="ri-arrow-up-circle-line text-ui-md text-warning w-4 h-4 flex items-center justify-center"></span>
          </div>
          <p className="text-body-md font-semibold text-ink-900 font-satoshi">Upgrade Your Plan</p>
        </div>

        <button
          onClick={openUpgrade}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-body-sm font-semibold text-white whitespace-nowrap cursor-pointer transition-all duration-200 bg-gradient-warning shadow-glow-warning"
        >
          <span className="w-4 h-4 flex items-center justify-center ri-mail-send-line text-ui"></span>
          Upgrade Plan
        </button>
        <p className="text-label-sm text-ink-400 mt-2">
          Plan upgrades are handled through our support team.
        </p>
      </div> */}

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-gray">
            <span className="ri-history-line text-ui-md text-ink-500 w-4 h-4 flex items-center justify-center"></span>
          </div>
          <div>
            <p className="text-body-md font-semibold text-ink-900 font-satoshi">Billing Activity</p>
            <p className="text-label-sm text-ink-400">
              A record of your subscription and plan-related updates.
            </p>
          </div>
        </div>

        {(paymentHistoryStatus === 'loading' || paymentHistoryStatus === 'idle') &&
          (!payments || payments.length === 0) ? (
          <div className="flex flex-col gap-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 py-3.5 border-b border-border-default last:border-0"
              >
                <Skeleton className="w-8 h-8 rounded-lg shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-1/2 mt-2" />
                  <Skeleton className="h-3.5 w-1/4 mt-1.5" />
                </div>
              </div>
            ))}
          </div>
        ) : !payments || payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-muted-bg-60">
              <span className="w-6 h-6 flex items-center justify-center ri-file-list-3-line text-heading text-ink-400"></span>
            </div>
            <div className="text-center">
              <p className="text-body-sm font-semibold text-ink-700">No billing activity yet</p>
              <p className="text-label-sm text-ink-400 mt-0.5">
                Your subscription updates and requests will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div ref={paymentsScrollRef} className="flex flex-col max-h-[460px] overflow-y-auto pr-2">
            {payments.map((item, idx) => {
              const styles = getStatusStyles(item.status);
              const planName = item.plan?.name ?? 'Subscription Plan';
              const formattedTime = formatPaymentDate(item.createdAt);
              const invoiceSuffix = item.invoiceId ? ` (Invoice: ${item.invoiceId})` : '';
              const amountStr = item.amount !== undefined ? `$${item.amount}` : 'N/A';
              const currencyStr = item.currency ?? '';

              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 py-3.5 ${idx !== payments.length - 1 ? 'border-b border-border-default' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${styles.iconBg}`}
                  >
                    <span
                      className={`w-4 h-4 flex items-center justify-center ${styles.icon} text-body-md ${styles.iconColor}`}
                    ></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-body-sm font-semibold text-ink-900 font-satoshi">
                        {planName} Payment
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-caption-xs font-semibold shrink-0 ${styles.color} ${styles.bg}`}
                      >
                        {styles.label}
                      </span>
                    </div>
                    <p className="text-label-sm text-ink-500 mt-0.5">
                      Amount:{' '}
                      <span className="font-semibold">
                        {amountStr} {currencyStr}
                      </span>{' '}
                      via {(item.paymentMethod || 'card').toUpperCase()}
                      {invoiceSuffix}
                    </p>
                    <p className="text-label-xs text-ink-400 mt-1">{formattedTime}</p>
                  </div>
                </div>
              );
            })}

            {paymentHistoryStatus === 'loading' && currentPage > 1 && (
              <div className="flex justify-center items-center py-4 border-t border-border-default">
                <span className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin"></span>
                <span className="text-label-sm text-ink-400 ml-2 font-inter">
                  Loading more activity...
                </span>
              </div>
            )}

            {paymentPagination && !paymentPagination.hasNext && payments.length > 0 && (
              <div className="flex justify-center items-center py-4 text-ink-300 text-label-xs font-inter uppercase tracking-widest select-none border-t border-border-default">
                All billing activity loaded
              </div>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border-default">
          <p className="text-label-sm text-ink-400 flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 flex items-center justify-center ri-question-line text-body-sm text-ink-400"></span>
            For billing-related queries, please contact support.
          </p>
        </div>
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-[#EBF3FE] dark:bg-[#171C22]">
            <span className="ri-file-text-line text-lg sm:text-xl text-[#2F68C5] w-5 h-5 flex items-center justify-center"></span>
          </div>
          <div>
            <p className="text-body-md font-semibold text-ink-900 font-satoshi">Past Invoices</p>
            <p className="text-label-sm text-ink-400 mt-0.5">
              View and download your past invoices.
            </p>
          </div>
        </div>

        {(invoicesStatus === 'loading' || invoicesStatus === 'idle') &&
          (!invoices || invoices.length === 0) ? (
          <div className="flex flex-col gap-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-4 border-t border-gray-100/70 last:border-0 dark:border-gray-800"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4 mt-2" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16 rounded-lg" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-muted-bg-60">
              <span className="w-6 h-6 flex items-center justify-center ri-file-text-line text-heading text-ink-400"></span>
            </div>
            <div className="text-center">
              <p className="text-body-sm font-semibold text-ink-700">No documents available</p>
              <p className="text-label-sm text-ink-400 mt-0.5">
                Your billing documents will appear here when shared by our team.
              </p>
            </div>
          </div>
        ) : (
          <div ref={invoicesScrollRef} className="flex flex-col max-h-[460px] overflow-y-auto pr-2">
            {invoices.map((invoice, idx) => {
              const docName = invoice.invoice_number
                ? `Invoice — ${invoice.invoice_number}`
                : invoice.payment_id
                  ? `Invoice — ${invoice.payment_id}`
                  : 'Invoice — N/A';
              const docDate = formatInvoiceDate(invoice.created_at);
              const docAmount = formatInvoiceAmount(invoice.amount, invoice.currency);
              const isDownloading = invoice.payment_id
                ? downloadingPaymentIds.includes(invoice.payment_id)
                : false;

              return (
                <div
                  key={invoice.id || idx}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between py-4 border-t border-gray-100/70 dark:border-gray-700/80 ${idx === 0 ? 'border-t-0' : ''} gap-3 sm:gap-4`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#FEF2F2] border border-red-50">
                      <span className="w-5 h-5 flex items-center justify-center ri-file-pdf-2-line text-lg text-[#EF4444]"></span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold text-ink-900 font-satoshi truncate">
                        {docName}
                      </p>
                      <p className="text-label-sm text-ink-400 mt-0.5">
                        {docDate} · {docAmount}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-3 pl-12 sm:pl-0 w-full sm:w-auto">
                    <button
                      disabled={isDownloading}
                      onClick={() => handleInvoiceAction(invoice.pdf_url)}
                      className={`flex-1 sm:flex-initial min-w-[64px] sm:min-w-[72px] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-body-sm font-semibold text-[#2F68C5] bg-[#EBF3FE] hover:bg-[#D5E6FD] dark:bg-[#171C22] transition-colors whitespace-nowrap ${isDownloading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      View
                    </button>
                    <button
                      disabled={isDownloading}
                      onClick={() => {
                        if (invoice.payment_id) {
                          dispatch(downloadInvoicePdf({ paymentId: invoice.payment_id }));
                        } else {
                          handleInvoiceAction(invoice.pdf_url);
                        }
                      }}
                      className={`flex-1 sm:flex-initial min-w-[80px] sm:min-w-[96px] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-body-sm font-semibold text-white transition-all shadow-[0_2px_8px_rgba(99,102,241,0.25)] whitespace-nowrap flex items-center justify-center gap-1.5 dark:text-black  dark:bg-[#2F68C5] ${isDownloading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}`}
                      style={{ background: 'linear-gradient(111.29deg, #6366F1 0%, #3B82F6 100%)' }}
                    >
                      {isDownloading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Downloading...
                        </>
                      ) : (
                        'Download'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {invoicesStatus === 'loading' && currentInvoicesPage > 1 && (
              <div className="flex justify-center items-center py-4 border-t border-border-default">
                <span className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin"></span>
                <span className="text-label-sm text-ink-400 ml-2 font-inter">
                  Loading more invoices...
                </span>
              </div>
            )}

            {invoicesPagination && !invoicesPagination.hasNext && invoices.length > 0 && (
              <div className="flex justify-center items-center py-4 text-ink-300 text-label-xs font-inter uppercase tracking-widest select-none border-t border-border-default">
                All invoices loaded
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-gray">
            <span className="ri-book-open-line text-ui-md text-ink-500 w-4 h-4 flex items-center justify-center"></span>
          </div>
          <p className="text-body-md font-semibold text-ink-900 font-satoshi">
            Plan Limits &amp; Behavior
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {PLAN_LIMITS.map((limit, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-4 h-4 flex items-center justify-center ri-checkbox-blank-circle-line text-2xs text-ink-400 mt-1 shrink-0"></span>
              <p className="text-label-md text-ink-700">{limit}</p>
            </div>
          ))}
        </div>
      </div>

      {showUpgradeModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay-45 backdrop-blur">
            <div className="w-full max-w-[1100px] rounded-[24px] p-6 sm:p-8 max-h-[90vh] overflow-y-auto mx-4 sm:mx-8 md:mx-12 shadow-2xl bg-white dark:bg-surface-100 border border-gray-100 dark:border-border-default">
              <>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white font-roboto">
                      {isPurchaseFlow
                        ? 'Purchase Your Plan'
                        : isDowngradeFlow
                          ? 'Change Your Plan'
                          : 'Upgrade Your Plan'}
                    </h3>
                    <p className="text-xs text-[#9CA3AF] mt-1">
                      Choose a plan that fits your design volume and team needs.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="Close"
                  >
                    <span className="ri-close-line text-2xl text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"></span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {((isDowngradeFlow ? cancelPlansState.status : subscriptionsStatus) === 'loading' ||
                    (isDowngradeFlow ? cancelPlansState.status : subscriptionsStatus) === 'idle') ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-[24px] p-6 flex flex-col bg-white border border-gray-200 dark:bg-surface-150 dark:border-border-default"
                      >
                        <Skeleton className="h-6 w-1/2 mb-4" />
                        <Skeleton className="h-8 w-2/3 mb-2" />
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-3/4 mb-4" />
                        <div className="flex-1 flex flex-col gap-2 mb-4">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                        <Skeleton className="h-10 w-full mt-auto" />
                      </div>
                    ))
                  ) : (isDowngradeFlow ? cancelPlansState.items : subscriptions) &&
                    (isDowngradeFlow ? cancelPlansState.items : subscriptions).length > 0 ? (
                    (isDowngradeFlow ? cancelPlansState.items : subscriptions).map((plan: any) => {
                      const isCurrent = plan.id === myPlan?.plan_id;
                      const price =
                        billingCycle === 'monthly'
                          ? plan.monthly_price !== null && plan.monthly_price !== undefined ? String(plan.monthly_price) : 'N/A'
                          : plan.yearly_price !== null && plan.yearly_price !== undefined ? String(plan.yearly_price) : 'N/A';
                      const isCustom =
                        plan.name?.toLowerCase() === 'custom' ||
                        (typeof plan.price === 'string' && plan.price.toLowerCase() === 'custom') ||
                        (typeof plan.monthly_price === 'string' && plan.monthly_price.toLowerCase() === 'custom');

                      const rendersText = isCustom
                        ? 'Custom'
                        : plan.monthly_renders === -1
                          ? 'Unlimited renders'
                          : `${plan.monthly_renders || 0} renders per month`;

                      const membersText = isCustom
                        ? 'Custom'
                        : plan.customer_shares === undefined || plan.customer_shares === null
                          ? 'N/A'
                          : plan.customer_shares === -1
                            ? 'Unlimited team members'
                            : plan.customer_shares === 1
                              ? '1 team member'
                              : plan.name?.toLowerCase() === 'business' || plan.customer_shares === 8
                                ? `Up to ${plan.customer_shares || 0} team members`
                                : `${plan.customer_shares || 0} team members`;

                      const features =
                        plan.feature_points && plan.feature_points.length > 0
                          ? plan.feature_points
                          : plan.name?.toLowerCase() === 'starter'
                            ? ['No branding on external pages']
                            : plan.name?.toLowerCase() === 'pro'
                              ? ['Logo + "Powered by CraftsmanAI" text']
                              : plan.name?.toLowerCase() === 'business'
                                ? ['Full custom branding. No "Powered by" text. Priority support.']
                                : plan.name?.toLowerCase() === 'custom'
                                  ? ['Tailored. Admin-assigned.']
                                  : ['No features listed'];

                      const isPlanLoading =
                        checkoutStatus === 'loading' && loadingPlanId === plan.id;

                      return (
                        <div
                          key={plan.id}
                          className={`relative rounded-[24px] p-6 flex flex-col transition-all duration-200 ${isCurrent
                            ? 'bg-[#f5f8ff] dark:bg-indigo-950/20 border-2 border-[#3b82f6] shadow-sm'
                            : 'bg-white dark:bg-surface-150 border border-gray-200 dark:border-border-default shadow-sm'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xl font-bold text-[#111827] dark:text-white">
                              {plan.name || 'Unnamed Plan'}
                            </p>
                            <div className="flex items-center gap-2">
                              {plan.is_most_popular && !isCurrent && (
                                <span className="px-3 py-1 rounded-full bg-[#3B82F6] text-white text-[11px] font-semibold font-satoshi leading-none whitespace-nowrap">
                                  Most Popular
                                </span>
                              )}
                              {isCurrent && (
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] text-[11px] font-semibold font-satoshi whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#137333]"></span>
                                  Active
                                </span>
                              )}
                            </div>
                          </div>

                          {isCustom ? (
                            <div className="mb-4">
                              <span className="text-3xl font-extrabold text-[#111827] dark:text-white font-satoshi leading-none">
                                contact sales
                              </span>
                            </div>
                          ) : (
                            <div className="mb-4 flex items-baseline gap-1">
                              <span className="text-3xl font-extrabold text-[#111827] dark:text-white font-satoshi">
                                ${price}
                              </span>
                              <span className="text-xs font-medium text-gray-400">/mo</span>
                            </div>
                          )}

                          <div className="space-y-2 mb-4 text-left">
                            <div className="flex items-start gap-2 text-[#4B5563] dark:text-[#A1A8B3]">
                              <svg
                                width="12"
                                height="11"
                                viewBox="0 0 12 11"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="fill-current text-[#2563EB] mt-1 flex-shrink-0"
                              >
                                <path
                                  d="M0.560625 10.5C0.40365 10.5 0.270969 10.4436 0.162581 10.3308C0.0541937 10.2181 0 10.08 0 9.91667V0.583333C0 0.42 0.0541937 0.281944 0.162581 0.169167C0.270969 0.0563889 0.40365 0 0.560625 0H10.6519C10.8089 0 10.9415 0.0563889 11.0499 0.169167C11.1583 0.281944 11.2125 0.42 11.2125 0.583333V9.91667C11.2125 10.08 11.1583 10.2181 11.0499 10.3308C10.9415 10.4436 10.8089 10.5 10.6519 10.5H0.560625ZM10.0912 7V1.16667H1.12125V9.33333L6.7275 3.5L10.0912 7ZM10.0912 8.645L6.7275 5.145L2.70221 9.33333H10.0912V8.645ZM3.36375 4.66667C3.16192 4.66667 2.97505 4.61417 2.80312 4.50917C2.6312 4.40417 2.49478 4.26222 2.39387 4.08333C2.29296 3.90444 2.2425 3.71 2.2425 3.5C2.2425 3.29 2.29296 3.09556 2.39387 2.91667C2.49478 2.73778 2.6312 2.59583 2.80312 2.49083C2.97505 2.38583 3.16192 2.33333 3.36375 2.33333C3.56557 2.33333 3.75245 2.38583 3.92437 2.49083C4.0963 2.59583 4.23272 2.73778 4.33363 2.91667C4.43454 3.09556 4.485 3.29 4.485 3.5C4.485 3.71 4.43454 3.90444 4.33363 4.08333C4.23272 4.26222 4.0963 4.40417 3.92437 4.50917C3.75245 4.61417 3.56557 4.66667 3.36375 4.66667ZM8.33102 9.70833C8.75087 9.70833 9.13962 9.60333 9.49727 9.39333C9.85492 9.18333 10.1387 8.89944 10.3486 8.54167C10.5586 8.18389 10.6635 7.795 10.6635 7.375C10.6635 6.955 10.5586 6.56611 10.3486 6.20833C10.1387 5.85056 9.85492 5.56667 9.49727 5.35667C9.13962 5.14667 8.75087 5.04167 8.33102 5.04167C7.91117 5.04167 7.52242 5.14667 7.16477 5.35667C6.80392 5.56667 6.52333 5.85056 6.3134 6.20833C6.10348 6.56611 5.99852 6.955 5.99852 7.375C5.99852 7.795 6.10348 8.18389 6.3134 8.54167C6.52333 8.89944 6.80392 9.18333 7.16477 9.39333C7.52242 9.60333 7.91117 9.70833 8.33102 9.70833Z"
                                />
                              </svg>
                              <span className="text-sm text-[#4B5563] dark:text-[#A1A8B3]">
                                {plan.monthly_renders === 'Custom' || typeof plan.monthly_renders === 'string'
                                  ? 'Custom renders per month'
                                  : getRendersText(plan.monthly_renders)}
                              </span>
                            </div>

                            <div className="flex items-start gap-2 text-[#4B5563] dark:text-[#A1A8B3]">
                              <svg
                                width="15"
                                height="20"
                                viewBox="0 0 15 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="fill-current text-[#2563EB] mt-1 flex-shrink-0"
                              >
                                <path
                                  d="M7.00762 4.16732C7.77007 4.16732 8.49888 4.30343 9.19405 4.57565C9.85933 4.8401 10.4517 5.21148 10.9712 5.68982C11.4907 6.16815 11.8925 6.71454 12.1766 7.32898C12.4681 7.97454 12.6139 8.64732 12.6139 9.34732C12.6139 9.93843 12.4718 10.4868 12.1878 10.9923C11.9112 11.4745 11.5375 11.8595 11.0665 12.1473C10.5881 12.4429 10.0649 12.5907 9.49679 12.5907H8.39797C8.13634 12.5907 7.91583 12.6859 7.73643 12.8765C7.55703 13.067 7.46733 13.2984 7.46733 13.5707C7.46733 13.8118 7.54582 14.0257 7.70279 14.2123C7.85977 14.399 7.93825 14.6168 7.93825 14.8657C7.93825 15.1301 7.84669 15.3576 7.66355 15.5482C7.48041 15.7387 7.26177 15.834 7.00762 15.834C6.24517 15.834 5.51635 15.6823 4.82118 15.379C4.1559 15.0834 3.56351 14.6654 3.044 14.1248C2.52449 13.5843 2.1227 12.9679 1.83865 12.2757C1.54713 11.5523 1.40137 10.794 1.40137 10.0007C1.40137 9.20732 1.54713 8.44898 1.83865 7.72565C2.1227 7.03343 2.52449 6.41704 3.044 5.87648C3.56351 5.33593 4.1559 4.91787 4.82118 4.62232C5.51635 4.31898 6.24517 4.16732 7.00762 4.16732ZM6.34608 13.5707C6.34608 13.1818 6.43765 12.824 6.62079 12.4973C6.80392 12.1707 7.05247 11.9101 7.36642 11.7157C7.68037 11.5212 8.02422 11.424 8.39797 11.424H9.49679C9.85559 11.424 10.1882 11.3307 10.4947 11.144C10.8012 10.9573 11.0441 10.7065 11.2235 10.3915C11.4029 10.0765 11.4926 9.72843 11.4926 9.34732C11.4926 8.63176 11.2908 7.96287 10.8871 7.34065C10.491 6.73398 9.9565 6.25176 9.28375 5.89398C8.58858 5.52065 7.83174 5.33398 7.01322 5.33398C6.19471 5.33398 5.43787 5.54787 4.74269 5.97565C4.06994 6.38787 3.53548 6.94398 3.1393 7.64398C2.72818 8.36732 2.52262 10.0007 2.52262 10.0007C2.52262 10.8018 2.70575 11.5523 3.07203 12.2523C3.43083 12.929 3.92044 13.4773 4.54087 13.8973C5.17624 14.3329 5.87142 14.5857 6.62639 14.6557C6.43952 14.3134 6.34608 13.9518 6.34608 13.5707ZM4.4848 10.0007C4.25308 10.0007 4.05499 9.9151 3.89054 9.74398C3.72609 9.57287 3.64387 9.36676 3.64387 9.12565C3.64387 8.88454 3.72609 8.67843 3.89054 8.50732C4.05499 8.33621 4.25308 8.25065 4.4848 8.25065C4.71653 8.25065 4.91462 8.33621 5.07907 8.50732C5.24352 8.67843 5.32574 8.88454 5.32574 9.12565C5.32574 9.36676 5.24352 9.57287 5.07907 9.74398C4.91462 9.9151 4.71653 10.0007 4.4848 10.0007ZM9.53043 10.0007C9.2987 10.0007 9.10062 9.9151 8.93617 9.74398C8.77172 9.57287 8.68949 9.36676 8.68949 9.12565C8.68949 8.88454 8.77172 8.67843 8.93617 8.50732C9.10062 8.33621 9.2987 8.25065 9.53043 8.25065C9.76215 8.25065 9.96024 8.33621 10.1247 8.50732C10.2891 8.67843 10.3714 8.88454 10.3714 9.12565C10.3714 9.36676 10.2891 9.57287 10.1247 9.74398C9.96024 9.9151 9.76215 10.0007 9.53043 10.0007ZM7.00762 8.25065C6.77589 8.25065 6.5778 8.1651 6.41335 7.99398C6.2489 7.82287 6.16668 7.61676 6.16668 7.37565C6.16668 7.13454 6.2489 6.92843 6.41335 6.75732C6.5778 6.58621 6.77589 6.50065 7.00762 6.50065C7.23934 6.50065 7.43743 6.58621 7.60188 6.75732C7.76633 6.92843 7.84855 7.13454 7.84855 7.37565C7.84855 7.61676 7.76633 7.82287 7.60188 7.99398C7.43743 8.1651 7.23934 8.25065 7.00762 8.25065Z"
                                />
                              </svg>
                              <span className="text-sm text-[#4B5563] dark:text-[#A1A8B3]">{getBrandingText(plan)}</span>
                            </div>
                          </div>

                          <div className="border-t border-gray-100 dark:border-[#E5E7EB]/10 my-3"></div>

                          <ul className="space-y-2.5 flex-grow text-left">
                            {plan.feature_points?.map((feature: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M6.81167 11.8551L11.9694 6.48839L12.7543 7.31672L6.81167 13.5117L3.24609 9.79005L4.03097 8.97339L6.81167 11.8551Z" fill="#2563EB" />
                                </svg>

                                <span className="text-xs text-[#4B5563] dark:text-[#A1A8B3] text-gray-750 dark:text-gray-300 font-normal leading-normal whitespace-normal">
                                  {feature}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <button
                            type="button"
                            disabled={isCurrent || checkoutStatus === 'loading'}
                            onClick={() => {
                              if (isCustom) {
                                setShowUpgradeModal(false);
                                setShowContactSalesModal(true);
                                return;
                              }
                              const hasActivePlan = Boolean(
                                myPlan && myPlan.status?.toLowerCase() === 'active',
                              );
                              if (hasActivePlan) {
                                setConfirmUpgradePlan({
                                  planId: plan.id,
                                  planName: plan.name || 'Plan',
                                });
                              } else {
                                handlePlanClick(plan.id, plan.name || 'Plan');
                              }
                            }}
                            className={`w-full py-3 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all mt-5 duration-200 ${isCurrent
                              ? 'bg-[#e5e7eb] text-[#9ca3af] dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed border border-[#d1d5db] dark:border-gray-600'
                              : isPlanLoading
                                ? 'bg-gray-200 text-gray-400 cursor-wait animate-pulse'
                                : checkoutStatus === 'loading'
                                  ? 'opacity-50 cursor-not-allowed bg-[#1E1E1E] text-white dark:[background:linear-gradient(96.37deg,#6366F1_0%,#3B82F6_100%)] dark:[box-shadow:0px_4px_14px_0px_#6366F147] dark:text-black shadow-none'
                                  : 'bg-[#1E1E1E] text-white hover:opacity-90 dark:[background:linear-gradient(96.37deg,#6366F1_0%,#3B82F6_100%)] dark:[box-shadow:0px_4px_14px_0px_#6366F147] dark:text-black shadow-sm'
                              }`}
                          >
                            {isCurrent
                              ? 'Upgrade'
                              : isPlanLoading
                                ? 'Redirecting...'
                                : isCustom
                                  ? 'Contact Sales'
                                  : isPurchaseFlow
                                    ? 'Purchase Plan'
                                    : isDowngradeFlow
                                      ? 'Downgrade'
                                      : 'Upgrade'}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center py-8">
                      <p className="text-body-sm text-ink-500">
                        No subscription plans available at the moment.
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-label-sm text-ink-400">
                    All plan changes are handled by the Craftsman team. You will be contacted to
                    complete the upgrade.
                  </p>
                </div>
              </>
            </div>
          </div>,
          document.body,
        )}

      {showContactSalesModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-45 backdrop-blur">
            <div className="w-[calc(100vw-2rem)] max-w-[420px] rounded-[28px] p-6 sm:p-8 shadow-modal-deep bg-white dark:bg-[#171C22] border border-gray-100 dark:border-white/5 animate-fade-in relative mx-4 sm:mx-8 md:mx-12">

              {/* Close Button */}
              <button
                onClick={() => setShowContactSalesModal(false)}
                className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <span className="ri-close-line text-2xl text-gray-400 hover:text-gray-650 dark:text-gray-300 dark:hover:text-white"></span>
              </button>

              {/* Title & Subtitle */}
              <div className="mb-6 pr-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white font-satoshi">
                  Purchase Render Pack
                </h3>
                <p className="text-body-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed font-inter">
                  Reach out to our team to activate a render top-up.
                </p>
              </div>

              {/* Info Box */}
              <div className="rounded-[20px] p-5 border border-gray-100 dark:border-[#2A313A] bg-[#F9FAFB]/50 dark:bg-surface-150 space-y-5 mb-6">

                {/* Email Option */}
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center  shrink-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.2401 2H13.7601C13.9393 2 14.0908 2.06444 14.2145 2.19333C14.3382 2.32222 14.4001 2.48 14.4001 2.66667V13.3333C14.4001 13.52 14.3382 13.6778 14.2145 13.8067C14.0908 13.9356 13.9393 14 13.7601 14H2.2401C2.0609 14 1.90943 13.9356 1.7857 13.8067C1.66196 13.6778 1.6001 13.52 1.6001 13.3333V2.66667C1.6001 2.48 1.66196 2.32222 1.7857 2.19333C1.90943 2.06444 2.0609 2 2.2401 2ZM13.1201 4.82667L8.0513 9.56L2.8801 4.81333V12.6667H13.1201V4.82667ZM3.2129 3.33333L8.0385 7.77333L12.8001 3.33333H3.2129Z" fill="#6366F1" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-label-xs font-semibold text-[#9CA3AF] dark:text-ink-500 uppercase tracking-wide">
                      Email
                    </p>
                    <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E7EAEE] mt-0.5 select-all font-inter">
                      info@craftsmanai.app
                    </p>
                  </div>
                </div>

                {/* Support Option */}
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center  shrink-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g clipPath="url(#clip0_3719_23894)">
                        <path d="M13.0816 5.33398H13.76C13.9904 5.33398 14.2037 5.39398 14.4 5.51398C14.5962 5.63398 14.752 5.79621 14.8672 6.00065C14.9824 6.2051 15.04 6.42732 15.04 6.66732V9.33398C15.04 9.57398 14.9824 9.79621 14.8672 10.0007C14.752 10.2051 14.5962 10.3673 14.4 10.4873C14.2037 10.6073 13.9904 10.6673 13.76 10.6673H13.0816C12.9792 11.5384 12.689 12.3295 12.2112 13.0407C11.7333 13.7518 11.1317 14.3073 10.4064 14.7073C9.65543 15.1251 8.85329 15.334 7.99996 15.334V14.0007C8.69116 14.0007 9.33543 13.8184 9.93276 13.454C10.513 13.0984 10.9738 12.6184 11.3152 12.014C11.665 11.3918 11.84 10.7207 11.84 10.0007V6.00065C11.84 5.28065 11.665 4.60954 11.3152 3.98732C10.9738 3.38287 10.513 2.90287 9.93276 2.54732C9.33543 2.18287 8.69116 2.00065 7.99996 2.00065C7.30876 2.00065 6.66449 2.18287 6.06716 2.54732C5.48689 2.90287 5.02609 3.38287 4.68476 3.98732C4.33489 4.60954 4.15996 5.28065 4.15996 6.00065V10.6673H2.23996C2.00956 10.6673 1.79623 10.6073 1.59996 10.4873C1.40369 10.3673 1.24796 10.2051 1.13276 10.0007C1.01756 9.79621 0.959961 9.57398 0.959961 9.33398V6.66732C0.959961 6.42732 1.01756 6.2051 1.13276 6.00065C1.24796 5.79621 1.40369 5.63398 1.59996 5.51398C1.79623 5.39398 2.00956 5.33398 2.23996 5.33398H2.91836C3.02076 4.46287 3.31089 3.67176 3.78876 2.96065C4.26663 2.24954 4.86823 1.69398 5.59356 1.29398C6.34449 0.876206 7.14663 0.667317 7.99996 0.667317C8.85329 0.667317 9.65543 0.876206 10.4064 1.29398C11.1317 1.69398 11.7333 2.24954 12.2112 2.96065C12.689 3.67176 12.9792 4.46287 13.0816 5.33398ZM2.23996 6.66732V9.33333L2.87996 9.33333V6.66732H2.23996ZM13.12 6.66732V9.33333H13.76V6.66732H13.12ZM5.28636 10.5207L5.96476 9.38732C6.58769 9.79621 7.26609 10.0007 7.99996 10.0007C8.73383 10.0007 9.41223 9.79621 10.0352 9.38732L10.7136 10.5207C10.3125 10.7873 9.88156 10.9895 9.42076 11.1273C8.95996 11.2651 8.48636 11.334 7.99996 11.334C7.51356 11.334 7.03996 11.2651 6.57916 11.1273C6.11836 10.9895 5.68743 10.7873 5.28636 10.5207Z" fill="#6366F1" />
                      </g>
                      <defs>
                        <clipPath id="clip0_3719_23894">
                          <rect width="16" height="16" fill="white" />
                        </clipPath>
                      </defs>
                    </svg>
                  </div>
                  <div>
                    <p className="text-label-xs font-semibold text-[#9CA3AF] dark:text-ink-500 uppercase tracking-wide">
                      Support
                    </p>
                    <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E7EAEE] mt-0.5 select-all font-inter">
                      support@craftsmanai.app
                    </p>
                  </div>
                </div>

                {/* Response Time Option */}
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center  shrink-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.0001 14.666C7.1297 14.666 6.2977 14.4927 5.5041 14.146C4.74463 13.8082 4.06836 13.3305 3.4753 12.7127C2.88223 12.0949 2.42356 11.3905 2.0993 10.5993C1.7665 9.77268 1.6001 8.90602 1.6001 7.99935C1.6001 7.09268 1.7665 6.22602 2.0993 5.39935C2.42356 4.60824 2.88223 3.90379 3.4753 3.28602C4.06836 2.66824 4.74463 2.19046 5.5041 1.85268C6.2977 1.50602 7.1297 1.33268 8.0001 1.33268C8.8705 1.33268 9.7025 1.50602 10.4961 1.85268C11.2556 2.19046 11.9318 2.66824 12.5249 3.28602C13.118 3.90379 13.5766 4.60824 13.9009 5.39935C14.2337 6.22602 14.4001 7.09268 14.4001 7.99935C14.4001 8.90602 14.2337 9.77268 13.9009 10.5993C13.5766 11.3905 13.118 12.0949 12.5249 12.7127C11.9318 13.3305 11.2556 13.8082 10.4961 14.146C9.7025 14.4927 8.8705 14.666 8.0001 14.666ZM8.0001 13.3327C8.93023 13.3327 9.7921 13.0882 10.5857 12.5993C11.3537 12.1282 11.9638 11.4927 12.4161 10.6927C12.8854 9.86602 13.1201 8.96824 13.1201 7.99935C13.1201 7.03046 12.8854 6.13268 12.4161 5.30602C11.9638 4.50602 11.3537 3.87046 10.5857 3.39935C9.7921 2.91046 8.93023 2.66602 8.0001 2.66602C7.06996 2.66602 6.2081 2.91046 5.4145 3.39935C4.6465 3.87046 4.03636 4.50602 3.5841 5.30602C3.11476 6.13268 2.8801 7.03046 2.8801 7.99935C2.8801 8.96824 3.11476 9.86602 3.5841 10.6927C4.03636 11.4927 4.6465 12.1282 5.4145 12.5993C6.2081 13.0882 7.06996 13.3327 8.0001 13.3327ZM8.6401 7.99935H11.2001V9.33268H7.3601V4.66602H8.6401V7.99935Z" fill="#6366F1" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-label-xs font-semibold text-[#9CA3AF] dark:text-ink-500 uppercase tracking-wide">
                      Response Time
                    </p>
                    <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E7EAEE] mt-0.5 font-inter">
                      Within 1 business day
                    </p>
                  </div>
                </div>

              </div>

              {/* Got It button */}
              <button
                type="button"
                onClick={() => setShowContactSalesModal(false)}
                className="w-full py-3 rounded-2xl text-[13px] font-semibold text-white dark:text-black transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer text-center"
                style={{
                  background: 'linear-gradient(96.37deg, #6366F1 0%, #3B82F6 100%)',
                  boxShadow: '0px 4px 14px 0px rgba(99, 102, 241, 0.28)',
                }}
              >
                Got It
              </button>

            </div>
          </div>,
          document.body,
        )}

      {showDocsModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-45 backdrop-blur">
            <div className="w-[calc(100vw-2rem)] max-w-[420px] rounded-sheet-lg p-5 sm:p-8 max-h-[90vh] overflow-y-auto mx-4 sm:mx-8 md:mx-12 shadow-modal-deep bg-glass-100 border border-glass-bright">
              {!docsSubmitted ? (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-heading-xs font-bold text-ink-900 font-satoshi">
                        Request Billing Document
                      </h3>
                      <p className="text-label-md text-ink-400 mt-0.5">
                        Our team will share your invoice shortly.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDocsModal(false)}
                      className="touch-target rounded-full hover:bg-black/5 transition-colors"
                      aria-label="Close"
                    >
                      <span className="ri-close-line text-heading text-ink-500"></span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-4 mb-6">
                    <div>
                      <label className="text-label font-semibold text-ink-700 mb-1.5 block">
                        Email
                      </label>
                      <input
                        aria-label="Email"
                        type="email"
                        value={docsForm.email}
                        onChange={(e) => setDocsForm({ ...docsForm, email: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-body-sm text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 bg-section border border-sand-soft"
                      />
                    </div>
                    <div>
                      <label className="text-label font-semibold text-ink-700 mb-1.5 block">
                        Message <span className="text-ink-400 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        value={docsForm.message}
                        onChange={(e) => setDocsForm({ ...docsForm, message: e.target.value })}
                        placeholder="Let us know which invoice or document you need"
                        maxLength={500}
                        rows={4}
                        className="w-full rounded-xl px-4 py-2.5 text-body-sm text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 resize-none placeholder:text-ink-400 bg-section border border-sand-soft"
                      />
                      <p className="text-label-xs text-ink-400 mt-1 text-right">
                        {docsForm.message.length}/500
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowDocsModal(false)}
                      className="flex-1 py-2.5 rounded-xl text-body-sm font-semibold text-ink-700 whitespace-nowrap cursor-pointer transition-all duration-200 bg-muted-bg-60 border border-sand-strong"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDocsSubmit}
                      className="flex-1 py-2.5 rounded-xl text-body-sm font-semibold text-white dark:text-black whitespace-nowrap cursor-pointer transition-all duration-200 bg-gradient-indigo shadow-glow-indigo"
                    >
                      Submit Request
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center bg-tint-emerald">
                    <span className="w-7 h-7 flex items-center justify-center ri-checkbox-circle-line text-display-sm text-success-medium"></span>
                  </div>
                  <div className="text-center">
                    <p className="text-ui-md font-semibold text-ink-900 font-satoshi">
                      Request Submitted
                    </p>
                    <p className="text-body-sm text-ink-500 mt-1 max-w-[340px]">
                      Your request has been submitted. Our team will contact you shortly.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDocsModal(false)}
                    className="px-6 sm:px-8 min-h-touch rounded-xl text-body-sm font-semibold text-white whitespace-nowrap transition-all duration-200 bg-gradient-indigo shadow-glow-indigo"
                  >
                    Got It
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {confirmUpgradePlan &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay-45 backdrop-blur">
            <div className="w-[calc(100vw-2rem)] max-w-[420px] rounded-sheet-lg p-5 sm:p-8 mx-4 sm:mx-8 md:mx-12 shadow-modal-deep bg-glass-100 border border-glass-bright animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-heading-xs font-bold text-[#111827] dark:text-ink font-satoshi">
                    Confirm Plan Change
                  </h3>
                  <p className="text-label-md text-[#6B7280] dark:text-[#A1A8B3] mt-0.5">
                    Please review the details of your plan change.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmUpgradePlan(null)}
                  className="touch-target rounded-full hover:bg-black/5 transition-colors"
                  aria-label="Close"
                >
                  <span className="ri-close-line text-heading text-[#9CA3AF] dark:text-[#D1D5DB]"></span>
                </button>
              </div>

              <div className="rounded-xl p-4 mb-5 flex flex-col gap-3 bg-[#F9FAFB] dark:bg-surface-150 border border-sand">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 flex items-center justify-center ri-error-warning-line text-ui text-warning mt-0.5 shrink-0"></span>
                  <div>
                    <p className="text-body-sm font-semibold text-[#1F2937] dark:text-ink leading-relaxed">
                      {isDowngradeFlow ? 'Downgrading' : 'Upgrading'} to the{' '}
                      <span className="font-bold text-indigo-accent">
                        {confirmUpgradePlan.planName}
                      </span>{' '}
                      plan will automatically deactivate your current plan.
                    </p>
                    <p className="text-label-sm text-[#4B5563] dark:text-[#A1A8B3] mt-1">
                      Your billing cycle will be adjusted, and the new plan features will be active
                      immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConfirmUpgradePlan(null)}
                  className="flex-1 py-2.5 rounded-xl text-body-sm font-semibold text-ink-700 whitespace-nowrap cursor-pointer transition-all duration-200 bg-muted-bg-60 border border-sand-strong"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const target = confirmUpgradePlan;
                    setConfirmUpgradePlan(null);
                    handlePlanClick(target.planId, target.planName);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-body-sm font-semibold text-white dark:text-black whitespace-nowrap cursor-pointer transition-all duration-200 bg-gradient-indigo shadow-glow-indigo"
                >
                  {isDowngradeFlow ? 'Confirm & Downgrade' : 'Confirm & Upgrade'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      <SubscriptionCancellationFlow
        isOpen={showManagePlanModal}
        onClose={() => setShowManagePlanModal(false)}
        onOpenUpgradePlan={openUpgrade}
        userEmail={profileItem?.email || ''}
      />
    </div>
  );
}
