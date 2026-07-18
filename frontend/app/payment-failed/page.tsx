'use client';

import { useRouter } from 'next/navigation';

export default function PaymentFailedPage() {
  const router = useRouter();

  const handleReturn = () => {
    router.push('/retailer/settings');
  };

  const cardCN = 'bg-glass-80 backdrop-blur-xl shadow-card-deeper border border-glass-vivid';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-indigo-veil px-4 sm:px-6">
      <div className={`w-full max-w-[500px] rounded-sheet-lg p-6 sm:p-8 ${cardCN} text-center flex flex-col items-center gap-6`}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-tint-danger animate-bounce">
          <span className="w-8 h-8 flex items-center justify-center ri-error-warning-line text-display-sm text-danger"></span>
        </div>
        
        <div>
          <h1 className="text-heading-lg font-bold text-ink-900 font-satoshi">Payment Failed</h1>
          <p className="text-body-sm text-ink-500 mt-2.5 max-w-[360px] mx-auto">
            Your transaction could not be processed. This might be due to incorrect card details, insufficient funds, or a cancelled checkout session.
          </p>
        </div>

        <div className="w-full rounded-2xl p-5 bg-section border border-sand flex flex-col gap-3.5 text-left">
          <div className="flex items-center gap-2.5">
            <span className="w-4 h-4 flex items-center justify-center ri-customer-service-2-line text-ui text-indigo-accent"></span>
            <div>
              <p className="text-label-xs font-semibold text-ink-400 uppercase tracking-wide">Support Email</p>
              <p className="text-body-sm font-semibold text-ink-900">support@craftsman.ai</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 pt-2 border-t border-sand">
            <span className="w-4 h-4 flex items-center justify-center ri-time-line text-ui text-indigo-accent"></span>
            <div>
              <p className="text-label-xs font-semibold text-ink-400 uppercase tracking-wide">Response Time</p>
              <p className="text-body-sm font-semibold text-ink-900">Within 1 business day</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleReturn}
          className="w-full py-3 rounded-xl text-body-sm font-semibold text-white whitespace-nowrap transition-all duration-200 bg-gradient-indigo shadow-glow-indigo"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
