'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { verifyPayment, resetVerifyPayment } from '@/redux/slices/retailer/billing/verifyPaymentSlice';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/Toast';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { show: showToast } = useToast();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { status, data, error } = useAppSelector((state) => state.retailerVerifyPayment);

  useEffect(() => {
    if (!sessionId) {
      showToast('Missing payment session id.');
      return;
    }

    dispatch(verifyPayment(sessionId))
      .unwrap()
      .then((res) => {
        showToast(res.message || 'Top-up pack successfully activated!');
        redirectTimerRef.current = setTimeout(() => {
          router.push('/retailer/settings#usage-plan');
        }, 1800);
      })
      .catch((err) => {
        showToast(err || 'Failed to verify payment.');
      });

    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      dispatch(resetVerifyPayment());
    };
  }, [sessionId, dispatch, router, showToast]);

  const handleReturn = () => {
    router.push('/retailer/settings#usage-plan');
  };

  // Gracefully handle values from the exact flat backend response format
  const planName = data?.plan_name ?? 'N/A';
  const amount = data?.amount !== undefined ? `$${data.amount}` : 'N/A';
  const paymentMethod = data?.payment_method ?? 'N/A';
  const transactionId = data?.transaction_id ?? 'N/A';
  const displayMessage =
    data?.message ?? 'Thank you for your purchase. Your top-up pack has been successfully activated.';

  const cardCN = 'bg-glass-80 backdrop-blur-xl shadow-card-deeper border border-glass-vivid';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-indigo-veil px-4 sm:px-6">
      <div className={`w-full max-w-[520px] rounded-sheet-lg p-6 sm:p-8 ${cardCN} text-center flex flex-col items-center gap-6`}>
        {status === 'loading' || status === 'idle' ? (
          <div className="w-full flex flex-col items-center gap-4 animate-pulse">
            <Skeleton className="w-16 h-16 rounded-full" />
            <Skeleton className="h-7 w-2/3 mt-2" />
            <Skeleton className="h-4 w-3/4" />
            <div className="w-full rounded-2xl p-5 bg-section border border-sand flex flex-col gap-3 mt-4">
              <div className="flex justify-between"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/3" /></div>
              <div className="flex justify-between"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/3" /></div>
              <div className="flex justify-between"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/3" /></div>
            </div>
            <Skeleton className="h-11 w-full rounded-xl mt-4" />
          </div>
        ) : status === 'failed' ? (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-tint-danger-soft animate-bounce">
              <span className="w-8 h-8 flex items-center justify-center ri-close-circle-line text-display-sm text-danger"></span>
            </div>
            <div>
              <h1 className="text-heading font-bold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Verification Failed</h1>
              <p className="text-body-sm text-ink-400 mt-2">{error || 'We could not verify your payment session.'}</p>
            </div>
            <button
              onClick={handleReturn}
              className="w-full py-3 rounded-xl text-body-sm font-semibold text-white whitespace-nowrap transition-all duration-200 bg-gradient-indigo shadow-glow-indigo"
            >
              Return to Settings
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-tint-emerald animate-bounce shadow-glow-brand-spot">
              <span className="w-8 h-8 flex items-center justify-center ri-checkbox-circle-line text-display-sm text-success-medium"></span>
            </div>
            <div>
              <h1 className="text-heading-lg font-bold text-ink-900 font-satoshi">
                Payment Successful!
              </h1>
              <p className="text-body-sm text-ink-400 mt-2">
                {displayMessage}
              </p>
            </div>

            <div className="w-full rounded-2xl p-5 bg-section border border-sand flex flex-col gap-3.5 text-left">
              <div className="flex items-center justify-between border-b border-sand pb-2">
                <span className="text-label text-ink-400 uppercase tracking-wide font-medium">Selected Plan</span>
                <span className="text-body font-bold text-indigo-accent">{planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-label text-ink-400">Amount Paid</span>
                <span className="text-body font-bold text-ink-900">{amount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-label text-ink-400">Payment Method</span>
                <span className="text-body font-semibold text-ink-700 uppercase">{paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-sand">
                <span className="text-label-xs text-ink-400">Transaction ID</span>
                <span className="text-caption text-ink-400 truncate max-w-[200px]" title={transactionId}>
                  {transactionId}
                </span>
              </div>
            </div>

            <button
              onClick={handleReturn}
              className="w-full py-3 rounded-xl text-body-sm font-semibold text-white whitespace-nowrap transition-all duration-200 bg-gradient-indigo shadow-glow-indigo"
            >
              Return to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-indigo-veil px-4">
        <div className="w-full max-w-[520px] rounded-sheet-lg p-6 sm:p-8 bg-glass-80 border border-glass-vivid text-center flex flex-col items-center gap-6 animate-pulse">
          <Skeleton className="w-16 h-16 rounded-full" />
          <Skeleton className="h-7 w-2/3 mt-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
