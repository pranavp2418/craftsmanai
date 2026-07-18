'use client';

import React from 'react';
import { Eye } from 'lucide-react';

export interface ActivityRecord {
  id: string;
  timestamp: string;
  actorType: 'Retailer' | 'Customer' | 'Manufacturer' | 'System' | 'Admin';
  actor: string;
  action: string;
  referenceId: string;
}

interface RecentActivityTableProps {
  activities: ActivityRecord[];
  onViewDetails?: (activity: ActivityRecord) => void;
}

const actorTypeConfig: Record<
  ActivityRecord['actorType'],
  { badgeClass: string }
> = {
  Retailer: { badgeClass: 'bg-[#DCFCE7] text-[#16A34A]' },
  Customer: { badgeClass: 'bg-[#DBEAFE] text-[#2563EB]' },
  Manufacturer: { badgeClass: 'bg-[#FFECD1] text-[#F89402]' },
  System: { badgeClass: 'bg-[#F1F1F1] text-[#6B7280]' },
  Admin: { badgeClass: 'bg-[#F3E8FF] text-[#9333EA]' },
};

const RecentActivityTable: React.FC<RecentActivityTableProps> = ({
  activities,
  onViewDetails,
}) => {
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <table className="w-full min-w-[900px]">
        <thead className="sticky top-0 z-0 truncate">
          <tr className="bg-[#F1F1F1] text-[#6D6D6D] border-b border-gray-200">
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Timestamp
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Actor Type
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Actor
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Action
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-left text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Reference ID
            </th>
            <th className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 text-center text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-semibold leading-tight sm:leading-snug">
              Details
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 truncate">
          {activities.map((activity) => {
            const config = actorTypeConfig[activity.actorType];
            return (
              <tr
                key={activity.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {activity.timestamp}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span
                    className={`inline-flex items-center px-1.5 sm:px-2 md:px-2.5 lg:px-2.5 xl:px-3 py-0.5 sm:py-0.5 md:py-1 lg:py-0.5 xl:py-1 rounded-full text-[10px] sm:text-xs md:text-xs lg:text-xs xl:text-sm font-medium whitespace-nowrap leading-tight ${config.badgeClass}`}
                  >
                    {activity.actorType}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-medium text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {activity.actor}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {activity.action}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5">
                  <span className="text-xs sm:text-sm md:text-sm lg:text-sm xl:text-base font-medium text-gray-900 leading-tight sm:leading-snug md:leading-normal">
                    {activity.referenceId}
                  </span>
                </td>
                <td className="px-2.5 sm:px-3 md:px-4 lg:px-4 xl:px-6 py-2.5 sm:py-3 md:py-3.5 lg:py-4 xl:py-4.5 text-center">
                  <button
                    onClick={() => onViewDetails?.(activity)}
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

export default RecentActivityTable;
