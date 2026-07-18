'use client';

import { Customer } from '@/lib/customersData';

export default function CustomerInsights({ customer }: { customer: Customer }) {
  interface Metric {
    label: string;
    value: string | number;
    icon: string;
    iconColor: string;
    iconBg: string;
    isText?: boolean;
    isDate?: boolean;
  }

  const metrics: Metric[] = [
    {
      label: 'Total Requests',
      value: customer.totalRequests,
      icon: 'ri-file-list-3-line',
      iconColor: 'text-brand',
      iconBg: 'bg-brand-tint',
    },
    {
      label: 'Active Projects',
      value: customer.activeProjects,
      icon: 'ri-sparkling-line',
      iconColor: 'text-violet-accent',
      iconBg: 'bg-tint-violet-soft',
    },
    {
      label: 'Total Spent',
      value: customer.totalSpent,
      icon: 'ri-money-dollar-circle-line',
      iconColor: 'text-warning-medium',
      iconBg: 'bg-tint-warning-soft',
      isText: true,
    },
    {
      label: 'Last Interaction',
      value: customer.lastInteraction,
      icon: 'ri-time-line',
      iconColor: 'text-success-medium',
      iconBg: 'bg-tint-emerald-soft',
      isDate: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 2xl:grid-cols-4 gap-3 lg:gap-4 mb-5">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="rounded-sheet p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-card-soft bg-white dark:bg-surface-100 border border-transparent dark:border-border-default">
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-card-lg sm:rounded-section flex items-center justify-center flex-shrink-0 ${m.iconBg}`}
          >
            <i className={`${m.icon} text-ui-md sm:text-heading-xs ${m.iconColor}`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-caption-xs sm:text-label-xs font-bold text-ink-400 mb-1 uppercase tracking-wide leading-tight whitespace-normal break-words">
              {m.label}
            </p>
            <p
              className={`font-bold text-ink-900 truncate ${
                m.isDate || m.isText ? 'text-body-md sm:text-ui-md' : 'text-heading-sm sm:text-heading-md'
              } font-satoshi tracking-tight`}>
              {m.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
