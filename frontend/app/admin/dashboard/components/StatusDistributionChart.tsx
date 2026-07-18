'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { useAppSelector } from '@/redux/hooks';

const formatStatusLabel = (statusVal: string | number | undefined) => {
  if (!statusVal) return '';
  const status = String(statusVal);
  return status
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const StatusDistributionChart: React.FC = () => {
  const { data, loading } = useAppSelector((s) => s.adminStatusDistribution);

  const shimmerHeights = ['h-[60%]', 'h-[90%]', 'h-[50%]', 'h-[35%]', 'h-[75%]'];

  const StatusTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-md border border-[#E5E7EB] dark:border-border-default bg-white dark:bg-surface-150 px-3 py-2 text-[12px] text-black dark:text-ink shadow-sm">
        <div className="font-semibold text-[#111827] dark:text-ink">{formatStatusLabel(label || '')}</div>
        <div className="text-[#6B7280] dark:text-ink-600">Count: {payload[0]?.value}</div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-surface-100 border border-gray-200 dark:border-border-default rounded-2xl p-4 sm:p-6 shadow-sm">
      <h3 className="text-[#373737] dark:text-ink text-base sm:text-lg font-medium mb-4">
        Request Status Distribution
      </h3>

      {loading ? (
        /* Shimmer skeleton */
        <div className="w-full h-[250px] sm:h-[300px] flex flex-col justify-end gap-3 px-2 animate-pulse">
          <div className="flex items-end gap-3 h-full">
            {shimmerHeights.map((heightClass, i) => (
              <div key={i} className={`flex-1 rounded-t-md bg-gray-200 dark:bg-surface-150 ${heightClass}`} />
            ))}
          </div>
          <div className="flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 h-3 rounded bg-gray-200 dark:bg-surface-150" />
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="w-[600px] sm:w-full h-[250px] sm:h-[300px] min-w-0 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis
                  dataKey="status"
                  tick={{ fill: 'var(--ink-500)', fontSize: 10 }}
                  tickLine={false}
                  tickFormatter={formatStatusLabel}
                  minTickGap={10}
                />
                <YAxis
                  tick={{ fill: 'var(--ink-500)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<StatusTooltip />} />
                <Bar dataKey="count" fill="#2F68C5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#2F68C5]"></div>
          <span className="text-sm text-[#2F68C5]">Requests</span>
        </div>
      </div>
    </div>
  );
};

export default StatusDistributionChart;
