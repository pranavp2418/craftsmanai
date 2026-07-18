"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/src/components/app-layout';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchSubscriptionStats } from '@/redux/slices/admin/subscriptions/adminSubscriptionStatsSlice';
import { fetchSubscriptionGrowth } from '@/redux/slices/admin/subscriptions/adminSubscriptionGrowthSlice';
import { fetchPlanDistribution } from '@/redux/slices/admin/subscriptions/adminPlanDistributionSlice';
import { fetchRevenueGrowth } from '@/redux/slices/admin/subscriptions/adminRevenueGrowthSlice';
import StatCard from './components/StatCard';
import SubsGrowthChart from './components/SubsGrowthChart';
import RevenueGrowthChart from './components/RevenueGrowthChart';
import PlanPieChart from './components/PlanPieChart';
import PlanManagement from './components/PlanManagement';
import RetailerSubscriptions from './components/RetailerSubscriptions';
import UsageInsights from './components/UsageInsights';
import CancellationInsights from './components/CancellationInsights';
import BillingHistory from './components/BillingHistory';
import PaymentSettings from './components/PaymentSettings';
import ActivityLogs from './components/ActivityLogs';
import Tabs from './components/Tabs';

export default function SubscriptionsPage() {
  const dispatch = useAppDispatch();
  const { stats, loading: statsLoading } = useAppSelector((state) => state.adminSubscriptionStats);
  const { data: subsGrowthData, loading: subsLoading } = useAppSelector((state) => state.adminSubscriptionGrowth);
  const { data: planDistributionData, loading: planLoading } = useAppSelector((state) => state.adminPlanDistribution);
  const { data: revenueGrowthDataState, loading: revenueLoading } = useAppSelector((state) => state.adminRevenueGrowth);

  const [activeTab, setActiveTab] = useState('Overview');
  const [timeFilter, setTimeFilter] = useState('7days');

  const timeOptions = [
    { label: 'Last 7 days', value: '7days' },
    { label: 'Last 30 days', value: '30days' },
    { label: 'Last 90 days', value: '90days' },
    { label: 'Last 12 months', value: '12months' },
  ];

  const hasFetchedStats = useRef<string | null>(null);
  const hasFetchedSubsGrowth = useRef(false);
  const hasFetchedPlanDist = useRef(false);
  const hasFetchedRevenueGrowth = useRef(false);

  useEffect(() => {
    if (hasFetchedStats.current !== timeFilter) {
      dispatch(fetchSubscriptionStats(timeFilter));
      hasFetchedStats.current = timeFilter;
    }
  }, [dispatch, timeFilter]);

  useEffect(() => {
    if (!hasFetchedSubsGrowth.current) {
      dispatch(fetchSubscriptionGrowth());
      hasFetchedSubsGrowth.current = true;
    }
    if (!hasFetchedPlanDist.current) {
      dispatch(fetchPlanDistribution());
      hasFetchedPlanDist.current = true;
    }
    if (!hasFetchedRevenueGrowth.current) {
      dispatch(fetchRevenueGrowth());
      hasFetchedRevenueGrowth.current = true;
    }
  }, [dispatch]);

  const formatCurrency = (amount: number, compact = false) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 2 : 0,
    }).format(amount);
  };

  const formatTrend = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value}%`;
  };

  const formatRate = (value: number) => {
    return `${Number(value || 0).toFixed(1)}%`;
  };

  const kpis = [
    {
      label: 'Monthly Recurring Revenue',
      value: formatCurrency(stats?.mrr || 0),
      change: formatTrend(stats?.trends.mrr || 0),
      iconKey: 'mrr' as const,
      changeTone: 'success' as const,
    },
    {
      label: 'Annual Recurring Revenue',
      value: formatCurrency(stats?.arr || 0),
      change: formatTrend(stats?.trends.arr || 0),
      iconKey: 'arr' as const,
      changeTone: 'success' as const,
    },
    {
      label: 'Active Subscriptions',
      value: stats?.active_subscriptions || 0,
      change: formatTrend(stats?.trends.active_subscriptions || 0),
      iconKey: 'activeSubs' as const,
      changeTone: 'success' as const,
    },
    {
      label: 'New Subscriptions',
      value: stats?.new_subscriptions || 0,
      change: formatTrend(stats?.trends.new_subscriptions || 0),
      iconKey: 'newSubs' as const,
      changeTone: 'success' as const,
    },
    {
      label: 'Churn Rate',
      value: formatRate(stats?.churn_rate || 0),
      change: formatTrend(stats?.trends.churn_rate || 0),
      iconKey: 'churn' as const,
      changeTone: (stats?.trends.churn_rate || 0) > 0 ? 'danger' as const : 'success' as const,
    },
    {
      label: 'Total Platform Revenue',
      value: formatCurrency(stats?.total_revenue || 0, true),
      change: formatTrend(stats?.trends.total_revenue || 0),
      iconKey: 'totalRevenue' as const,
      changeTone: 'success' as const,
    },
  ];


  const mappedSubsGrowthData = (subsGrowthData || []).map(point => ({
    month: point.month,
    churned: point.churned,
    newSubs: point.new
  }));

  const mappedPlanData = (planDistributionData || []).map(point => ({
    name: point.plan,
    value: point.retailers,
    percentage: point.percentage
  }));

  const mappedRevenueGrowthData = (revenueGrowthDataState || []).map(point => ({
    month: point?.month ?? 'N/A',
    revenue: typeof point?.revenue === 'number' ? point.revenue : 0
  }));

  const icons = {
    mrr: (
      <div className="w-10 h-10 rounded-[10px] bg-[#EFF6FF] flex items-center justify-center">
        <svg width="19" height="28" viewBox="0 0 19 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.00801 21.5C8.02796 21.5 7.09115 21.305 6.19757 20.915C5.34243 20.535 4.58097 19.9975 3.91319 19.3025C3.24541 18.6075 2.72896 17.815 2.36385 16.925C1.98912 15.995 1.80176 15.02 1.80176 14C1.80176 12.98 1.98912 12.005 2.36385 11.075C2.72896 10.185 3.24541 9.3925 3.91319 8.6975C4.58097 8.0025 5.34243 7.465 6.19757 7.085C7.09115 6.695 8.02796 6.5 9.00801 6.5C9.98806 6.5 10.9249 6.695 11.8184 7.085C12.6736 7.465 13.435 8.0025 14.1028 8.6975C14.7706 9.3925 15.2871 10.185 15.6522 11.075C16.0269 12.005 16.2143 12.98 16.2143 14C16.2143 15.02 16.0269 15.995 15.6522 16.925C15.2871 17.815 14.7706 18.6075 14.1028 19.3025C13.435 19.9975 12.6736 20.535 11.8184 20.915C10.9249 21.305 9.98806 21.5 9.00801 21.5ZM9.00801 20C10.0553 20 11.0258 19.725 11.9193 19.175C12.7841 18.645 13.4711 17.93 13.9803 17.03C14.5088 16.1 14.773 15.09 14.773 14C14.773 12.91 14.5088 11.9 13.9803 10.97C13.4711 10.07 12.7841 9.355 11.9193 8.825C11.0258 8.275 10.0553 8 9.00801 8C7.9607 8 6.99026 8.275 6.09668 8.825C5.23193 9.355 4.54494 10.07 4.0357 10.97C3.50724 11.9 3.24301 12.91 3.24301 14C3.24301 15.09 3.50724 16.1 4.0357 17.03C4.54494 17.93 5.23193 18.645 6.09668 19.175C6.99026 19.725 7.9607 20 9.00801 20ZM6.48582 15.5H10.4493C10.5453 15.5 10.6294 15.4625 10.7015 15.3875C10.7735 15.3125 10.8096 15.225 10.8096 15.125C10.8096 15.025 10.7735 14.9375 10.7015 14.8625C10.6294 14.7875 10.5453 14.75 10.4493 14.75H7.56676C7.24007 14.75 6.93981 14.665 6.66598 14.495C6.39214 14.325 6.17355 14.0975 6.01021 13.8125C5.84687 13.5275 5.7652 13.215 5.7652 12.875C5.7652 12.535 5.84687 12.2225 6.01021 11.9375C6.17355 11.6525 6.39214 11.425 6.66598 11.255C6.93981 11.085 7.24007 11 7.56676 11H8.28738V9.5H9.72863V11H11.5302V12.5H7.56676C7.47067 12.5 7.3866 12.5375 7.31454 12.6125C7.24248 12.6875 7.20645 12.775 7.20645 12.875C7.20645 12.975 7.24248 13.0625 7.31454 13.1375C7.3866 13.2125 7.47067 13.25 7.56676 13.25H10.4493C10.7759 13.25 11.0762 13.335 11.35 13.505C11.6239 13.675 11.8425 13.9025 12.0058 14.1875C12.1691 14.4725 12.2508 14.785 12.2508 15.125C12.2508 15.465 12.1691 15.7775 12.0058 16.0625C11.8425 16.3475 11.6239 16.575 11.35 16.745C11.0762 16.915 10.7759 17 10.4493 17H9.72863V18.5H8.28738V17H6.48582V15.5Z" fill="#2563EB"/>
        </svg>
      </div>
    ),
    arr: (
      <div className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.44125 0V12H12.9712V13.5H0V0H1.44125ZM12.4668 2.475L13.4901 3.525L9.36812 7.815L7.20625 5.565L4.12197 8.775L3.09869 7.725L7.20625 3.435L9.36812 5.685L12.4668 2.475Z" fill="#4F46E5"/>
        </svg>
      </div>
    ),
    activeSubs: (
      <div className="w-10 h-10 rounded-[10px] bg-[#F0FDF4] flex items-center justify-center">
        <svg width="14" height="17" viewBox="0 0 14 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.765 9.7493V11.2493C4.98672 11.2493 4.2613 11.4543 3.58871 11.8643C2.93535 12.2643 2.4165 12.7993 2.03216 13.4693C1.63822 14.1693 1.44125 14.9293 1.44125 15.7493H0C0 14.6593 0.264229 13.6493 0.792687 12.7193C1.30193 11.8093 1.98892 11.0893 2.85367 10.5593C3.74725 10.0193 4.71769 9.7493 5.765 9.7493ZM5.765 8.9993C4.98672 8.9993 4.2613 8.7943 3.58871 8.3843C2.93535 7.9843 2.4165 7.4443 2.03216 6.7643C1.63822 6.0643 1.44125 5.3068 1.44125 4.4918C1.44125 3.6768 1.63822 2.9193 2.03216 2.2193C2.4165 1.5493 2.93535 1.0143 3.58871 0.614296C4.2613 0.204296 4.98913 -0.000703812 5.77221 -0.000703812C6.55529 -0.000703812 7.28312 0.204296 7.9557 0.614296C8.59946 1.0143 9.1135 1.5493 9.49784 2.2193C9.89178 2.9193 10.0887 3.6768 10.0887 4.4918C10.0887 5.3068 9.89178 6.0643 9.49784 6.7643C9.1135 7.4443 8.59946 7.9843 7.9557 8.3843C7.28312 8.7943 6.55288 8.9993 5.765 8.9993ZM5.765 7.4993C6.28385 7.4993 6.76427 7.3643 7.20625 7.0943C7.64823 6.8243 7.99894 6.4593 8.25836 5.9993C8.51779 5.5393 8.6475 5.0393 8.6475 4.4993C8.6475 3.9593 8.51779 3.4593 8.25836 2.9993C7.99894 2.5393 7.64823 2.1743 7.20625 1.9043C6.76427 1.6343 6.28385 1.4993 5.765 1.4993C5.24615 1.4993 4.76573 1.6343 4.32375 1.9043C3.88177 2.1743 3.53106 2.5393 3.27164 2.9993C3.01221 3.4593 2.8825 3.9593 2.8825 4.4993C2.8825 5.0393 3.01221 5.5393 3.27164 5.9993C3.53106 6.4593 3.88177 6.8243 4.32375 7.0943C4.76573 7.3643 5.24615 7.4993 5.765 7.4993ZM10.0887 15.3743L7.97011 16.5293L8.37366 14.0693L6.65858 12.3443L9.03664 11.9843L10.0887 9.7493L11.1553 11.9843L13.5189 12.3443L11.8038 14.0693L12.2074 16.5293L10.0887 15.3743Z" fill="#16A34A"/>
        </svg>
      </div>
    ),
    newSubs: (
      <div className="w-10 h-10 rounded-[10px] bg-[#F0FDFA] flex items-center justify-center">
        <svg width="19" height="18" viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.36836 11.07V12.63C8.90716 12.46 8.42674 12.375 7.92711 12.375C7.14883 12.375 6.42341 12.58 5.75082 12.99C5.09746 13.39 4.57861 13.93 4.19427 14.61C3.80033 15.31 3.60336 16.065 3.60336 16.875H2.16211C2.16211 15.785 2.42634 14.775 2.9548 13.845C3.46404 12.945 4.15103 12.23 5.01578 11.7C5.90936 11.15 6.8798 10.875 7.92711 10.875C8.41713 10.875 8.89755 10.94 9.36836 11.07ZM7.92711 10.125C7.13923 10.125 6.4138 9.92 5.75082 9.51C5.09746 9.11 4.57861 8.57 4.19427 7.89C3.80033 7.2 3.60336 6.445 3.60336 5.625C3.60336 4.805 3.80033 4.05 4.19427 3.36C4.57861 2.68 5.09746 2.14 5.75082 1.74C6.4138 1.33 7.13923 1.125 7.92711 1.125C8.71499 1.125 9.44042 1.33 10.1034 1.74C10.7568 2.14 11.2756 2.68 11.6599 3.36C12.0539 4.05 12.2509 4.805 12.2509 5.625C12.2509 6.445 12.0539 7.2 11.6599 7.89C11.2756 8.57 10.7568 9.11 10.1034 9.51C9.44042 9.92 8.71499 10.125 7.92711 10.125ZM7.92711 8.625C8.44596 8.625 8.92638 8.49 9.36836 8.22C9.81034 7.95 10.161 7.585 10.4205 7.125C10.6799 6.665 10.8096 6.165 10.8096 5.625C10.8096 5.085 10.6799 4.585 10.4205 4.125C10.161 3.665 9.81034 3.3 9.36836 3.03C8.92638 2.76 8.44596 2.625 7.92711 2.625C7.40826 2.625 6.92784 2.76 6.48586 3.03C6.04388 3.3 5.69317 3.665 5.43375 4.125C5.17432 4.585 5.04461 5.085 5.04461 5.625C5.04461 6.165 5.17432 6.665 5.43375 7.125C5.69317 7.585 6.04388 7.95 6.48586 8.22C6.92784 8.49 7.40826 8.625 7.92711 8.625ZM12.2509 13.125V10.875H13.6921V13.125H15.854V14.625H13.6921V16.875H12.2509V14.625H10.089V13.125H12.2509Z" fill="#0D9488"/>
        </svg>
      </div>
    ),
    churn: (
      <div className="w-10 h-10 rounded-[10px] bg-[#FEF2F2] flex items-center justify-center">
        <svg width="19" height="18" viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.54121 10.8603V12.4353C9.0704 12.2653 8.58999 12.1803 8.09996 12.1803C7.31208 12.1803 6.58184 12.3853 5.90926 12.7953C5.25589 13.1853 4.74185 13.7203 4.36712 14.4003C3.97318 15.1003 3.77621 15.8603 3.77621 16.6803H2.33496C2.33496 15.5903 2.59439 14.5803 3.11324 13.6503C3.62248 12.7403 4.31428 12.0203 5.18864 11.4903C6.08221 10.9503 7.05265 10.6803 8.09996 10.6803C8.58999 10.6803 9.0704 10.7403 9.54121 10.8603ZM8.09996 9.93031C7.31208 9.93031 6.58184 9.72531 5.90926 9.31531C5.25589 8.91531 4.74185 8.37531 4.36712 7.69531C3.97318 6.99531 3.77621 6.23781 3.77621 5.42281C3.77621 4.60781 3.97318 3.85031 4.36712 3.15031C4.74185 2.47031 5.25589 1.93531 5.90926 1.54531C6.58184 1.13531 7.30968 0.930313 8.09275 0.930313C8.87583 0.930313 9.60366 1.13531 10.2762 1.54531C10.9296 1.93531 11.4485 2.47031 11.8328 3.15031C12.2267 3.85031 12.4237 4.60781 12.4237 5.42281C12.4237 6.23781 12.2267 6.99531 11.8328 7.69531C11.4485 8.37531 10.9296 8.91531 10.2762 9.31531C9.60366 9.72531 8.87824 9.93031 8.09996 9.93031ZM8.09996 8.43031C8.61881 8.43031 9.09923 8.29531 9.54121 8.02531C9.98319 7.75531 10.3339 7.39031 10.5933 6.93031C10.8527 6.47031 10.9825 5.96781 10.9825 5.42281C10.9825 4.87781 10.8527 4.37531 10.5933 3.91531C10.3339 3.45531 9.98319 3.09281 9.54121 2.82781C9.09923 2.56281 8.61641 2.43031 8.09275 2.43031C7.5691 2.43031 7.08628 2.56281 6.6443 2.82781C6.20232 3.09281 5.85401 3.45531 5.59939 3.91531C5.34477 4.37531 5.21746 4.87781 5.21746 5.42281C5.21746 5.96781 5.34477 6.47031 5.59939 6.93031C5.85401 7.39031 6.20232 7.75531 6.6443 8.02531C7.08628 8.29531 7.5715 8.43031 8.09996 8.43031ZM13.1443 13.3653L14.6721 11.7753L15.6809 12.8403L14.1532 14.4303L15.6809 16.0203L14.6721 17.0703L13.1443 15.4803L11.6166 17.0703L10.5933 16.0203L12.121 14.4303L10.5933 12.8403L11.6166 11.7753L13.1443 13.3653Z" fill="#DC2626"/>
        </svg>
      </div>
    ),
    totalRevenue: (
      <div className="w-10 h-10 rounded-[10px] bg-[#F5F3FF] flex items-center justify-center">
        <svg width="19" height="18" viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.80176 15H16.2143V16.5H1.80176V15ZM3.24301 9H4.68426V14.25H3.24301V9ZM6.84613 9H8.28738V14.25H6.84613V9ZM9.72863 9H11.1699V14.25H9.72863V9ZM13.3318 9H14.773V14.25H13.3318V9ZM1.80176 5.25L9.00801 1.5L16.2143 5.25V8.25H1.80176V5.25ZM3.24301 6.18V6.75H14.773V6.18L9.00801 3.18L3.24301 6.18ZM9.00801 6C8.80623 6 8.63568 5.9275 8.49636 5.7825C8.35704 5.6375 8.28738 5.46 8.28738 5.25C8.28738 5.04 8.35704 4.8625 8.49636 4.7175C8.63568 4.5725 8.80623 4.5 9.00801 4.5C9.20978 4.5 9.38033 4.5725 9.51965 4.7175C9.65897 4.8625 9.72863 5.04 9.72863 5.25C9.72863 5.46 9.65897 5.6375 9.51965 5.7825C9.38033 5.9275 9.20978 6 9.00801 6Z" fill="#9333EA"/>
        </svg>
      </div>
    ),
  };

  return (
    <AppLayout
      appName="Craftsman.ai"
      headerTitle="Subscriptions & Billings"
      headerDescription="Manage plans, subscriptions, and billing across the platform."
      notificationCount={0}
    >
      <div className="flex flex-col h-full sm:px-0">
        <div className="mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="w-full">
          {activeTab === 'Overview' && (
            <div className="animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-4 px-1">
                <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Platform Overview</h1>

                <div className="flex items-center bg-white rounded-full p-1 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] border border-gray-100 mt-4 sm:mt-0 overflow-x-auto no-scrollbar max-w-full">
                  {timeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTimeFilter(option.value)}
                      className={`px-4 sm:px-6 py-2 text-[10px] sm:text-xs font-bold rounded-full transition-all duration-300 whitespace-nowrap flex-shrink-0 ${timeFilter === option.value
                        ? 'bg-[#2F68C5] text-white shadow-md'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
                {statsLoading && !stats ? (
                  Array(6).fill(0).map((_, i) => (
                    <div key={i} className="h-32 bg-white rounded-[24px] animate-pulse border border-gray-100 shadow-sm" />
                  ))
                ) : (
                  kpis.map((kpi) => (
                    <StatCard
                      key={kpi.label}
                      title={kpi.label}
                      value={statsLoading ? '...' : kpi.value}
                      change={kpi.change}
                      changeTone={kpi.changeTone}
                      icon={icons[kpi.iconKey]}
                    />
                  ))
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-6">
                  <div className="text-sm font-semibold text-[#111827] mb-4">Revenue Growth (MRR)</div>
                  <div className="h-64 mt-4">
                    {revenueLoading && mappedRevenueGrowthData.length === 0 ? (
                      <div className="w-full h-full bg-gray-50 rounded-lg animate-pulse" />
                    ) : mappedRevenueGrowthData.length === 0 ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg">
                        <div className="p-3 bg-gray-200 rounded-full mb-3">
                          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600 font-medium">No data available</p>
                        <p className="text-xs text-gray-500">Revenue growth data will appear here</p>
                      </div>
                    ) : (
                      <RevenueGrowthChart data={mappedRevenueGrowthData} />
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-6">
                  <div className="text-sm font-semibold text-[#111827] mb-4">Subscription Growth</div>
                  <div className="h-64 mt-4">
                    {subsLoading && mappedSubsGrowthData.length === 0 ? (
                      <div className="w-full h-full bg-gray-50 rounded-lg animate-pulse" />
                    ) : mappedSubsGrowthData.length === 0 ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg">
                        <div className="p-3 bg-gray-200 rounded-full mb-3">
                          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600 font-medium">No data available</p>
                        <p className="text-xs text-gray-500">Subscription data will appear here</p>
                      </div>
                    ) : (
                      <SubsGrowthChart data={mappedSubsGrowthData} />
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6 sm:p-8">
                <h2 className="text-sm font-semibold text-[#111827] mb-4">Plan Distribution</h2>
                <div className="w-full h-auto md:h-64 flex items-center justify-center py-4 md:py-0">
                  {planLoading && mappedPlanData.length === 0 ? (
                    <div className="w-full h-full bg-gray-50 rounded-lg animate-pulse" />
                  ) : mappedPlanData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg w-full h-full">
                      <div className="p-3 bg-gray-200 rounded-full mb-3">
                        <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600 font-medium">No plan data available</p>
                      <p className="text-xs text-gray-500">Plan distribution will appear here</p>
                    </div>
                  ) : (
                    <PlanPieChart data={mappedPlanData} />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Plan & Top-Up Management' && <PlanManagement />}

          {activeTab === 'Retailer Subscriptions' && <RetailerSubscriptions />}

          {activeTab === 'Usage Insights' && <UsageInsights />}

          {activeTab === 'Cancellation Insights' && <CancellationInsights />}

          {activeTab === 'Billing History' && <BillingHistory />}

          {activeTab === 'Payments' && <PaymentSettings />}

          {activeTab === 'Activity Logs' && <ActivityLogs />}

          {!['Overview', 'Plan & Top-Up Management', 'Retailer Subscriptions', 'Usage Insights', 'Cancellation Insights', 'Billing History', 'Payments', 'Activity Logs'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-[24px] border border-[#E5E7EB] shadow-sm mt-4">
              <div className="p-4 bg-gray-50 rounded-full mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{activeTab} Section</h3>
              <p className="text-gray-500">This module is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
