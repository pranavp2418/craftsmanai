'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function RealtimeNotificationManager() {
  const router = useRouter();
  const pathname = usePathname();
  const [creditsMsg, setCreditsMsg] = useState<string | null>(null);
  const [expiredPlan, setExpiredPlan] = useState<{ planName: string | null; message?: string } | null>(null);

  const isIncludedPath = (path: string | null) => {
    if (!path) return false;
    const cleanPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
    return (
      cleanPath === '/retailer' ||
      cleanPath.startsWith('/retailer/requests')
    );
  };

  // Automatically clear modal message when user is NOT on an included route
  useEffect(() => {
    if (!isIncludedPath(pathname)) {
      setCreditsMsg(null);
      setExpiredPlan(null);
    }
  }, [pathname]);

  // Listen for custom window event (triggered by user-profile response interceptor)
  useEffect(() => {
    const handleCreditsExhausted = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      console.log('[RealtimeNotificationManager] Custom event app:credits_exhausted received:', customEvent.detail);
      setCreditsMsg(customEvent.detail?.message || "You've run out of credits. Upgrade or add a top-up pack to keep designing.");
    };

    const handlePlanExpired = (e: Event) => {
      const customEvent = e as CustomEvent<{ planName: string | null; message?: string }>;
      console.log('[RealtimeNotificationManager] Custom event app:plan_expired received:', customEvent.detail);
      setExpiredPlan({
        planName: customEvent.detail?.planName || null,
        message: customEvent.detail?.message
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('app:credits_exhausted', handleCreditsExhausted);
      window.addEventListener('app:plan_expired', handlePlanExpired);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('app:credits_exhausted', handleCreditsExhausted);
        window.removeEventListener('app:plan_expired', handlePlanExpired);
      }
    };
  }, []);

  return (
    <>
      {/* Credits Exhausted Modal */}
      {creditsMsg && isIncludedPath(pathname) && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-surface-100 rounded-[28px] p-6 sm:p-8 w-[calc(100vw-2rem)] max-w-[520px] shadow-xl border border-[#E5E7EB] dark:border-border-default flex flex-col items-center text-center animate-modal-enter relative">

            <button
              onClick={() => setCreditsMsg(null)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 border-none bg-transparent outline-none"
              aria-label="Close"
            >
              <i className="ri-close-line text-[20px]" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] dark:bg-red-950/40 flex items-center justify-center mb-5 mt-2">
              <i className="ri-flashlight-fill text-[26px] text-[#EF4444]" />
            </div>

            <h3 className="text-[24px] font-medium text-[#111827] dark:text-white mb-2 font-inter leading-tight">
              You've Run Out of Credits
            </h3>

            <p className="text-[14px] font-normal text-[#6B7280] dark:text-zinc-400 mb-6 font-inter leading-relaxed">
              Upgrade or add a top-up pack to keep designing.
            </p>

            <div className="w-full bg-[#F0F4FF] dark:bg-[#3B82F6]/[0.08] border border-[#D1E2FF] dark:border-[#3B82F6]/20 rounded-2xl p-4 flex gap-3 text-left items-start mb-6">
              <i className="ri-lightbulb-line text-[18px] text-[#2563EB] dark:text-[#60A5FA] mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-bold text-[#1E3A8A] dark:text-blue-200 font-satoshi">
                  Need more renders?
                </p>
                <p className="text-[12px] font-normal text-[#1D4ED8] dark:text-blue-300 leading-relaxed font-inter mt-1">
                  Upgrade to a higher plan for more monthly renders, or add a top-up render pack to your current subscription.
                </p>
              </div>
            </div>

            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  setCreditsMsg(null);
                  router.push('/retailer/settings#usage-plan');
                }}
                className="w-full py-3 rounded-xl text-[13px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#60A5FA] dark:text-black dark:hover:bg-[#60A5FA]/90 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer border-none outline-none"
              >
                <i className="ri-arrow-up-circle-line text-[15px]" />
                <span>Upgrade Plan</span>
              </button>

              <button
                onClick={() => {
                  setCreditsMsg(null);
                  router.push('/retailer/settings#usage-plan');
                }}
                className="w-full py-3 rounded-xl text-[13px] font-semibold text-gray-700 dark:text-zinc-300 bg-white dark:bg-surface-150 border border-gray-200 dark:border-border-default hover:bg-gray-50 dark:hover:bg-surface-200 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer outline-none"
              >
                <i className="ri-add-circle-line text-[15px]" />
                <span>Buy Top-Up Render Pack</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Plan Expired Modal */}
      {expiredPlan && isIncludedPath(pathname) && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-surface-100 rounded-[28px] p-6 sm:p-8 w-[calc(100vw-2rem)] max-w-[520px] shadow-xl border border-[#E5E7EB] dark:border-border-default flex flex-col items-center text-center animate-modal-enter relative">

            <button
              onClick={() => setExpiredPlan(null)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 border-none bg-transparent outline-none"
              aria-label="Close"
            >
              <i className="ri-close-line text-[20px]" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-[#FFF7ED] dark:bg-orange-950/40 flex items-center justify-center mb-5 mt-2">
              <i className="ri-hourglass-2-line text-[26px] text-[#F97316]" />
            </div>

            <h3 className="text-[24px] font-semibold text-[#111827] dark:text-white mb-2 font-inter leading-tight">
              {expiredPlan.planName ? `Your ${expiredPlan.planName} Has Ended` : 'Purchase Plan'}
            </h3>

            <p className="text-[14px] font-normal text-[#6B7280] dark:text-zinc-400 mb-6 font-inter leading-relaxed">
              Upgrade to a paid plan to keep creating stunning jewelery designs.
            </p>

            <div className="w-full bg-[#EFF6FF] dark:bg-[#3B82F6]/[0.08] border border-[#DBEAFE] dark:border-[#3B82F6]/20 rounded-2xl p-5 flex flex-col gap-3 text-left items-start mb-6">
              <div className="flex gap-2.5 items-start">
                <i className="ri-lightbulb-line text-[18px] text-[#2563EB] dark:text-[#60A5FA] mt-0.5 shrink-0" />
                <p className="text-[15px] font-semibold text-[#1E3A8A] dark:text-blue-200 font-inter leading-snug">
                  Unlock full access to CraftsmanAI and continue<br className="hidden sm:inline" /> your custom jewellery workflow with:
                </p>
              </div>
              <ul className="space-y-2 mt-2 ml-7">
                {[
                  'Unlimited access to your saved requests',
                  'AI-powered jewelery rendering',
                  'Customer approval workflow',
                  'Manufacturer-ready detail sharing',
                  'Faster design-to-deposit process',
                  'Download high-resolution renders'
                ].map((feature, idx) => (
                  <li key={idx} className="flex gap-2 items-center text-[14px] text-[#6B7280] dark:text-zinc-400 font-normal font-inter">
                    <i className="ri-check-line text-[14px] text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  setExpiredPlan(null);
                  router.push('/retailer/settings#usage-plan');
                }}
                className="w-full py-3 rounded-xl text-[13px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#60A5FA] dark:text-black dark:hover:bg-[#60A5FA]/90 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer border-none outline-none"
              >
                <i className="ri-shopping-cart-2-line text-[15px]" />
                <span>Purchase Plan</span>
              </button>

              <button
                onClick={() => setExpiredPlan(null)}
                className="w-full py-3 rounded-xl text-[12.5px] font-semibold text-gray-500 dark:text-[#60A5FA] hover:text-gray-700 dark:hover:bg-[#60A5FA]/10 transition-colors cursor-pointer border border-transparent dark:border-[#60A5FA] bg-transparent outline-none flex items-center justify-center"
              >
                Maybe Later
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
