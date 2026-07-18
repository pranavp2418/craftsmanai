import React from 'react';
import { CreditCard, ShieldCheck, Copy, ChevronDown, CheckCircle2 } from 'lucide-react';

export default function PaymentSettings() {
  return (
    <div className="w-full space-y-4 sm:space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-lg sm:text-xl font-bold text-[#111827] mb-1">Payment Settings</h1>
        <p className="text-[13px] sm:text-sm text-gray-500">Configure billing provider and payment configuration for the platform.</p>
      </div>

      {/* Payment Provider Card */}
      <div className="bg-white rounded-[16px] sm:rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-50">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
              <CreditCard className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#2F68C5]" />
            </div>
            <div>
              <h2 className="text-[14px] sm:text-[15px] font-bold text-[#111827]">Payment Provider</h2>
              <p className="text-[11px] sm:text-[12px] text-gray-400 font-medium leading-tight mt-0.5">Configure your connected payment processor.</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
          {/* Stripe Connection */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] sm:rounded-[16px] p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <div className="w-10 h-6 sm:w-12 sm:h-7 bg-[#635BFF] rounded-md flex items-center justify-center text-white text-[9px] sm:text-[10px] font-bold tracking-tight shrink-0">
                stripe
              </div>
              <div className="flex-1">
                <h3 className="text-[13px] sm:text-sm font-bold text-[#111827]">Stripe</h3>
                <p className="text-[11px] sm:text-[12px] text-gray-400 font-medium">Connected payment provider</p>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t border-gray-50 sm:border-0 pt-3 sm:pt-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-[11px] sm:text-[12px] font-bold text-[#10B981]">Connected</span>
              </div>
              <button className="px-3 sm:px-4 py-1.5 sm:py-2 border border-[#E5E7EB] rounded-lg text-[11px] sm:text-[12px] font-bold text-[#374151] hover:bg-gray-50 transition-colors">
                Reconnect
              </button>
            </div>
          </div>

          {/* Account Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-2">
              <label className="text-[13px] sm:text-sm font-medium text-[#374151]">Connected Payout Account</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value="acct_1Pz8xKLmNpQrStUv"
                  className="w-full px-4 py-2.5 sm:py-3 bg-[#F9FAFB] border border-[#F3F4F6] rounded-[10px] sm:rounded-xl text-[13px] sm:text-sm font-medium text-gray-600 focus:outline-none"
                />
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium ml-1">Stripe connected account ID</p>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] sm:text-sm font-medium text-[#374151]">Billing Currency</label>
              <div className="relative group cursor-pointer">
                <div className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#E5E7EB] rounded-[10px] sm:rounded-xl text-[13px] sm:text-sm font-medium text-[#111827] flex items-center justify-between hover:border-[#2F68C5] transition-all">
                  <span>USD — US Dollar</span>
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-[#2F68C5]" />
                </div>
              </div>
            </div>
          </div>

          {/* Tax Configuration */}
          <div className="space-y-3 sm:space-y-4 pt-2">
            <h3 className="text-[13px] sm:text-sm font-medium text-[#374151]">Tax Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-[10px] sm:rounded-xl p-3 sm:p-4">
                <label className="block text-[10px] sm:text-[11px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Tax Collection</label>
                <div className="text-[12px] sm:text-[13.5px] font-bold text-[#111827]">Automatic (Stripe Tax)</div>
              </div>
              <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-[10px] sm:rounded-xl p-3 sm:p-4">
                <label className="block text-[10px] sm:text-[11px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Tax ID Collection</label>
                <div className="text-[12px] sm:text-[13.5px] font-bold text-[#111827]">Enabled for Business</div>
              </div>
              <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-[10px] sm:rounded-xl p-3 sm:p-4 sm:col-span-2 xl:col-span-1">
                <label className="block text-[10px] sm:text-[11px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Tax Rate</label>
                <div className="text-[12px] sm:text-[13.5px] font-bold text-[#111827]">Region-based</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Webhook Configuration Card */}
      <div className="bg-white rounded-[16px] sm:rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-50">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-xl bg-[#F5F3FF] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#7C3AED]" />
            </div>
            <div>
              <h2 className="text-[14px] sm:text-[15px] font-bold text-[#111827]">Webhook Configuration</h2>
              <p className="text-[11px] sm:text-[12px] text-gray-400 font-medium leading-tight mt-0.5">Stripe webhook endpoint for subscription lifecycle events.</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-[13px] sm:text-sm font-medium text-[#374151]">Webhook Endpoint URL</label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex-1 px-4 py-2.5 sm:py-3 bg-[#F9FAFB] border border-[#F3F4F6] rounded-[10px] sm:rounded-xl text-[12px] sm:text-sm font-medium text-gray-600 font-mono overflow-x-auto whitespace-nowrap no-scrollbar border-dashed sm:border-solid">
                https://craftsman.ai/api/webhooks/stripe
              </div>
              <button 
                className="h-10 sm:h-11 w-full sm:w-11 border border-[#E5E7EB] rounded-[10px] sm:rounded-xl flex items-center justify-center text-gray-500 hover:text-[#2F68C5] hover:bg-gray-50 transition-all shrink-0 active:scale-95 gap-2 px-4 sm:px-0"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span className="sm:hidden text-xs font-bold">Copy URL</span>
              </button>
            </div>
          </div>

          <div className="bg-[#F0FDF4] rounded-[10px] sm:rounded-xl p-3 sm:p-4 border border-[#DCFCE7] flex items-center gap-3">
            <CheckCircle2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#10B981] shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium text-[#15803D]">Webhook is active and receiving events</span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 sm:pt-6">
        <button
          className="w-full sm:w-auto p-2.5 px-6 sm:px-8 border border-[#2F68C5] text-[#2F68C5] text-[13px] sm:text-sm font-medium rounded-full hover:bg-blue-50 transition-all active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          className="w-full sm:w-auto p-2.5 px-6 sm:px-8 bg-[#2F68C5] text-white text-[13px] sm:text-sm font-medium rounded-full hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-[0.98]"
        >
          Update Payment Settings
        </button>
      </div>
    </div>
  );
}
