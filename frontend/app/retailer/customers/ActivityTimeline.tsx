'use client';

import { ActivityItem } from '@/lib/customersData';

interface Props {
  activity: ActivityItem[];
  projectId: string;
}

export default function ActivityTimeline({ activity, projectId }: Props) {
  return (
    <div
      className="rounded-sheet-lg p-4 sm:p-6 shadow-card-soft bg-white dark:bg-surface-100 border border-transparent dark:border-border-default">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-ui-lg font-bold text-ink-900 dark:text-ink font-satoshi">
          Activity Timeline
        </h3>
        <span
          className="px-3 py-1 rounded-full text-label-sm font-semibold text-ink-600 bg-surface-150 dark:bg-surface-200 dark:text-[#A1A8B3]">
          {projectId}
        </span>
      </div>

      {activity.length === 0 ? (
        <div className="rounded-card-lg border border-dashed border-border-default bg-surface-50 dark:bg-surface-150 px-4 py-6 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-tint-emerald-soft flex items-center justify-center">
            <i className="ri-time-line text-ui-md text-success-medium" />
          </div>
          <p className="text-body-sm font-semibold text-ink-700 dark:text-ink">No activity yet</p>
          <p className="text-label-sm text-ink-400 mt-1">
            Timeline updates will appear as requests move forward.
          </p>
        </div>
      ) : (
        <div className="flex flex-col max-h-[80vh] overflow-y-auto">
          {activity.map((item, idx) => (
            <div key={idx} className="flex gap-4 relative">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-8 h-8 sm:w-[34px] sm:h-[34px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ${item.iconBg}`}
                >
                  <i className={`${item.icon} text-body-sm ${item.iconColor}`}></i>
                </div>
                {idx < activity.length - 1 && (
                  <div className="w-px flex-1 mt-1.5 mb-1.5 bg-mist-200 dark:bg-border-default min-h-[24px]"></div>
                )}
              </div>

              <div className={`flex-1 min-w-0 ${idx < activity.length - 1 ? 'pb-5' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between sm:gap-3">
                  <div className="mt-0.5 sm:mt-1">
                    <p className="text-body-sm font-bold text-ink-900 dark:text-ink font-satoshi leading-tight">
                      {item.action}
                    </p>
                    <p className="text-label-sm text-ink-500 mt-1.5 leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-label-xs font-medium text-ink-400 whitespace-nowrap flex-shrink-0 mt-1 sm:mt-1">
                    {item.time}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
