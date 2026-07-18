'use client';

export default function ManufacturerEmptyState({ onGoToDesign }: { onGoToDesign: () => void }) {
  return (
    <div className="w-full flex flex-col items-center py-12 px-8 gap-6">
      <div className="flex flex-col items-center text-center max-w-[420px] w-full rounded-[28px] px-10 py-12 bg-white/90 shadow-[0_8px_48px_rgba(139,92,246,0.07),_0_2px_12px_rgba(0,0,0,0.04)] border border-violet-500/10">
        <div
          className="w-[68px] h-[68px] flex items-center justify-center rounded-[20px] mb-6 bg-[linear-gradient(135deg,rgba(139,92,246,0.10)_0%,rgba(59,130,246,0.07)_100%)] border border-[rgba(139,92,246,0.14)]"
        >
          <i className="ri-building-4-line text-[28px] text-[#8B5CF6]"></i>
        </div>

        <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span>
          <span className="text-[11px] font-medium text-[#8B5CF6] font-inter">
            Requires Customer Approval
          </span>
        </div>

        <h3 className="text-[18px] font-semibold text-[#1A1A1A] mb-3 leading-snug font-satoshi tracking-[-0.2px]">
          No designs sent to manufacturer yet
        </h3>

        <p className="text-[13.5px] text-[#9CA3AF] leading-relaxed mb-8 font-inter">
          After customer approval, send the final design to manufacturers for production.
        </p>

        <div className="flex flex-col items-center gap-4 w-full">
          <button
            onClick={onGoToDesign}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-[14px] text-[13.5px] font-semibold text-white transition-all duration-200 cursor-pointer whitespace-nowrap hover:opacity-90 active:scale-[0.98] bg-[linear-gradient(135deg,#8B5CF6_0%,#4F46E5_100%)] shadow-[0_4px_18px_rgba(139,92,246,0.28)]"
          >
            <i className="ri-send-plane-line text-[15px]"></i>
            Send from Design Tab
          </button>

          <div className="flex items-center gap-2">
            <i className="ri-arrow-left-up-line text-[12px] text-[#8B5CF6] opacity-50"></i>
            <span className="text-[11.5px] text-[#C4B8A8] font-inter">
              Complete customer approval first in the{' '}
              <button className="text-[#8B5CF6] font-medium hover:underline cursor-pointer">Customer tab</button>
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(245,240,235,0.8)] border border-black/[0.05]">
        <i className="ri-information-line text-[12px] text-[#C4B8A8]"></i>
        <span className="text-[11px] text-[#C4B8A8] font-inter">
          Production orders will appear here after design is approved &amp; dispatched
        </span>
      </div>
    </div>
  );
}
