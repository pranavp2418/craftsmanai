'use client';

import { useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchJewelleryBreakdown } from '@/redux/slices/retailer/analytics/jewelleryBreakdownSlice';

type ProductMixDatum = { name: string; value: number; color: string };

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: ProductMixDatum }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    const color = entry.payload?.color ?? '#1A1A2E';
    const name = entry.name ?? entry.payload?.name ?? 'N/A';
    const value = entry.value ?? entry.payload?.value ?? 0;
    return (
      <div className="rounded-xl px-3 py-2 border border-white/60 dark:border-border-default text-label bg-glass-95 shadow-glow-brand-mid">
        <div className="font-semibold text-ink-900">{name}</div>
        <div className="font-medium" style={{ color }}>
          {value}%
        </div>
      </div>
    );
  }
  return null;
};

const hashStringToHue = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
};

const getCategoryColor = (label: string) => {
  const normalized = label.trim().toLowerCase();
  const fixedColors: Record<string, string> = {
    rings: '#1D4ED8',
    necklaces: '#2563EB',
    earrings: '#3B82F6',
    bracelets: '#60A5FA',
    pendants: '#93C5FD',
    other: '#BFDBFE',
  };

  if (fixedColors[normalized]) {
    return fixedColors[normalized];
  }

  const hue = hashStringToHue(label.toLowerCase());
  return `hsl(${hue} 72% 56%)`;
};

export default function AnalyticsProductMix() {
  const dispatch = useAppDispatch();
  const { data, loading } = useAppSelector((state) => state.retailerAnalyticsJewelleryBreakdown);

  useEffect(() => {
    dispatch(fetchJewelleryBreakdown());
  }, [dispatch]);

  const categories = useMemo(() => {
    const apiCategories = data?.categories ?? [];
    return apiCategories
      .filter((entry) => typeof entry?.label === 'string' && entry.label.trim().length > 0)
      .map((entry) => {
        const label = entry?.label?.trim() || 'N/A';
        const rate = typeof entry?.rate === 'number' && !Number.isNaN(entry.rate) ? entry.rate : 0;
        const value = Math.min(100, Math.max(0, rate));
        return {
          name: label,
          value,
          color: getCategoryColor(label),
        };
      });
  }, [data?.categories]);

  if (loading) {
    return (
      <div className="rounded-2xl p-6 border border-white/60 dark:border-border-default mb-6 bg-glass-72 backdrop-blur-lg shadow-glow-brand-tint dark:bg-[#171C22]">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand-tint dark:bg-brand/10">
            <span className="ri-donut-chart-line text-ui-md text-brand-dark dark:text-brand"></span>
          </div>
          <div>
            <div className="text-body-md font-semibold text-ink-900 font-satoshi">Product Mix</div>
            <div className="text-label-xs text-ink-400">Jewelery category breakdown</div>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
          <div className="w-[200px] h-[200px] shrink-0 flex items-center justify-center">
            <div className="w-[170px] h-[170px] rounded-full skeleton-shimmer" />
          </div>
          <div className="w-full lg:flex-1 grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`product-mix-skeleton-${index}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-overlay-02 dark:bg-white/[0.03]"
              >
                <div className="w-3 h-3 rounded-full skeleton-shimmer shrink-0" />
                <div className="w-full flex items-center justify-between min-w-0">
                  <div>
                    <div className="h-3.5 w-16 rounded skeleton-shimmer mb-2" />
                    <div className="h-2.5 w-10 rounded skeleton-shimmer" />
                  </div>
                  <div className="mt-2 w-full max-w-12 h-1.5 rounded-full overflow-hidden bg-overlay-06">
                    <div className="h-full w-2/3 rounded-full skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6 border border-white/60 dark:border-border-default mb-6 bg-glass-72 backdrop-blur-lg shadow-glow-brand-tint dark:bg-[#171C22]">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand-tint dark:bg-brand/10">
          <span className="ri-donut-chart-line text-ui-md text-brand-dark dark:text-brand"></span>
        </div>
        <div>
          <div className="text-body-md font-semibold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Product Mix</div>
          <div className="text-label-xs text-ink-400">Jewelery category breakdown</div>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
        <div className="w-[200px] h-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {categories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full lg:flex-1 grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-overlay-02 dark:bg-white/[0.03]"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <div className="w-full flex items-center justify-between min-w-0">
                <div>
                  <div className="text-label-md font-medium text-ink-700 truncate">{cat.name}</div>
                  <div className="text-label-xs text-ink-400">{cat.value}%</div>
                </div>
                <div className="mt-2 w-full max-w-12 h-1.5 rounded-full overflow-hidden bg-overlay-06">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${cat.value}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
