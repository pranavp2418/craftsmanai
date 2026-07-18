'use client';

interface ViewPromptModalProps {
  onClose: () => void;
  prompt: string;
  timestamp?: string;
}

export default function ViewPromptModal({ onClose, prompt, timestamp }: ViewPromptModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] mx-4 rounded-[24px] p-6 bg-white shadow-[0px_24px_64px_rgba(0,0,0,0.14),_0px_4px_16px_rgba(0,0,0,0.06)] border border-black/[0.06]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-slate-500/10">
              <i className="ri-eye-line text-[15px] text-[#6B7280]"></i>
            </div>
            <h3
              className="text-[15px] font-semibold text-[#1A1A1A] font-satoshi"
            >
              Design Prompt
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-[16px] text-[#9CA3AF]"></i>
          </button>
        </div>

        <div className="rounded-[14px] p-4 mb-4 bg-[#F7F6F3] border border-black/[0.05]">
          <p
            className="text-[13px] text-[#374151] leading-relaxed font-inter"
          >
            {prompt}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#9CA3AF]">
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-time-line text-[12px]"></i>
            </span>
            {timestamp || 'Generated recently'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined') {
                  navigator.clipboard.writeText(prompt);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-file-copy-line text-[12px]"></i>
              </span>
              Copy
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-[8px] text-[12px] font-semibold text-white cursor-pointer whitespace-nowrap bg-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
