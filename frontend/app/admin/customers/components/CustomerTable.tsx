import React from 'react';
import { Eye } from 'lucide-react';

export interface Customer {
  id: string;
  name: string;
  customerId: string;
  email: string;
  phone: string;
  location: string;
  status: string;
  createdAt: string;
  associatedRetailers: string;
  retailer: { id: string; name: string; email: string };
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  lastActivity: string;
}

interface CustomerTableProps {
  customers: Customer[];
  onViewClick: (customer: Customer) => void;
}

const CustomerTable: React.FC<CustomerTableProps> = ({ 
  customers,
  onViewClick
}) => {


            const getInitials = (name?: string | null) => {
  if (!name?.trim()) return 'NA';

  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

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
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#1E1E1E] tracking-wide rounded-tl-lg leading-tight">
                Customer Name
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#1E1E1E] tracking-wide leading-tight">
                Email
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#1E1E1E] tracking-wide leading-tight">
                Associated Retailers
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-center text-xs md:text-sm font-medium text-[#1E1E1E] tracking-wide leading-tight">
                Total Orders
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-center text-xs md:text-sm font-medium text-[#1E1E1E] tracking-wide leading-tight">
                Active Order
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#1E1E1E] tracking-wide leading-tight">
                Last Activity
              </th>
              <th className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2.5 md:py-3 lg:py-3.5 text-left text-xs md:text-sm font-medium text-[#1E1E1E] tracking-wide rounded-tr-lg leading-tight">
                Actions
              </th>
            </tr>
          </thead>

<tbody className="bg-white">
  {customers.length === 0 ? (
    <tr>
      <td colSpan={7} className="px-5 py-10">
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8">
          <div className="text-sm font-semibold text-gray-800">
            No customers to show
          </div>
          <div className="text-xs text-gray-500">
            Try adjusting your search or filters.
          </div>
        </div>
      </td>
    </tr>
  ) : (
    customers.map((customer, index) => (
      <tr
        key={customer.id}
        className={`transition-colors border-b border-gray-100 last:border-0 ${
          index % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'
        } hover:bg-gray-100`}
      >
        {/* Customer Name */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4 whitespace-nowrap">
          <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-full bg-[#0061FF94] flex items-center justify-center text-white font-medium text-[10px] sm:text-[11px] md:text-xs lg:text-sm">
              {getInitials(customer.name)}
            </div>
            <div>
              <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm font-medium text-[#1F2937] leading-tight sm:leading-snug">
                {displayValue(customer.name)}
              </div>
            </div>
          </div>
        </td>

        {/* Email */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm text-[#515151] leading-tight sm:leading-snug">
            {displayValue(customer.email)}
          </div>
        </td>

        {/* Associated Retailers */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm text-[#515151] leading-tight sm:leading-snug">
            {displayValue(customer.associatedRetailers)}
          </div>
        </td>

        {/* Total Orders */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4 text-center">
          <div className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm font-medium text-[#515151] leading-tight sm:leading-snug">
            {customer.totalOrders ?? 'N/A'}
          </div>
        </td>

        {/* Active Orders */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4 text-center">
          <div
            className={`text-[11px] sm:text-xs md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug ${
              customer.status === 'ACTIVE'
                ? 'text-[#22A121]'
                : 'text-[#6B7280]'
            }`}
          >
            {customer.activeOrders ?? 'N/A'}
          </div>
        </td>

        {/* Last Activity */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <div className="text-[11px] sm:text-xs md:text-sm lg:text-sm xl:text-base text-[#373737] leading-tight sm:leading-snug">
            {customer.lastActivity
              ? new Date(customer.lastActivity).toLocaleDateString(
                  'en-US',
                  {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  }
                )
              : 'N/A'}
          </div>
        </td>

        {/* Actions */}
        <td className="px-2.5 sm:px-3 md:px-4 lg:px-5 py-2.5 sm:py-3 md:py-3.5 lg:py-4">
          <button
            onClick={() => onViewClick(customer)}
            className="p-1.5 sm:p-2 md:p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
          </button>
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

export default CustomerTable;
