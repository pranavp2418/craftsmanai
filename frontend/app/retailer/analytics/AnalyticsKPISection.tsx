'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchAnalyticsMetrics } from '@/redux/slices/retailer/analytics/metricsSlice';

interface KPICardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  isEmpty?: boolean;
}

function KPICard({ icon, label, value, sub, isEmpty }: KPICardProps) {
  return (
    <div className="rounded-xl px-4 py-3.5 flex items-center gap-3 bg-white dark:bg-[#171C22] border border-default dark:border-border-default shadow-sm">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-tint dark:bg-brand/10">
        <span className={`${icon} text-ui text-brand-dark dark:text-brand`}></span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {isEmpty ? (
            <span className="text-heading-xs font-semibold text-ink-200 font-satoshi">—</span>
          ) : (
            <span className="text-heading font-bold text-ink-800 font-satoshi">{value}</span>
          )}
        </div>
        <div className="text-label-sm text-ink-400 font-medium mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}

function KPICardShimmer() {
  return (
    <div className="rounded-xl px-4 py-3.5 flex items-center gap-3 bg-white dark:bg-surface-100 border border-default dark:border-border-default shadow-sm animate-pulse">
      <div className="w-9 h-9 rounded-lg flex-shrink-0 bg-surface-200 skeleton-shimmer" />
      <div className="flex-1 min-w-0">
        <div className="h-5 w-16 bg-surface-200 skeleton-shimmer rounded mb-2" />
        <div className="h-3.5 w-24 bg-surface-200 skeleton-shimmer rounded" />
      </div>
    </div>
  );
}

interface GroupProps {
  title: string;
  children: React.ReactNode;
}

function KPIGroup({ title, children }: GroupProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-label-xs font-semibold uppercase tracking-widest text-ink-400 dark:text-[#E7EAEE]">{title}</span>
        <div className="flex-1 h-px bg-surface-200 dark:bg-border-default"></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{children}</div>
    </div>
  );
}

export default function AnalyticsKPISection() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.retailerAnalyticsMetrics);

  useEffect(() => {
    dispatch(fetchAnalyticsMetrics());
  }, [dispatch]);

  const activity = data?.Activity_metrics;
  const conversion = data?.conversion_metrics;

  // Graceful fallbacks for Activity Metrics
  const totalRenders = activity?.total_renders ?? 0;
  const designsSent = activity?.designs_sent ?? 0;
  const approvalRate = activity?.approval_rate !== null && activity?.approval_rate !== undefined ? `${activity.approval_rate}%` : '0%';
  const activeRequests = activity?.Active_requests ?? 0;

  // Graceful fallbacks for Conversion Metrics
  const totalRefinements = conversion?.total_refinements ?? 0;
  const customerEngagement = conversion?.customer_engagement ?? 0;
  const manufacturersEngaged = conversion?.manufacturers_engaged ?? 0;
  const archivedCompleted = conversion?.archived_completed ?? 0;

  if (loading) {
    return (
      <div>
        <KPIGroup title="Activity Metrics">
          <KPICardShimmer />
          <KPICardShimmer />
          <KPICardShimmer />
          <KPICardShimmer />
        </KPIGroup>
        <KPIGroup title="Conversion Metrics">
          <KPICardShimmer />
          <KPICardShimmer />
          <KPICardShimmer />
          <KPICardShimmer />
        </KPIGroup>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3.5 rounded-xl border border-danger/20 bg-tint-danger-soft text-label-sm text-danger flex items-center gap-2">
          <i className="ri-error-warning-line text-ui-md shrink-0" />
          <span>Error loading KPI metrics: {error}. Displaying fallback stats instead.</span>
        </div>
      )}

      <KPIGroup title="Activity Metrics">
        <KPICard icon="ri-pencil-ruler-2-line" label="Total Renders" value={totalRenders} sub="All time renders" />
        <KPICard icon="ri-send-plane-line" label="Designs Sent" value={designsSent} sub="Shared with customers" />
        <KPICard icon="ri-checkbox-circle-line" label="Approval Rate" value={approvalRate} sub="Customer approvals" />
        <KPICard icon="ri-loader-4-line" label="Active Requests" value={activeRequests} sub="In progress" />
      </KPIGroup>
      
      <KPIGroup title="Conversion Metrics">
        <KPICard icon="ri-refresh-line" label="Total Refinements" value={totalRefinements} />
        <KPICard icon="ri-user-heart-line" label="Customers Engaged" value={customerEngagement} sub="Active clients" />
        <KPICard icon="ri-hammer-line" label="Manufacturers Engaged" value={manufacturersEngaged} sub="Active partners" />
        <KPICard icon="ri-archive-line" label="Archived / Completed" value={archivedCompleted} sub="All time completed" />
      </KPIGroup>
    </div>
  );
}
