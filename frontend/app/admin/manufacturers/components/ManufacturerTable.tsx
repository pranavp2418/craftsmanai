import React from 'react';
import { Eye } from 'lucide-react';

export interface Manufacturer {
  id: string;
  name: string;
  manufacturerId: string;
  email: string;
  contactNumber: string;
  location: string;
  status: 'active' | 'disabled';
  jobsReceived: number;
  quotesSubmitted: number;
  joinedDate: string;
  // Detail-only fields (populated by fetchAdminManufacturerDetail)
  jewelleryType?: string;
  approvedJobs?: number;
  associatedRetailers?: number;
}

interface ManufacturerTableProps {
  manufacturers: Manufacturer[];
  onStatusToggle: (id: string) => void;
  onViewClick: (manufacturer: Manufacturer) => void;
}

const ManufacturerTable: React.FC<ManufacturerTableProps> = ({ 
  manufacturers,
  onStatusToggle,
  onViewClick
}) => {

  const displayValue = (value?: string | null) => {
  return value?.toString().trim() ? value : 'N/A';
};

  return (
    <div className="w-full">
      {/* Table View - Responsive with horizontal scroll */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-[#F1F1F1] truncate">
            <tr>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide rounded-tl-lg leading-tight">
                Manufacturer Name
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Email
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Contact Number
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Location
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Status
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-center text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Jobs Received
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-center text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Quotes Submitted
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Joined Date
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide rounded-tr-lg leading-tight">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
  {manufacturers.length === 0 ? (
    <tr>
      <td colSpan={9} className="px-5 py-10">
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8">
          <div className="text-sm font-semibold text-gray-800">
            No manufacturers to show
          </div>
          <div className="text-xs text-gray-500">
            Try adjusting your search or filters.
          </div>
        </div>
      </td>
    </tr>
  ) : (
    manufacturers.map((manufacturer, index) => (
      <tr
        key={manufacturer.id}
        className={`transition-colors border-b border-gray-100 last:border-0 ${
          index % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'
        } hover:bg-gray-100`}
      >
        {/* Manufacturer Name */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4 whitespace-nowrap">
          <div>
            <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm font-medium text-[#1F2937] leading-tight sm:leading-snug">
              {displayValue(manufacturer.name)}
            </div>
          </div>
        </td>

        {/* Email */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm text-[#515151] leading-tight sm:leading-snug">
            {displayValue(manufacturer.email)}
          </div>
        </td>

        {/* Contact Number */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm text-[#515151] leading-tight sm:leading-snug">
            {displayValue(manufacturer.contactNumber)}
          </div>
        </td>

        {/* Location */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm text-[#515151] leading-tight sm:leading-snug">
            {displayValue(manufacturer.location)}
          </div>
        </td>

        {/* Status */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <span
            className={`inline-block px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs md:text-sm font-medium leading-tight ${
              manufacturer.status === 'active'
                ? 'bg-[#DCFCE7] text-[#1D8C1D]'
                : 'bg-[#E3E3E3] text-gray-600'
            }`}
          >
            {manufacturer.status === 'active' ? 'Active' : 'Disabled'}
          </span>
        </td>

        {/* Jobs Received */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4 text-center">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm font-medium text-[#515151] leading-tight sm:leading-snug">
            {manufacturer.jobsReceived ?? 'N/A'}
          </div>
        </td>

        {/* Quotes Submitted */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4 text-center">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm font-medium text-[#515151] leading-tight sm:leading-snug">
            {manufacturer.quotesSubmitted ?? 'N/A'}
          </div>
        </td>

        {/* Joined Date */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <div className="text-[11px] sm:text-xs md:text-sm lg:text-sm xl:text-[15px] text-[#373737] leading-tight sm:leading-snug">
            {displayValue(manufacturer.joinedDate)}
          </div>
        </td>

        {/* Actions */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => onViewClick(manufacturer)}
              className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer p-1 sm:p-1.5"
              title="View Details"
            >
              <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
            </button>

            <div className="w-px h-4 sm:h-5 bg-gray-300"></div>

            <button
              onClick={() => onStatusToggle(manufacturer.id)}
              className={`text-[10px] sm:text-xs md:text-sm font-medium transition-colors cursor-pointer leading-tight ${
                manufacturer.status === 'active'
                  ? 'text-[#D8201D] hover:text-red-700'
                  : 'text-[#22A121] hover:text-green-700'
              }`}
            >
              {manufacturer.status === 'active' ? 'Disable' : 'Enable'}
            </button>
          </div>
        </td>
      </tr>
    ))
  )}
</tbody>
        </table>
      </div>
    </div>
  );
};

export default ManufacturerTable;
