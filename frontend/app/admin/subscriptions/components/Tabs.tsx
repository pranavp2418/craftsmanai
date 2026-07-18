"use client";

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Tag,
  Store,
  BarChart3,
  Activity,
  UserX,
  History,
  CreditCard
} from 'lucide-react';

type TabItem = {
  label: string;
  icon: React.ElementType;
};

type TabsProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

const TABS: TabItem[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Plan & Top-Up Management', icon: Tag },
  { label: 'Retailer Subscriptions', icon: Store },
  { label: 'Usage Insights', icon: Activity },
  { label: 'Cancellation Insights', icon: UserX },
  { label: 'Billing History', icon: History },
  // { label: 'Payments', icon: CreditCard },
  { label: 'Activity Logs', icon: History },
];

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
  return (
    <div className="bg-transparent overflow-hidden">
      <div className="flex items-center [box-shadow:0px_1px_2px_0px_#0000000D] overflow-x-auto no-scrollbar flex-nowrap border border-[#E5E7EB] rounded-2xl bg-white">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.label;
          const Icon = tab.icon;

          return (
            <button
              key={tab.label}
              onClick={() => onTabChange(tab.label)}
              className={`flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium transition-all duration-200 border-b-[3px] whitespace-nowrap flex-shrink-0 ${isActive
                ? 'bg-[#EBF3FE] text-[#2F68C5] border-[#2F68C5]'
                : 'text-[#6B7280] border-transparent hover:text-gray-900 hover:bg-gray-100/50'
                }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors duration-200 ${isActive ? 'text-[#2F68C5]' : 'text-[#9CA3AF]'
                  }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

