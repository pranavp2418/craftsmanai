import React from 'react';
import { AlertCircle, Info, Loader2 } from 'lucide-react';

interface DisableSubtypeConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    subtypeName: string;
    loading?: boolean;
    error?: string | null;
}

const DisableSubtypeConfirmModal: React.FC<DisableSubtypeConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    subtypeName,
    loading = false,
    error,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 lg:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 cursor-pointer"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className="relative bg-white rounded-2xl md:rounded-3xl lg:rounded-3xl w-full max-w-sm md:max-w-md lg:max-w-md z-10 shadow-2xl p-4 md:p-5 lg:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="flex justify-center mb-3 md:mb-3.5 lg:mb-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full bg-[#FFEBEB] border-2  flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" color="#C21D1A" strokeWidth={2} />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-base md:text-lg lg:text-xl font-semibold text-[#1E1E1E] text-center mb-2 md:mb-2.5 lg:mb-3 leading-tight md:leading-snug lg:leading-normal">
                    Disable Jewelery Subtype?
                </h2>

                {/* Description */}
                <p className="text-xs md:text-xs lg:text-sm text-[#515151] text-center mb-3 md:mb-3.5 lg:mb-4 leading-tight md:leading-snug lg:leading-normal">
                    Disable <span className="font-semibold text-[#1E1E1E]">{subtypeName}</span> ? It will no longer be available for new requests, detection, or quizzes.
                </p>

                {/* Info Box */}
                <div className="bg-[#FFECD1] border border-[#FEC97C] rounded-lg p-2.5 md:p-2.5 lg:p-3 mb-4 md:mb-5 lg:mb-6 flex items-start gap-1.5 md:gap-1.5 lg:gap-2">
                    <Info className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4 lg:h-4 shrink-0 mt-0.5" color="#F89402" />
                    <p className="text-[10px] md:text-xs lg:text-xs text-[#F89402] leading-tight md:leading-snug lg:leading-normal">
                        Historical data will not be deleted. You can re-enable this type at any time.
                    </p>
                </div>

                <div className="h-px bg-[#D5D5D5] mb-4 md:mb-5 lg:mb-6" />

                {error && <p className="text-xs text-red-500 text-center mb-3">{error}</p>}

                {/* Action Buttons */}
                <div className="flex gap-2 md:gap-2.5 lg:gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#EBF3FE] text-[#373737] text-xs md:text-sm lg:text-sm font-medium hover:bg-[#D6E7FC] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed leading-tight md:leading-snug lg:leading-normal"
                    >
                        Close
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#D8201D] text-white text-xs md:text-sm lg:text-sm font-medium hover:bg-[#B01A18] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed leading-tight md:leading-snug lg:leading-normal flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Disabling...
                            </>
                        ) : (
                            'Disable Subtype'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DisableSubtypeConfirmModal;
