import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Retailer } from './RetailerTable';

interface EnableRetailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  retailer: Retailer | null;
}

const EnableRetailerModal: React.FC<EnableRetailerModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  retailer 
}) => {
  if (!isOpen || !retailer) return null;

  const handleEnable = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#00000080] backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className="bg-white rounded-xl sm:rounded-2xl md:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative z-10"
        style={{
          boxShadow: '0px 20px 25px -5px #0000001A, 0px 8px 10px -6px #0000001A'
        }}
      >
        {/* Content */}
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7">
          {/* Success Icon */}
          <div className="flex justify-center mb-2 sm:mb-3 md:mb-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full bg-[#DCFCE7] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-[#1D8C1D]" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-[#1E1E1E] text-center mb-1.5 sm:mb-2 md:mb-2.5 leading-tight sm:leading-snug">
            Enable Retailer
          </h2>

          {/* Description */}
          <p className="text-[11px] sm:text-xs md:text-sm lg:text-base text-[#374151] text-center mb-3.5 sm:mb-4 md:mb-5 lg:mb-6 leading-snug sm:leading-normal">
            Enable <span className="font-semibold">{retailer.name}</span> ? They will regain system access and be able to create new requests.
          </p>

          <hr className="my-3.5 sm:my-4 md:my-5 lg:my-6 border-[#E5E7EB]" />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 md:gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 sm:py-2.5 md:py-3 bg-[#EBF3FE] text-[#2F68C5] rounded-lg sm:rounded-full font-medium hover:bg-[#DBE9FD] transition-colors text-xs sm:text-sm md:text-base cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleEnable}
              className="flex-1 py-2 sm:py-2.5 md:py-3 bg-[#22A121] text-white rounded-lg sm:rounded-full font-medium tracking-wide hover:bg-[#1D8C1D] transition-colors text-xs sm:text-sm md:text-base cursor-pointer"
            >
              Enable Retailer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnableRetailerModal;
