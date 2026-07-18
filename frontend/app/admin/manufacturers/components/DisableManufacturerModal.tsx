import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Manufacturer } from './ManufacturerTable';

interface DisableManufacturerModalProps {
  manufacturer: Manufacturer | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

const DisableManufacturerModal: React.FC<DisableManufacturerModalProps> = ({ 
  manufacturer, 
  isOpen, 
  onClose, 
  onConfirm 
}) => {
  if (!isOpen || !manufacturer) return null;

  const handleDisable = () => {
    onConfirm(manufacturer.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-5 lg:p-6">
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
          {/* Warning Icon */}
          <div className="flex justify-center mb-2.5 sm:mb-3 md:mb-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full bg-[#FFEBEB] flex items-center justify-center">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-[#C21D1A]" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-[#1E1E1E] text-center mb-1.5 sm:mb-2 md:mb-3 leading-tight sm:leading-snug">
            Disable Manufacturer
          </h2>

          {/* Description */}
          <p className="text-[11px] sm:text-xs md:text-sm lg:text-base text-[#373737] text-center mb-2.5 sm:mb-3 md:mb-4 leading-snug sm:leading-normal">
            Disable this manufacturer? They will no longer receive new production requests.
          </p>

          {/* Manufacturer Details */}
          <div className="bg-[#F9F9F9] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 lg:p-5 mb-2.5 sm:mb-3 md:mb-4">
            <p className="text-[11px] sm:text-xs md:text-sm lg:text-base font-semibold text-[#1E1E1E] mb-0.5 sm:mb-1 leading-tight sm:leading-snug">
              {manufacturer.name}
            </p>
            <p className="text-[10px] sm:text-xs md:text-sm text-[#8A8A8A] mb-0.5 leading-tight sm:leading-snug">
              {manufacturer.email}
            </p>
            <p className="text-[10px] sm:text-xs md:text-sm text-[#6D6D6D] leading-tight sm:leading-snug">
              {manufacturer.manufacturerId}
            </p>
          </div>

          {/* Warning Note */}
          <div className="border-2 border-[#C21D1A] rounded-lg p-2 sm:p-2.5 md:p-3 lg:p-4 mb-4 sm:mb-5 md:mb-6">
            <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm leading-snug sm:leading-normal">
              <span className="font-semibold text-[#D8201D]">Note:</span>{' '}
              <span className="text-[#D8201D]">
                Disabling this manufacturer will prevent them from receiving new jobs. Existing job history will be preserved.
              </span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 md:gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 sm:py-2.5 md:py-3 bg-[#F3F4F6] text-[#374151] rounded-lg sm:rounded-full font-medium hover:bg-[#E5E7EB] transition-colors text-xs sm:text-sm md:text-base leading-tight sm:leading-normal cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleDisable}
              className="flex-1 py-2 sm:py-2.5 md:py-3 bg-[#D8201D] text-white rounded-lg sm:rounded-full font-medium hover:bg-[#B91C1C] transition-colors text-xs sm:text-sm md:text-base leading-tight sm:leading-normal cursor-pointer"
            >
              Disable Manufacturer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisableManufacturerModal;
