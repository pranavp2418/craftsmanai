'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { useAppSelector } from '@/redux/hooks';

const formatDateLabel = (dateVal: string | number | undefined) => {
  if (!dateVal) return '';
  const dateStr = String(dateVal);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const monthMap: Record<string, string> = {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
      '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    };
    const month = monthMap[parts[1]] || parts[1];
    const day = parseInt(parts[2], 10);
    return `${month} ${day}`;
  }
  return dateStr;
};

const RequestsOverTimeChart: React.FC = () => {
  const { data, loading } = useAppSelector((s) => s.adminRequestsOverTime);

  const shimmerHeights = ['h-[45%]', 'h-[70%]', 'h-[55%]', 'h-[85%]', 'h-[65%]', 'h-[90%]', 'h-[75%]'];

  const RequestsTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-md border border-[#E5E7EB] dark:border-border-default bg-white dark:bg-surface-150 px-3 py-2 text-[12px] text-black dark:text-ink shadow-sm">
        <div className="font-semibold text-[#111827] dark:text-ink">{formatDateLabel(label || '')}</div>
        <div className="text-[#6B7280] dark:text-ink-600">Requests: {payload[0]?.value}</div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-surface-100 border border-gray-200 dark:border-border-default rounded-2xl p-4 sm:p-6 shadow-sm">
      <h3 className="text-[#373737] dark:text-ink text-base sm:text-lg font-medium mb-4">
        Requests Created Over Time
      </h3>

      {loading ? (
        /* Shimmer skeleton */
        <div className="w-full h-[250px] sm:h-[300px] flex flex-col justify-end gap-3 px-2 animate-pulse">
          {/* Y-axis + bars area */}
          <div className="flex items-end gap-2 h-full">
            {shimmerHeights.map((heightClass, i) => (
              <div key={i} className={`flex-1 rounded-t-md bg-gray-200 dark:bg-surface-150 ${heightClass}`} />
            ))}
          </div>
          {/* X-axis shimmer */}
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 h-3 rounded bg-gray-200 dark:bg-surface-150" />
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="w-[600px] sm:w-full h-[250px] sm:h-[300px] min-w-0 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--ink-500)', fontSize: 10 }}
                  tickLine={false}
                  tickFormatter={formatDateLabel}
                  minTickGap={15}
                />
                <YAxis
                  tick={{ fill: 'var(--ink-500)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<RequestsTooltip />} />
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke="#2F68C5"
                  strokeWidth={2}
                  dot={{ fill: '#2F68C5', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center mt-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full text-[#2F68C5]">
            <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-hidden="true" focusable="false">
              <g clipPath="url(#clip0_465_5714)">
                <path d="M0 6.99996H4.66667M4.66667 6.99996C4.66667 6.38112 4.9125 5.78763 5.35008 5.35004C5.78767 4.91246 6.38116 4.66663 7 4.66663C7.61884 4.66663 8.21233 4.91246 8.64992 5.35004C9.0875 5.78763 9.33333 6.38112 9.33333 6.99996M4.66667 6.99996C4.66667 7.6188 4.9125 8.21229 5.35008 8.64988C5.78767 9.08746 6.38116 9.33329 7 9.33329C7.61884 9.33329 8.21233 9.08746 8.64992 8.64988C9.0875 8.21229 9.33333 7.6188 9.33333 6.99996M9.33333 6.99996H14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
              <defs>
                <clipPath id="clip0_465_5714">
                  <rect width="14" height="14" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </div>
          <span className="text-sm text-[#2F68C5]">Requests</span>
        </div>
      </div>
    </div>
  );
};

export default RequestsOverTimeChart;
