import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';

interface EnableTypeConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    typeName: string;
}

const EnableTypeConfirmModal: React.FC<EnableTypeConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    typeName
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
                className="relative bg-white rounded-xl md:rounded-2xl lg:rounded-2xl w-full max-w-sm md:max-w-md lg:max-w-md z-10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="flex justify-center pt-4 md:pt-5 lg:pt-6 pb-3 md:pb-3.5 lg:pb-4">
                    <div className="w-12 h-12 md:w-13 md:h-13 lg:w-14 lg:h-14 rounded-full bg-[#DCFCE7] border  flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 lg:w-7 lg:h-7" strokeWidth={2} color="#1D8C1D" />
                    </div>
                </div>

                {/* Header */}
                <div className="px-4 md:px-5 lg:px-6 pb-3 md:pb-3.5 lg:pb-4 text-center">
                    <h2 className="text-base md:text-lg lg:text-xl font-semibold text-[#1E1E1E] leading-tight md:leading-snug lg:leading-normal">
                        Enable Jewelery Type?
                    </h2>
                    <p className="text-xs md:text-xs lg:text-sm text-gray-600 mt-1.5 md:mt-1.5 lg:mt-2 leading-tight md:leading-snug lg:leading-normal">
                        Enable <span className="font-semibold">{typeName}</span> ? It will be available for new requests, AI detection, and quizzes.
                    </p>
                </div>

                {/* Information Box */}
                <div className="mx-4 md:mx-5 lg:mx-6 mb-4 md:mb-5 lg:mb-6 p-2.5 md:p-2.5 lg:p-3 bg-[#EBF3FE] border border-[#C2D8FC] rounded-lg flex items-start gap-1.5 md:gap-1.5 lg:gap-2">
                    <Info className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4 lg:h-4 shrink-0 mt-0.5" strokeWidth={2} color="#2F68C5" />
                    <p className="text-[10px] md:text-xs lg:text-xs text-[#2F68C5] font-medium leading-tight md:leading-snug lg:leading-normal">
                        This subtype will immediately become available across the platform.
                    </p>
                </div>

                {/* Separator Line */}
                <div className="h-px bg-[#D5D5D5] mx-4 md:mx-5 lg:mx-6" />

                {/* Action Buttons */}
                <div className="px-4 md:px-5 lg:px-6 py-4 md:py-5 lg:py-6 flex items-center gap-2 md:gap-2.5 lg:gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#EBF3FE] text-[#373737] text-xs md:text-sm lg:text-sm font-medium hover:bg-[#D6E7FC] transition-colors cursor-pointer leading-tight md:leading-snug lg:leading-normal"
                    >
                        Close
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#22A121] text-white text-xs md:text-sm lg:text-sm font-medium hover:bg-[#1D8B1C] transition-colors cursor-pointer leading-tight md:leading-snug lg:leading-normal"
                    >
                        Enable Type
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EnableTypeConfirmModal;
