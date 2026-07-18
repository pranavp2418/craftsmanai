'use client';

import { useState } from 'react';

const REQUESTS_USED = 134;
const REQUESTS_TOTAL = 300;
const REQUESTS_PCT = Math.round((REQUESTS_USED / REQUESTS_TOTAL) * 100);

const BILLING_HISTORY = [
  { id: 'INV-2026-004', date: 'Apr 1, 2026', plan: 'Professional', amount: '$149.00', status: 'Paid' },
  { id: 'INV-2026-003', date: 'Mar 1, 2026', plan: 'Professional', amount: '$149.00', status: 'Paid' },
  { id: 'INV-2026-002', date: 'Feb 1, 2026', plan: 'Professional', amount: '$149.00', status: 'Paid' },
  { id: 'INV-2026-001', date: 'Jan 1, 2026', plan: 'Professional', amount: '$149.00', status: 'Paid' },
  { id: 'INV-2025-012', date: 'Dec 1, 2025', plan: 'Starter', amount: '$49.00', status: 'Paid' },
  { id: 'INV-2025-011', date: 'Nov 1, 2025', plan: 'Starter', amount: '$49.00', status: 'Paid' },
];

const USAGE_STATS = [
  { icon: 'ri-image-ai-line', color: 'text-indigo-accent', bg: 'bg-tint-indigo-mid', title: 'Requests Used', value: '134', week: '+18 this week' },
  { icon: 'ri-share-line', color: 'text-success-medium', bg: 'bg-tint-emerald', title: 'Designs Shared', value: '47', week: '+6 this week' },
  { icon: 'ri-user-received-line', color: 'text-warning', bg: 'bg-tint-warning', title: 'Customer Requests', value: '29', week: '+4 this week' },
];

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: '$49',
    yearlyPrice: '$39',
    desc: 'Perfect for small retailers getting started with AI jewellery design.',
    features: ['100 AI renders / month', '5 active projects', '1 team member', 'Basic analytics', 'Email support'],
    cta: 'Downgrade',
    ctaStyle: 'outline',
    current: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: '$149',
    yearlyPrice: '$119',
    desc: 'Designed for retailers handling frequent custom jewellery design requests.',
    features: ['300 AI renders / month', '30 active projects', '5 team members', 'Advanced analytics', 'Priority support', 'Manufacturer workflow'],
    cta: 'Current Plan',
    ctaStyle: 'current',
    current: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 'Custom',
    yearlyPrice: 'Custom',
    desc: 'For large retailers and chains needing unlimited scale and dedicated support.',
    features: ['Unlimited renders', 'Unlimited projects', 'Unlimited team members', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee'],
    cta: 'Contact Sales',
    ctaStyle: 'sales',
    current: false,
  },
];

export default function BillingCard() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentForm, setPaymentForm] = useState({ card: '', expiry: '', cvv: '', zip: '' });
  const [paymentSaved, setPaymentSaved] = useState(false);

  const handleSavePayment = () => {
    setShowPaymentModal(false);
    setPaymentSaved(true);
    setTimeout(() => setPaymentSaved(false), 3000);
    setPaymentForm({ card: '', expiry: '', cvv: '', zip: '' });
  };

  // Reusable className strings (replaces previous cardStyle / innerCardStyle JS objects).
  const cardCN = 'bg-glass-80 backdrop-blur-xl shadow-card-deeper border border-glass-vivid';
  const innerCardCN = 'bg-section border border-sand';

  return (
    <div className="flex flex-col gap-5">

      {paymentSaved && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl text-body-sm font-medium text-white shadow-xl bg-gradient-success-light"
        >
          <span className="w-4 h-4 flex items-center justify-center ri-checkbox-circle-line text-ui-md"></span>
          Payment method updated successfully
        </div>
      )}

      <div className="mb-1">
        <h2 className="text-heading-md font-bold text-ink-900 font-satoshi">
          Billing &amp; Subscription
        </h2>
        <p className="text-body-sm text-ink-400 mt-0.5">Manage your subscription, billing details, and plan usage.</p>
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-indigo">
            <span className="ri-bar-chart-2-line text-ui-md text-indigo-accent w-4 h-4 flex items-center justify-center"></span>
          </div>
          <div>
            <p className="text-body-md font-semibold text-ink-900 font-satoshi">Your Usage This Month</p>
            <p className="text-label-sm text-ink-400">Each request represents a generated jewelery design render.</p>
          </div>
        </div>

        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-display font-bold text-ink-900 font-satoshi">
              {REQUESTS_USED} <span className="text-ui-md font-medium text-ink-400">/ {REQUESTS_TOTAL} Requests Used</span>
            </p>
          </div>
          <span className="text-body-sm font-semibold text-indigo-accent">{REQUESTS_PCT}%</span>
        </div>

        <div className="relative h-2.5 rounded-full overflow-hidden mb-3 bg-muted-bg-70">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 bg-gradient-indigo shadow-glow-indigo-spot"
            style={{ width: `${REQUESTS_PCT}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-label text-ink-400">
            <span className="font-semibold text-ink-700">{REQUESTS_TOTAL - REQUESTS_USED} requests remaining</span>
          </p>
          <p className="text-label text-ink-400">Resets on August 12, 2026</p>
        </div>
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-indigo">
              <span className="ri-vip-crown-2-line text-ui-md text-indigo-accent w-4 h-4 flex items-center justify-center"></span>
            </div>
            <p className="text-body-md font-semibold text-ink-900 font-satoshi">Current Plan</p>
          </div>
          <span className="px-3 py-1 rounded-full text-label-sm font-semibold bg-tint-emerald text-success-medium">
            Active
          </span>
        </div>

        <div className="rounded-2xl p-5 mb-5 bg-gradient-indigo-veil border border-tint-indigo">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-heading-md font-bold text-ink-900 font-satoshi">Professional Plan</p>
              <p className="text-label-md text-ink-500 mt-1 max-w-[340px]">Designed for retailers handling frequent custom jewelery design requests.</p>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              <p className="text-display-sm font-bold text-ink-900 font-satoshi">$149</p>
              <p className="text-label text-ink-400">per month</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4">
            {['AI-powered jewellery renders', 'Customer approval sharing', 'Manufacturer quotation workflow', 'Smart design detection', 'Secure design storage', 'Retailer analytics dashboard'].map((f) => (
              <div key={f} className="flex items-center gap-2 text-label text-ink-700">
                <span className="w-3.5 h-3.5 flex items-center justify-center ri-check-line text-label text-success-medium"></span>
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className={`rounded-xl p-4 ${innerCardCN}`}>
            <p className="text-label-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">Billing Cycle</p>
            <p className="text-body-md font-semibold text-ink-900">Monthly</p>
          </div>
          <div className={`rounded-xl p-4 ${innerCardCN}`}>
            <p className="text-label-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">Next Billing Date</p>
            <p className="text-body-md font-semibold text-ink-900">May 1, 2026</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-body-sm font-semibold text-white whitespace-nowrap cursor-pointer transition-all duration-200 bg-gradient-indigo shadow-glow-indigo">
            <span className="w-4 h-4 flex items-center justify-center ri-arrow-up-circle-line text-ui"></span>
            Upgrade Plan
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-body-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 text-indigo-accent bg-tint-indigo-soft border border-tint-indigo-soft"
          >
            <span className="w-4 h-4 flex items-center justify-center ri-settings-3-line text-ui"></span>
            Manage Plan
          </button>
        </div>
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-brand">
            <span className="ri-pie-chart-2-line text-ui-md text-brand w-4 h-4 flex items-center justify-center"></span>
          </div>
          <p className="text-body-md font-semibold text-ink-900 font-satoshi">Usage Breakdown</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {USAGE_STATS.map((s) => (
            <div key={s.title} className={`rounded-2xl p-4 flex flex-col gap-3 ${innerCardCN}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg}`}>
                <span className={`w-5 h-5 flex items-center justify-center ${s.icon} text-ui-lg ${s.color}`}></span>
              </div>
              <div>
                <p className="text-label-xs font-semibold text-ink-400 uppercase tracking-wide">{s.title}</p>
                <p className="text-heading-md font-bold text-ink-900 mt-0.5 font-satoshi">{s.value}</p>
                <p className={`text-label-sm font-medium mt-0.5 ${s.color}`}>{s.week}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-warning">
              <span className="ri-bank-card-line text-ui-md text-warning w-4 h-4 flex items-center justify-center"></span>
            </div>
            <p className="text-body-md font-semibold text-ink-900 font-satoshi">Billing Details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {[
            { label: 'Billing Cycle', value: 'Monthly' },
            { label: 'Next Billing Date', value: 'May 1, 2026' },
            { label: 'Amount Due', value: '$149.00' },
            { label: 'Payment Method', value: 'Visa ending in 4832' },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl p-4 ${innerCardCN}`}>
              <p className="text-label-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">{item.label}</p>
              <p className="text-body font-semibold text-ink-900">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-body-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 bg-tint-warning-soft text-warning-dark border border-tint-warning"

          >
            <span className="w-4 h-4 flex items-center justify-center ri-bank-card-2-line text-ui"></span>
            Update Payment Method
          </button>
          <p className="text-label-sm text-ink-400 flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 flex items-center justify-center ri-lock-line text-body-sm"></span>
            Payments are securely processed.
          </p>
        </div>
      </div>

      <div className={`rounded-sheet p-4 sm:p-6 ${cardCN}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-indigo">
              <span className="ri-receipt-line text-ui-md text-indigo-accent w-4 h-4 flex items-center justify-center"></span>
            </div>
            <p className="text-body-md font-semibold text-ink-900 font-satoshi">Billing History</p>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-md font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 text-indigo-accent bg-tint-indigo-soft border border-tint-indigo-mid"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center ri-download-2-line text-body-sm"></span>
            Export All
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden border border-sand">
          <table className="w-full">
            <thead>
              <tr className="bg-section-90">
                {['Invoice ID', 'Date', 'Plan', 'Amount', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BILLING_HISTORY.map((row, i) => (
                <tr className={`${i % 2 === 0 ? "bg-glass-60" : "bg-section-50"} ${i > 0 ? "border-t border-warm-subtle" : "border-t-0"}`} key={row.id}>
                  <td className="px-4 py-3.5 text-label-md font-semibold text-indigo-accent">{row.id}</td>
                  <td className="px-4 py-3.5 text-label-md text-ink-700">{row.date}</td>
                  <td className="px-4 py-3.5 text-label-md text-ink-700">{row.plan}</td>
                  <td className="px-4 py-3.5 text-label-md font-semibold text-ink-900">{row.amount}</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-1 rounded-full text-label-xs font-semibold bg-tint-emerald text-success-medium">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <button className="flex items-center gap-1.5 text-label font-medium text-ink-500 hover:text-indigo-accent transition-colors cursor-pointer whitespace-nowrap">
                      <span className="w-3.5 h-3.5 flex items-center justify-center ri-file-download-line text-body-sm"></span>
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-overlay-45 backdrop-blur">
          <div className="w-full max-w-[820px] rounded-sheet-lg p-5 sm:p-8 max-h-[90vh] overflow-y-auto mx-4 sm:mx-0 shadow-modal-deep bg-glass-100 border border-glass-bright">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-heading font-bold text-ink-900 font-satoshi">Upgrade Your Plan</h3>
                <p className="text-body-sm text-ink-400 mt-0.5">Choose the plan that fits your business needs.</p>
              </div>
              <button onClick={() => setShowUpgradeModal(false)} className="touch-target rounded-full transition-colors hover:bg-black/5" aria-label="Close">
                <span className="ri-close-line text-heading text-ink-500"></span>
              </button>
            </div>

            <div className="flex items-center justify-center mb-7">
              <div className="flex items-center gap-1 p-1 rounded-full bg-slate-900 border border-slate-800">

                <button
                  onClick={() => setBillingCycle('monthly')}
                  type="button"
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${billingCycle === 'monthly'
                    ? 'bg-slate-700 dark:!bg-gray-800 text-white dark:text-gray-900 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Monthly
                </button>

                <button
                  onClick={() => setBillingCycle('yearly')}
                  type="button"
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${billingCycle === 'yearly'
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Yearly

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    Save 20%
                  </span>
                </button>

              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {PLANS.map((plan) => (
                <div key={plan.id} className={`rounded-2xl p-5 flex flex-col ${plan.current
                  ? 'bg-gradient-indigo-veil-light border-2 border-indigo-strong'
                  : 'bg-section border border-sand'
                  }`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-body-md font-bold text-ink-900 font-satoshi">{plan.name}</p>
                    {plan.current && (
                      <span className="px-2.5 py-0.5 rounded-full text-caption font-semibold text-indigo-accent bg-tint-indigo-strong">Current</span>
                    )}
                  </div>
                  <div className="mb-3">
                    <span className="text-display-sm font-bold text-ink-900 font-satoshi">
                      {billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                    </span>
                    {plan.monthlyPrice !== 'Custom' && <span className="text-label text-ink-400 ml-1">/mo</span>}
                  </div>
                  <p className="text-label-sm text-ink-500 mb-4 leading-relaxed">{plan.desc}</p>
                  <ul className="flex flex-col gap-2 mb-5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-label-sm text-ink-700">
                        <span className="w-3.5 h-3.5 flex items-center justify-center ri-check-line text-label text-success-medium mt-0.5 flex-shrink-0"></span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={plan.current}
                    className={`w-full py-2.5 rounded-xl text-body-sm font-semibold whitespace-nowrap transition-all duration-200 ${plan.current
                      ? 'bg-muted-bg-70 text-ink-400 cursor-not-allowed'
                      : plan.ctaStyle === 'sales'
                        ? 'bg-overlay-indigo text-white'
                        : 'bg-gradient-indigo text-white shadow-glow-indigo-accent'
                      }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-overlay-45 backdrop-blur">
          <div className="w-[calc(100vw-2rem)] max-w-[440px] rounded-sheet-lg p-5 sm:p-8 mx-4 sm:mx-0 shadow-modal-deep bg-glass-100 border border-glass-bright">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-heading-xs font-bold text-ink-900 font-satoshi">Update Payment Method</h3>
                <p className="text-label-md text-ink-400 mt-0.5">Your information is encrypted and secure.</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="touch-target rounded-full hover:bg-black/5 transition-colors" aria-label="Close">
                <span className="ri-close-line text-heading text-ink-500"></span>
              </button>
            </div>

            <div className="flex flex-col gap-4 mb-6">
              <PaymentField label="Card Number" placeholder="1234 5678 9012 3456" value={paymentForm.card}
                onChange={(v) => setPaymentForm((p) => ({ ...p, card: v }))} icon="ri-bank-card-line" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PaymentField label="Expiry Date" placeholder="MM / YY" value={paymentForm.expiry}
                  onChange={(v) => setPaymentForm((p) => ({ ...p, expiry: v }))} icon="ri-calendar-line" />
                <PaymentField label="CVV" placeholder="•••" value={paymentForm.cvv}
                  onChange={(v) => setPaymentForm((p) => ({ ...p, cvv: v }))} icon="ri-lock-line" />
              </div>
              <PaymentField label="Billing ZIP Code" placeholder="e.g. 10001" value={paymentForm.zip}
                onChange={(v) => setPaymentForm((p) => ({ ...p, zip: v }))} icon="ri-map-pin-line" />
            </div>

            <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl bg-tint-emerald-faint border border-tint-emerald">
              <span className="w-4 h-4 flex items-center justify-center ri-shield-check-line text-ui text-success-medium"></span>
              <p className="text-label-sm text-success-deep">Your payment information is encrypted and secure.</p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSavePayment}
                className="flex-1 py-2.5 rounded-xl text-body-sm font-semibold text-white dark:text-black whitespace-nowrap cursor-pointer transition-all duration-200 bg-gradient-indigo shadow-glow-indigo">
                Save Payment Method
              </button>
              <button onClick={() => setShowPaymentModal(false)}
                className="px-5 py-2.5 rounded-xl text-body-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 text-ink-500 bg-muted-bg-60">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentField({ label, placeholder, value, onChange, icon }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; icon: string;
}) {
  return (
    <div>
      <label className="block text-label-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative">
        <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center ${icon} text-ui text-ink-400`}></span>
        <input
          aria-label={placeholder} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 rounded-xl text-body text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 transition-all duration-150 font-inter bg-section-90 border-1.5 border-sand-firm"

          onFocus={(e) => { e.currentTarget.style.border = '1.5px solid rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'; }}
          onBlur={(e) => { e.currentTarget.style.border = '1.5px solid rgba(229,231,235,0.9)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>
    </div>
  );
}
