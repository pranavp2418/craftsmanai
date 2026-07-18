'use client';

import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchConversionFunnelAnalytics } from '@/redux/slices/retailer/analytics/conversionFunnelSlice';

interface FunnelStep {
  label: string;
  value: number;
  pct: number;
  color: string;
}

function FunnelShimmer() {
  return (
    <div className="flex flex-col gap-3.5 animate-pulse">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="w-[120px] h-4 bg-surface-200 skeleton-shimmer rounded shrink-0" />
          <div className="flex-1">
            <div className="w-full h-8 bg-surface-150 border-l-4 border-l-surface-200/50 rounded-lg overflow-hidden relative">
              <div className="h-full bg-surface-200/30 skeleton-shimmer" style={{ width: `${100 - idx * 15}%` }} />
            </div>
          </div>
          <div className="w-12 h-4 bg-surface-200 skeleton-shimmer rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

function InsightCardsShimmer() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="rounded-2xl p-5 border border-white/60 dark:border-white/[0.08] flex items-center gap-4 bg-glass-72 backdrop-blur-lg shadow-glow-brand-tint animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-surface-200 skeleton-shimmer shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-5 w-20 bg-surface-200 skeleton-shimmer rounded mb-2" />
            <div className="h-3.5 w-32 bg-surface-200 skeleton-shimmer rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsFunnel() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.retailerAnalyticsConversionFunnel);

  useEffect(() => {
    dispatch(fetchConversionFunnelAnalytics());
  }, [dispatch]);

  const funnelSteps = useMemo(() => {
    const colors: Record<string, string> = {
      'Requests': '#1D4ED8',
      'Rendered': '#2563EB',
      'Sent': '#3B82F6',
      'Approved': '#60A5FA',
      'Manufactured': '#93C5FD',
    };
    if (!data?.stages || data.stages.length === 0) {
      return [
        { label: 'Requests', value: 0, pct: 0, color: '#1D4ED8' },
        { label: 'Rendered', value: 0, pct: 0, color: '#2563EB' },
        { label: 'Sent', value: 0, pct: 0, color: '#3B82F6' },
        { label: 'Approved', value: 0, pct: 0, color: '#60A5FA' },
        { label: 'Manufactured', value: 0, pct: 0, color: '#93C5FD' },
      ];
    }
    return data.stages.map((s) => ({
      label: s.label || 'N/A',
      value: s.count ?? 0,
      pct: s.rate ?? 0,
      color: colors[s.label] || '#3B82F6',
    }));
  }, [data]);

  const insightCards = useMemo(() => {
    const summary = data?.summary;
    const approval = summary?.avg_time_to_approval_days !== null && summary?.avg_time_to_approval_days !== undefined
      ? `${summary.avg_time_to_approval_days} days`
      : 'N/A';
    const refinements = summary?.avg_refinements_per_design !== null && summary?.avg_refinements_per_design !== undefined
      ? String(summary.avg_refinements_per_design)
      : 'N/A';
    const conversionRate = summary?.conversion_rate !== null && summary?.conversion_rate !== undefined
      ? `${summary.conversion_rate}%`
      : '0%';

    return [
      { icon: 'ri-time-line', label: 'Avg Time to Approval', value: approval },
      { icon: 'ri-refresh-line', label: 'Avg Refinements / Design', value: refinements },
      { icon: 'ri-percent-line', label: 'Conversion Rate', value: conversionRate },
    ];
  }, [data]);

  const hexToRgba = (hex: string, alpha = 0.12) => {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5 mb-6">
        <div className="col-span-2 rounded-2xl p-6 border border-white/60 dark:border-white/[0.08] shadow-glow-indigo-faint bg-glass-72 backdrop-blur-lg min-h-[304px] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-5 animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-surface-200 skeleton-shimmer" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-surface-200 skeleton-shimmer rounded mb-1.5" />
                <div className="h-3 w-48 bg-surface-200 skeleton-shimmer rounded" />
              </div>
            </div>
            <FunnelShimmer />
          </div>
        </div>
        <InsightCardsShimmer />
      </div>
    );
  }

  return (
    <div className="flex flex-col mb-6">
      {error && (
        <div className="w-full mb-4 p-3.5 rounded-xl border border-danger/20 bg-tint-danger-soft text-label-sm text-danger flex items-center gap-2">
          <i className="ri-error-warning-line text-ui-md shrink-0" />
          <span>Failed to load conversion funnel: {error}. Using fallbacks.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5">
        {/* Left Funnel Section */}
        <div className="col-span-2 rounded-2xl p-6 border border-white/60 dark:border-white/[0.08] shadow-glow-indigo-faint bg-glass-72 backdrop-blur-lg flex flex-col justify-between min-h-[304px] dark:bg-[#171C22]">
          <div>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand-tint dark:bg-brand/10">
                <span className="ri-filter-3-line text-ui-md text-brand-dark dark:text-brand"></span>
              </div>
              <div>
                <div className="text-body-md font-semibold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Conversion Funnel</div>
                <div className="text-label-xs text-ink-400">Request → Manufacture pipeline</div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              {funnelSteps.map((step) => {
                const lightBg = hexToRgba(step.color, 0.12);

                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className="w-[120px] text-label font-medium text-ink-700 shrink-0">{step.label}</div>

                    <div className="flex-1">
                      <div className="w-full h-8 rounded-lg overflow-visible relative">
                        <div
                          className="h-8 rounded-lg overflow-hidden bg-overlay-04 border-l-4"
                          style={{ borderLeftColor: step.color }}
                        >
                          <div
                            className="h-full rounded-lg transition-all duration-500 flex items-center px-4"
                            style={{ width: `${Math.min(100, step.pct)}%`, background: lightBg }}
                          >
                            <div>
                              <span className="text-label-xs font-semibold" style={{ color: step.color }}>{step.value}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-12 text-right text-label-xs font-medium text-ink-400 shrink-0">{step.pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Insights Cards */}
        <div className="flex flex-col gap-4 justify-between h-full">
          {insightCards.map((card) => (
            <div key={card.label} className="rounded-2xl p-5 border border-white/60 dark:border-white/[0.08] flex items-center gap-4 bg-glass-72 backdrop-blur-lg shadow-glow-brand-tint flex-1 dark:bg-[#171C22]">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-brand-tint dark:bg-brand/10">
                <span className={`${card.icon} text-heading-xs text-brand-dark dark:text-brand`}></span>
              </div>
              <div>
                <div className="text-heading font-bold text-ink-900 font-satoshi">{card.value}</div>
                <div className="text-label-sm text-ink-500 leading-tight mt-0.5">{card.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
