'use client';

interface MarkCompleteModalProps {
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function MarkCompleteModal({ onClose, onConfirm, isLoading }: MarkCompleteModalProps) {
  return (
   <div className="fixed inset-0 z-50 flex items-center justify-center">
  <div
    className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm"
    onClick={onClose}
  />

  <div
    className="
      relative w-full max-w-[420px] mx-4 rounded-[24px] p-6
      bg-white dark:bg-[#1C1F26]
      border border-black/[0.06] dark:border-white/[0.08]
      shadow-[0px_24px_64px_rgba(0,0,0,0.14),_0px_4px_16px_rgba(0,0,0,0.06)]
      transition-colors
    "
  >
    <div className="flex flex-col items-center text-center mb-6">
      <div
        className="
          w-14 h-14 flex items-center justify-center rounded-full mb-4
          bg-green-500/10 dark:bg-green-500/15
        "
      >
        <i className="ri-checkbox-circle-line text-[28px] text-[#16A34A]" />
      </div>

      <h3
        className="
          text-[16px] font-semibold mb-2 font-satoshi
          text-[#1A1A1A] dark:text-white
          transition-colors
        "
      >
        Mark as Completed?
      </h3>

      <p
        className="
          text-[13px] leading-relaxed max-w-[300px]
          text-[#6B7280] dark:text-[#9CA3AF]
          transition-colors
        "
      >
        This will mark the request as completed. This action cannot be undone.
      </p>
    </div>

    <div className="flex items-center gap-3">
      <button
        onClick={onClose}
        disabled={isLoading}
        className="
          flex-1 py-2.5 rounded-[12px]
          text-[13px] font-medium
          text-[#6B7280] dark:text-[#D1D5DB]
          border border-black/[0.08] dark:border-white/[0.08]
          bg-transparent dark:bg-[#252933]
          hover:bg-[#F3F4F6] dark:hover:bg-[#2D3440]
          transition-all
          cursor-pointer whitespace-nowrap
          disabled:opacity-50
        "
      >
        Cancel
      </button>

      <button
        onClick={() => {
          onConfirm();
          onClose();
        }}
        disabled={isLoading}
        className="
          flex-1 py-2.5 rounded-[12px]
          text-[13px] font-semibold text-white dark:text-black
          bg-green-600 hover:bg-green-700
          transition-all duration-150
          cursor-pointer whitespace-nowrap
          disabled:cursor-not-allowed disabled:opacity-70
        "
      >
        {isLoading ? 'Marking...' : 'Yes, Mark Complete'}
      </button>
    </div>
  </div>
</div>
  );
}