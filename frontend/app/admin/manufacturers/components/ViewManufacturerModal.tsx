import React from 'react';
import { X } from 'lucide-react';
import { Manufacturer } from './ManufacturerTable';

interface ViewManufacturerModalProps {
  manufacturer: Manufacturer | null;
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
}

const ViewManufacturerModal: React.FC<ViewManufacturerModalProps> = ({
  manufacturer,
  isOpen,
  onClose,
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-5 lg:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#00000080] backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className="bg-white rounded-xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10"
        style={{
          boxShadow: '0px 20px 25px -5px #0000001A, 0px 8px 10px -6px #0000001A',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-3 sm:p-4 md:p-5 lg:p-6 border-b border-gray-100">
          <h2 className="text-base sm:text-[18px] md:text-[20px] lg:text-[22px] font-bold text-[#1F2937] leading-tight sm:leading-snug">
            Manufacturer Details
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 md:p-2.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-500" />
          </button>
        </div>

        {/* Loading shimmer */}
        {loading && (
          <div className="p-4 sm:p-5 lg:p-6 space-y-4 animate-pulse">
            {/* Basic info block */}
            <div className="bg-[#F9F9F9] rounded-xl p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-3 w-28 bg-gray-200 rounded" />
                  <div className="h-3 w-36 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            {/* Jobs stats block */}
            <div className="bg-[#F9F9F9] rounded-xl p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-3 w-12 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            {/* Retailer block */}
            <div className="bg-[#F9F9F9] rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-3 w-36 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && manufacturer && (
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 space-y-3 sm:space-y-3.5 md:space-y-4">
            {/* Manufacturer Info */}
            <div className="bg-[#F9F9F9] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 lg:p-5 space-y-2 sm:space-y-2.5 md:space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-1 md:gap-0">
                <span className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#6D6D6D] leading-tight sm:leading-snug">Name</span>
                <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-medium text-[#1F2937] leading-tight sm:leading-snug">{manufacturer.name}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-1 md:gap-0">
                <span className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#6D6D6D] leading-tight sm:leading-snug">Jewelery Type</span>
                <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-medium text-[#1F2937] leading-tight sm:leading-snug">
                  {manufacturer.jewelleryType || '—'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-1 md:gap-0">
                <span className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#6D6D6D] leading-tight sm:leading-snug">Manufacturer ID</span>
                <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-medium text-[#1F2937] leading-tight sm:leading-snug">
                  {manufacturer.manufacturerId}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-1 md:gap-0">
                <span className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#6D6D6D] leading-tight sm:leading-snug">Email</span>
                <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-medium text-[#1F2937] break-all leading-tight sm:leading-snug">{JSON.parse(manufacturer.email)[0].email}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-1 md:gap-0">
                <span className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#6D6D6D] leading-tight sm:leading-snug">Current Status</span>
                <span
                  className={`px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs md:text-sm font-medium w-fit leading-tight ${manufacturer.status === 'active'
                      ? 'bg-[#DCFCE7] text-[#1D8C1D]'
                      : 'bg-gray-100 text-gray-600'
                    }`}
                >
                  {manufacturer.status === 'active' ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-1 md:gap-0">
                <span className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#6D6D6D] leading-tight sm:leading-snug">Contact</span>
                <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-medium text-[#1F2937] leading-tight sm:leading-snug">{manufacturer.contactNumber}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-1 md:gap-0">
                <span className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#6D6D6D] leading-tight sm:leading-snug">Joined Date</span>
                <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-medium text-[#1F2937] leading-tight sm:leading-snug">{manufacturer.joinedDate}</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
              <div className="bg-[#F9F9F9] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4">
                <p className="text-[10px] sm:text-xs md:text-sm text-[#8A8A8A] mb-1 sm:mb-1.5 md:mb-2 leading-tight">Jobs Received</p>
                <p className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-[#1F2937] leading-tight sm:leading-snug">{manufacturer.jobsReceived}</p>
              </div>
              <div className="bg-[#F9F9F9] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4">
                <p className="text-[10px] sm:text-xs md:text-sm text-[#8A8A8A] mb-1 sm:mb-1.5 md:mb-2 leading-tight">Quotes Submitted</p>
                <p className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-[#1F2937] leading-tight sm:leading-snug">{manufacturer.quotesSubmitted}</p>
              </div>
              <div className="bg-[#F9F9F9] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4">
                <p className="text-[10px] sm:text-xs md:text-sm text-[#8A8A8A] mb-1 sm:mb-1.5 md:mb-2 leading-tight">Approved Jobs</p>
                <p className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-[#1F2937] leading-tight sm:leading-snug">{manufacturer.approvedJobs ?? 0}</p>
              </div>
              <div className="bg-[#F9F9F9] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4">
                <p className="text-[10px] sm:text-xs md:text-sm text-[#8A8A8A] mb-1 sm:mb-1.5 md:mb-2 leading-tight">Associated Retailers</p>
                <p className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-[#1F2937] leading-tight sm:leading-snug">{manufacturer.associatedRetailers ?? 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2 sm:py-2.5 md:py-3 bg-[#EBF3FE] text-[#2F68C5] rounded-lg sm:rounded-full font-medium hover:bg-[#DBE9FD] transition-colors text-xs sm:text-sm md:text-base lg:text-lg leading-tight sm:leading-normal cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewManufacturerModal;
