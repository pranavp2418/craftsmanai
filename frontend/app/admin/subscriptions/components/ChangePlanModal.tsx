import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface PlanOption {
  id: string;
  name: string;
  price: string;
  features: string[];
  isCurrent?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  retailerName: string;
  businessName: string;
  currentPlanId?: string;
}

const plans: PlanOption[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29/mo',
    features: ['50 AI renders/month', '10 customer shares', '5 manufacturer quotes'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$79/mo',
    features: ['200 AI renders/month', '50 customer shares', '25 manufacturer quotes'],
    isCurrent: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$199/mo',
    features: ['Unlimited AI renders', 'Unlimited customer shares', 'Unlimited manufacturer quotes'],
  },
];

export default function ChangePlanModal({ isOpen, onClose, retailerName, businessName, currentPlanId = 'pro' }: Props) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string>(currentPlanId);

  if (!isOpen) return null;

  const hasChanged = selectedPlan !== currentPlanId;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-[500px] rounded-[24px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#111827]">Change Plan</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">{retailerName} · {businessName}</p>
        </div>

        {/* Scrollable Content */}
        <div className="px-5 sm:px-6 py-2 overflow-y-auto space-y-6 flex-1 scrollbar-thin scrollbar-thumb-gray-200">
          {/* Billing Cycle Toggle */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold text-[#6B7280] mb-3 uppercase tracking-wider">Billing Cycle</label>
            <div className="bg-[#F8FAFC] p-1 rounded-xl flex border border-gray-100">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`flex-1 py-2 sm:py-2.5 rounded-lg text-sm font-bold transition-all ${
                  billingCycle === 'monthly' ? 'bg-[#2F68C5] text-white shadow-sm' : 'text-gray-500 hover:bg-white/50'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`flex-1 py-2 sm:py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  billingCycle === 'yearly' ? 'bg-[#2F68C5] text-white shadow-sm' : 'text-gray-500 hover:bg-white/50'
                }`}
              >
                Yearly <span className={`text-[10px] ${billingCycle === 'yearly' ? 'text-blue-100' : 'text-gray-400'}`}>Save 17%</span>
              </button>
            </div>
          </div>

          {/* Select Plan */}
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold text-[#6B7280] mb-3 uppercase tracking-wider">Select Plan</label>
            <div className="space-y-3 pb-2">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`p-4 rounded-[12px] border-2 cursor-pointer transition-all relative ${
                    selectedPlan === plan.id
                      ? 'border-[#3B82F6] bg-[#EFF6FF]'
                      : 'border-[#F3F4F6] bg-[#F9FAFB]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[13px] sm:text-sm font-semibold text-[#111827]">{plan.name}</h4>
                      {plan.isCurrent && (
                        <span className="px-1.5 py-0.5 bg-gray-200/50 text-gray-500 text-[9px] font-bold rounded uppercase">Current</span>
                      )}
                    </div>
                    <div className="text-[13px] sm:text-sm font-bold text-[#111827]">{plan.price}</div>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" strokeWidth={3} />
                        <span className="text-[11px] sm:text-xs text-[#6B7280] font-normal leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-3 border-t border-gray-50 bg-white flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 sm:py-3 px-6 border border-[#2F68C5] text-[#2F68C5] text-[13px] sm:text-sm font-bold rounded-full transition-all hover:bg-blue-50 order-2 sm:order-1"
          >
            Cancel
          </button>
          <button
            disabled={!hasChanged}
            className={`flex-1 py-2.5 sm:py-3 px-6 text-[13px] sm:text-sm font-bold rounded-full transition-all shadow-sm order-1 sm:order-2 ${
              hasChanged
                ? 'bg-[#2F68C5] text-white hover:bg-blue-700'
                : 'bg-[#B4C6EE] text-white cursor-not-allowed'
            }`}
          >
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}
