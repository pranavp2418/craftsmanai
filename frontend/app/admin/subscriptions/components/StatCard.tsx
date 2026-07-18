"use client";

import React from 'react';

type Props = {
  title: string;
  value: string | number;
  change?: string;
  changeTone?: 'auto' | 'success' | 'danger';
  loading?: boolean;
  icon?: React.ReactNode;
};

export default function StatCard({ title, value, change, changeTone = 'auto', loading, icon }: Props) {
  const shouldShowDanger =
    changeTone === 'danger' || (changeTone === 'auto' && change?.startsWith('-'));

  return (
    <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 flex items-center justify-center">
          {icon}
        </div>
        {change && (
          <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${shouldShowDanger ? 'text-[#EF4444] bg-[#FEF2F2]' : 'text-[#22C55E] bg-[#F0FDF4]'
            }`}>
            {change}
          </div>
        )}
      </div>

      <div className="mt-auto">
        <div className="text-xl sm:text-2xl font-bold text-[#111827] leading-tight mb-1">
          {loading ? '—' : value}
        </div>
        <div className="text-[12px] sm:text-sm font-normal text-[#6B7280] sm:whitespace-nowrap">
          {title}
        </div>
      </div>
    </div>
  );
}
