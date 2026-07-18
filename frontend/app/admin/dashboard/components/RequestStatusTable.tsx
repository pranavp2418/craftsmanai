'use client';

import React from 'react';
import { Eye, CircleCheck } from 'lucide-react';

export type RequestStatus =
  | 'Awaiting Customer Approval'
  | 'Customer Approved'
  | 'Generated'
  | 'Quotation in Progress'
  | 'Quote Requested'
  | 'Production Completed'
  | 'In Production'
  | 'Manufacturer Approved'
  | 'Refinement Requested'
  | 'Detected';

export interface RequestStatusRecord {
  id: string;
  requestId: string;
  jewelleryType: string;
  currentStatus: RequestStatus;
  retailer: string;
  customer: string;
  createdDate: string;
  lastUpdated?: string;
}

interface RequestStatusTableProps {
  requests: RequestStatusRecord[];
  onViewDetails?: (request: RequestStatusRecord) => void;
}

const statusConfig: Record<
  RequestStatus,
  { badgeClass: string; icon?: React.ReactNode }
> = {
  'Awaiting Customer Approval': { badgeClass: 'bg-[#DCFCE7] text-[#16A34A]' },
  'Customer Approved': { badgeClass: 'bg-[#DCFCE7] text-[#16A34A]' },
  'Generated': { badgeClass: 'bg-[#FFECD1] text-[#F89402]' },
  'Quotation in Progress': { badgeClass: 'bg-[#FFECD1] text-[#F89402]' },
  'Quote Requested': { badgeClass: 'bg-[#FFECD1] text-[#F89402]' },
  'Production Completed': {
    badgeClass: 'bg-[#DBEAFE] text-[#2563EB]',
    icon: <CircleCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />,
  },
  'In Production': { badgeClass: 'bg-[#DBEAFE] text-[#2563EB]' },
  'Manufacturer Approved': { badgeClass: 'bg-[#DCFCE7] text-[#16A34A]' },
  'Refinement Requested': { badgeClass: 'bg-[#FEE2E2] text-[#DC2626]' },
  'Detected': { badgeClass: 'bg-[#F3E8FF] text-[#7C3AED]' },
};

const RequestStatusTable: React.FC<RequestStatusTableProps> = ({
  requests,
  onViewDetails,
}) => {
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <table className="w-full min-w-[1200px]">
        <thead className="sticky top-0 z-0 truncate">
          <tr className="bg-[#F1F1F1] text-[#6D6D6D] border-b border-gray-200">
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Request ID
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Jewelery Type
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Current Status
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Retailer
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Customer
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Created Date
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Completed Date & time
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-center text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Details
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 truncate">
          {requests.map((request) => {
            const config = statusConfig[request.currentStatus];
            return (
              <tr
                key={request.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-medium text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {request.requestId}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {request.jewelleryType}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span
                    className={`inline-flex items-center gap-0.5 sm:gap-1 md:gap-1 lg:gap-1 xl:gap-1.5 px-1.5 sm:px-2 md:px-2.5 lg:px-2.5 xl:px-3 py-0.5 sm:py-0.5 md:py-1 lg:py-0.5 xl:py-1 rounded-full text-[10px] sm:text-xs md:text-xs lg:text-xs xl:text-sm font-medium whitespace-nowrap leading-tight ${config.badgeClass}`}
                  >
                    {config.icon && config.icon}
                    {request.currentStatus}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-medium text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {request.retailer}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-medium text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {request.customer}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {request.createdDate}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {request.lastUpdated || '-'}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5 text-center">
                  <button
                    onClick={() => onViewDetails?.(request)}
                    className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label="View details"
                  >
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4.5 md:h-4.5 lg:w-5 lg:h-5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RequestStatusTable;
