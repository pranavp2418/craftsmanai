'use client';

import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchDesignTimeAnalytics } from '@/redux/slices/retailer/analytics/designTimeSlice';
import { fetchCompletedOrdersAnalytics } from '@/redux/slices/retailer/analytics/completedOrdersSlice';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';

interface CustomTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ value?: number | string }>;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-3 py-2 border border-white/60 dark:border-border-default text-label bg-glass-95 shadow-glow-indigo-mid">
        <div className="font-semibold text-ink-900">{label}</div>
        <div className="text-indigo-accent font-medium">{payload[0].value}</div>
      </div>
    );
  }
  return null;
};

export default function AnalyticsCharts() {
  const dispatch = useAppDispatch();
  
  // Designs Created Over Time selectors
  const { data: designData, loading: designLoading, error: designError } = useAppSelector(
    (state) => state.retailerAnalyticsDesignTime
  );
  
  // Completed Orders Over Time selectors
  const { data: ordersDataFromState, loading: ordersLoading, error: ordersError } = useAppSelector(
    (state) => state.retailerAnalyticsCompletedOrders
  );

  useEffect(() => {
    dispatch(fetchDesignTimeAnalytics());
    dispatch(fetchCompletedOrdersAnalytics());
  }, [dispatch]);

  const designsData = useMemo(() => {
    if (!designData?.months || designData.months.length === 0) {
      return [];
    }
    return designData.months.map((m) => ({
      month: m.month || 'N/A',
      value: m.count ?? 0,
    }));
  }, [designData]);

  const ordersData = useMemo(() => {
    if (!ordersDataFromState?.months || ordersDataFromState.months.length === 0) {
      return [];
    }
    return ordersDataFromState.months.map((m) => ({
      month: m.month || 'N/A',
      value: m.count ?? 0,
    }));
  }, [ordersDataFromState]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-6">
      {/* Designs Created Over Time */}
      <div className="rounded-2xl p-6 border border-white/60 dark:border-border-default shadow-glow-indigo-faint bg-glass-72 backdrop-blur-lg flex flex-col justify-between min-h-[294px] dark:bg-[#171C22]">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-body-md font-semibold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Designs Created Over Time</div>
              <div className="text-label text-ink-400 mt-0.5">Monthly design volume</div>
            </div>
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-tint-indigo">
              <span className="ri-line-chart-line text-ui-md text-indigo-accent"></span>
            </div>
          </div>

          {designError && (
            <div className="mb-3.5 p-2.5 rounded-xl border border-danger/20 bg-tint-danger-soft text-label-sm text-danger flex items-center gap-2">
              <i className="ri-error-warning-line text-ui-md shrink-0" />
              <span>Failed to load: {designError}. Using fallbacks.</span>
            </div>
          )}
        </div>

        {designLoading ? (
          <div className="w-full h-[180px] flex flex-col justify-between pt-4 animate-pulse">
            <div className="flex-1 flex items-end gap-3.5 pb-2 border-b border-black/[0.04] dark:border-border-default">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex-1 rounded-t bg-indigo-500/10 skeleton-shimmer"
                  style={{ height: `${20 + idx * 12}%`, opacity: 0.15 + idx * 0.15 }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 px-1">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-3 w-8 bg-surface-200 skeleton-shimmer rounded" />
              ))}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={designsData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="designGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2.5} fill="url(#designGrad)" dot={{ fill: 'text-indigo-accent', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: 'text-indigo-accent' }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Completed Orders Over Time */}
      <div className="rounded-2xl p-6 border border-white/60 dark:border-border-default shadow-glow-indigo-faint bg-glass-72 backdrop-blur-lg flex flex-col justify-between min-h-[294px] dark:bg-[#171C22]">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-body-md font-semibold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Completed Orders Over Time</div>
              <div className="text-label text-ink-400 mt-0.5">Monthly completion rate</div>
            </div>
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-tint-brand">
              <span className="ri-bar-chart-2-line text-ui-md text-brand"></span>
            </div>
          </div>

          {ordersError && (
            <div className="mb-3.5 p-2.5 rounded-xl border border-danger/20 bg-tint-danger-soft text-label-sm text-danger flex items-center gap-2">
              <i className="ri-error-warning-line text-ui-md shrink-0" />
              <span>Failed to load: {ordersError}. Using fallbacks.</span>
            </div>
          )}
        </div>

        {ordersLoading ? (
          <div className="w-full h-[180px] flex flex-col justify-between pt-4 animate-pulse">
            <div className="flex-1 flex items-end gap-3.5 pb-2 border-b border-black/[0.04] dark:border-border-default">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex-1 rounded-t bg-blue-500/10 skeleton-shimmer"
                  style={{ height: `${15 + idx * 14}%`, opacity: 0.15 + idx * 0.15 }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 px-1">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-3 w-8 bg-surface-200 skeleton-shimmer rounded" />
              ))}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ordersData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
