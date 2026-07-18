import React from 'react';
import { CheckCircle2, Info, Loader2 } from 'lucide-react';

interface EnableSubtypeConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    subtypeName: string;
    loading?: boolean;
    error?: string | null;
}

const EnableSubtypeConfirmModal: React.FC<EnableSubtypeConfirmModalProps> = ({
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
                    <div className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full bg-[#DCFCE7] border-2 border-[#1D8C1D] flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" color="#1D8C1D" strokeWidth={2} />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-base md:text-lg lg:text-xl font-semibold text-[#1E1E1E] text-center mb-2 md:mb-2.5 lg:mb-3 leading-tight md:leading-snug lg:leading-normal">
                    Enable Jewelery Subtype?
                </h2>

                {/* Description */}
                <p className="text-xs md:text-xs lg:text-sm text-[#515151] text-center mb-3 md:mb-3.5 lg:mb-4 leading-tight md:leading-snug lg:leading-normal">
                    Enable <span className="font-semibold text-[#1E1E1E]">{subtypeName}</span> ? It will be available for new requests and guided quizzes.
                </p>

                {/* Info Box */}
                <div className="bg-[#EBF3FE] border border-[#C2D8FC] rounded-lg p-2.5 md:p-2.5 lg:p-3 mb-4 md:mb-5 lg:mb-6 flex items-start gap-1.5 md:gap-1.5 lg:gap-2">
                    <Info className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4 lg:h-4 shrink-0 mt-0.5" color="#2F68C5" />
                    <p className="text-[10px] md:text-xs lg:text-xs text-[#2F68C5] leading-tight md:leading-snug lg:leading-normal">
                        This subtype will immediately become available across the platform.
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
                        className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#22A121] text-white text-xs md:text-sm lg:text-sm font-medium hover:bg-[#1C8619] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed leading-tight md:leading-snug lg:leading-normal flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Enabling...
                            </>
                        ) : (
                            'Enable Subtype'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EnableSubtypeConfirmModal;
