import React from 'react';
import { Eye, Trash2 } from 'lucide-react';

export interface Retailer {
  id: string;
  name: string;
  retailerId: string;
  email: string;
  contactNumber: string;
  status: 'active' | 'disabled';
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  associatedManufacturers: number;
  subscriptionAmount: number | null;
  joinedDate: string;
}

interface RetailerTableProps {
  retailers: Retailer[];
  onStatusToggle: (id: string) => void;
  onViewClick: (retailer: Retailer) => void;
  onDeleteClick: (retailer: Retailer) => void;
}

const RetailerTable: React.FC<RetailerTableProps> = ({
  retailers,
  onStatusToggle,
  onViewClick,
  onDeleteClick
}) => {

  const displayValue = (value?: string | null) => {
  return value?.toString().trim() ? value : 'N/A';
};

  return (
    <div className="w-full">
      {/* Table View - Responsive with horizontal scroll */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-[#F1F1F1] truncate">
            <tr>
              <th className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide rounded-tl-lg leading-tight">
                Retailers Name
              </th>
              <th className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Retailer Id
              </th>
              <th className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Email
              </th>
              <th className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Contact Number
              </th>
              <th className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Status
              </th>
              <th className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-center text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Total Requests
              </th>
              <th className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-center text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Subscription
              </th>
              <th className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide leading-tight">
                Joined Date
              </th>
              <th className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#6B7280] tracking-wide rounded-tr-lg leading-tight">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
  {retailers.length === 0 ? (
    <tr>
      <td colSpan={9} className="px-5 py-10">
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8">
          <div className="text-sm font-semibold text-gray-800">
            No retailers to show
          </div>
          <div className="text-xs text-gray-500">
            Try adjusting your search or filters.
          </div>
        </div>
      </td>
    </tr>
  ) : (
    retailers.map((retailer, index) => (
      <tr
        key={retailer.id}
        className={`transition-colors border-b border-gray-100 last:border-0 ${
          index % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'
        } hover:bg-gray-100`}
      >
        {/* Retailer Name */}
        <td className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-4 whitespace-nowrap">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm font-medium text-[#1F2937] leading-tight sm:leading-snug">
            {displayValue(retailer.name)}
          </div>
        </td>

        {/* Retailer ID */}
        <td className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-4">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm text-[#515151] leading-tight sm:leading-snug">
            {displayValue(retailer.retailerId)}
          </div>
        </td>

        {/* Email */}
        <td className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-4">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm text-[#515151] leading-tight sm:leading-snug">
            {displayValue(retailer.email)}
          </div>
        </td>

        {/* Contact Number */}
        <td className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-4">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm text-[#515151] leading-tight sm:leading-snug">
            {displayValue(retailer.contactNumber)}
          </div>
        </td>

        {/* Status */}
        <td className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-4">
          <span
            className={`inline-block px-1.5 sm:px-2 md:px-2.5 lg:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium ${
              retailer.status === 'active'
                ? 'bg-[#DCFCE7] text-[#1D8C1D]'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {retailer.status === 'active' ? 'Active' : 'Disabled'}
          </span>
        </td>

        {/* Total Requests */}
        <td className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-4 text-center">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm font-medium text-[#515151] leading-tight sm:leading-snug">
            {retailer.totalRequests ?? 'N/A'}
          </div>
        </td>

        {/* Subscription amount */}
        <td className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-4 text-center">
          {retailer.subscriptionAmount != null ? (
            <span className="inline-block px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#1D8C1D] text-[10px] sm:text-[11px] md:text-xs font-semibold whitespace-nowrap">
              ${retailer.subscriptionAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-[10px] sm:text-[11px] md:text-xs text-[#B0B0B0]">—</span>
          )}
        </td>

        {/* Joined Date */}
        <td className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-4">
          <div className="text-[10px] sm:text-xs md:text-sm lg:text-sm xl:text-[15px] text-[#373737] leading-tight sm:leading-snug">
            {displayValue(retailer.joinedDate)}
          </div>
        </td>

        {/* Actions */}
        <td className="px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => onViewClick(retailer)}
              className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              title="View Details"
            >
              <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
            </button>

            <div className="w-px h-4 sm:h-5 bg-gray-300"></div>

            <button
              onClick={() => onStatusToggle(retailer.id)}
              className={`text-[10px] sm:text-xs md:text-sm font-medium transition-colors cursor-pointer ${
                retailer.status === 'active'
                  ? 'text-[#DC2626] hover:text-red-700'
                  : 'text-[#22A121] hover:text-green-700'
              }`}
            >
              {retailer.status === 'active' ? 'Disable' : 'Enable'}
            </button>

            <div className="w-px h-4 sm:h-5 bg-gray-300"></div>

            <button
              onClick={() => onDeleteClick(retailer)}
              className="text-[#DC2626] hover:text-red-700 transition-colors cursor-pointer"
              title="Delete Retailer"
            >
              <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
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

export default RetailerTable;
