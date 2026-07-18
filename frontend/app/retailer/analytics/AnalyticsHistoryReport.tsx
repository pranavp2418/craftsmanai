'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchActivityLog, ActivityLogActorType } from '@/redux/slices/retailer/analytics/activityLogSlice';

const statusStyles: Record<string, { bg: string; text: string }> = {
  'Draft': { bg: 'bg-tint-gray', text: 'text-ink-500' },
  'Generating': { bg: 'bg-tint-gray', text: 'text-ink-500' },
  'Ready for Review': { bg: 'bg-tint-brand', text: 'text-brand' },
  'Sent to Customer': { bg: 'bg-tint-warning', text: 'text-warning-medium' },
  'Approved': { bg: 'bg-tint-success', text: 'text-success' },
  'Sent to Manufacturer': { bg: 'bg-tint-violet', text: 'text-violet-deep' },
  'Completed': { bg: 'bg-tint-emerald-strong', text: 'text-success-deep' },
};

const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

function HistoryTableShimmer() {
  return (
    <div className="rounded-xl overflow-hidden border border-muted dark:border-border-default -mx-4 sm:mx-0 overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="bg-tint-indigo-faint">
            <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Request ID</th>
            <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Type</th>
            <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Actor</th>
            <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Date</th>
            <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, index) => (
            <tr key={`history-skeleton-${index}`} className="border-t border-muted dark:border-border-default">
              <td className="px-4 py-3.5"><div className="h-4 w-20 rounded skeleton-shimmer" /></td>
              <td className="px-4 py-3.5"><div className="h-4 w-24 rounded skeleton-shimmer" /></td>
              <td className="px-4 py-3.5"><div className="h-4 w-36 rounded skeleton-shimmer" /></td>
              <td className="px-4 py-3.5"><div className="h-4 w-24 rounded skeleton-shimmer" /></td>
              <td className="px-4 py-3.5"><div className="h-6 w-28 rounded-full skeleton-shimmer" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsHistoryReport() {
  const dispatch = useAppDispatch();
  const { items, loading, error, activeActorType } = useAppSelector((state) => state.retailerAnalyticsActivityLog);
  const [tab, setTab] = useState<'manufacturer' | 'customer'>('manufacturer');
  const actorType = tab === 'manufacturer' ? 'manufacturer' : 'customer';

  useEffect(() => {
    dispatch(fetchActivityLog({ actorType }));
  }, [dispatch, actorType]);

  const rows = useMemo(() => {
    return (items ?? [])
      .filter((item) => (item?.actor_type ?? actorType) === actorType)
      .map((item) => ({
        id: item?.request_id?.trim() || 'N/A',
        type: item?.type?.trim() || 'N/A',
        date: formatDate(item?.date),
        status: item?.status?.trim() || 'N/A',
        actor: actorType === 'manufacturer'
          ? (item?.manufacturer?.trim() || 'N/A')
          : (item?.customer?.trim() || 'N/A'),
      }));
  }, [actorType, items]);

  return (
    <div className="rounded-2xl p-4 sm:p-6 border border-white/60 dark:border-border-default shadow-glow-indigo-faint bg-glass-72 dark:bg-[#171C22] backdrop-blur-lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-tint-indigo">
            <span className="ri-file-list-3-line text-ui-md text-indigo-accent" />
          </div>
          <div>
            <div className="text-body-md font-semibold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Detailed History Report</div>
            <div className="text-label-xs text-ink-400">Recent activity log</div>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-full border border-white/60 dark:border-border-default w-fit bg-glass-72 backdrop-blur-lg shadow-glow-indigo-pop">
          <button
            type="button"
            onClick={() => setTab('manufacturer')}
            aria-pressed={tab === 'manufacturer'}
            className={`px-4 min-h-touch rounded-full text-label font-medium transition-all duration-200 whitespace-nowrap ${tab === 'manufacturer' ? 'bg-gradient-indigo text-white dark:text-black shadow-glow-indigo-tab' : 'text-ink-500 dark:text-[#A1A8B3]'
              }`}
          >
            Manufacturer
          </button>
          <button
            type="button"
            onClick={() => setTab('customer')}
            aria-pressed={tab === 'customer'}
            className={`px-4 min-h-touch rounded-full text-label font-medium transition-all duration-200 whitespace-nowrap ${tab === 'customer' ? 'bg-gradient-indigo text-white dark:text-black shadow-glow-indigo-tab' : 'text-ink-500 dark:text-[#A1A8B3]'
              }`}
          >
            Customer
          </button>
        </div>
      </div>

      {loading ? (
        <HistoryTableShimmer />
      ) : error ? (
        <div className="rounded-xl border border-muted dark:border-border-default -mx-4 sm:mx-0 p-4 sm:p-5 bg-white/60 dark:bg-surface-100/60 text-label-sm text-ink-500">
          {error}. Showing the available history state only.
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-muted dark:border-border-default -mx-4 sm:mx-0 overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-tint-indigo-faint">
                <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Request ID</th>
                <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">{tab === 'manufacturer' ? 'Manufacturer' : 'Customer'}</th>
                <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row, index) => {
                const style = statusStyles[row.status] || { bg: 'bg-tint-gray', text: 'text-ink-500' };
                return (
                  <tr key={`${row.id}-${row.status}-${index}`} className="border-t border-muted dark:border-border-default hover:bg-surface-50 dark:hover:bg-surface-100 transition-colors">
                    <td className="px-4 py-3.5 text-label-md font-semibold text-indigo-accent">{row.id}</td>
                    <td className="px-4 py-3.5 text-label-md text-ink-700">{row.type}</td>
                    <td className="px-4 py-3.5 text-label-md text-ink-700">{row.actor}</td>
                    <td className="px-4 py-3.5 text-label text-ink-400">{row.date}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-label-xs font-medium whitespace-nowrap ${style.text} ${style.bg}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr className="border-t border-muted dark:border-border-default">
                  <td colSpan={5} className="px-4 py-8 text-center text-label-sm text-ink-500">
                    No activity found for this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
