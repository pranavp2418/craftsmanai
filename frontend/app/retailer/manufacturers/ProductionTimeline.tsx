'use client';

import { ManufacturerRequest } from '@/lib/manufacturersData';

interface Props {
  request?: ManufacturerRequest;
}

const stepIcon: Record<string, { icon: string; color: string; bg: string }> = {
  'Request Sent':          { icon: 'ri-send-plane-line',       color: 'text-ink-500', bg: 'bg-tint-gray' },
  'Manufacturer Viewed':   { icon: 'ri-eye-line',              color: 'text-brand', bg: 'bg-tint-brand'  },
  'Quote Submitted':       { icon: 'ri-price-tag-3-line',      color: 'text-warning-medium', bg: 'bg-tint-warning'  },
  'Approved':              { icon: 'ri-checkbox-circle-line',  color: 'text-success', bg: 'bg-tint-success'   },
  'Production Started':    { icon: 'ri-hammer-line',           color: 'text-violet-deep', bg: 'bg-tint-violet'  },
  'Completed':             { icon: 'ri-trophy-line',           color: 'text-success', bg: 'bg-tint-success'   },
};

const pendingIcon = { icon: 'ri-time-line', color: 'text-stone-300', bg: 'bg-stone-100 dark:bg-surface-200' };

export default function ProductionTimeline({ request }: Props) {
  if (!request) {
    return (
      <div className="rounded-sheet p-4 sm:p-5 shadow-card bg-glass-90 backdrop-blur border border-glass dark:border-border-default">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-10 h-10 flex items-center justify-center rounded-full mb-3 bg-surface-200">
            <i className="ri-timeline-view text-heading-xs text-ink-300" />
          </div>
          <p className="text-label text-ink-400">No request selected</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-sheet p-4 sm:p-5 shadow-card bg-glass-90 backdrop-blur border border-glass dark:border-border-default">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body font-semibold text-ink font-satoshi dark:text-ink">
          Production Timeline
        </h3>
        <span
          className="px-2 py-0.5 rounded-full text-caption font-semibold text-ink-500 bg-tint-gray-soft dark:bg-surface-200 dark:text-[#A1A8B3]">
          {request.id} · {request.type}
        </span>
      </div>

      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-5 ${request.statusNoteBg} border border-hairline-soft`}
      >
        <span
          className={`ri-information-line text-body-sm w-4 h-4 flex items-center justify-center flex-shrink-0 ${request.statusNoteColor}`}

        />
        <span className={`text-label font-medium ${request.statusNoteColor}`}>
          {request.statusNote}
        </span>
      </div>

      <div className="flex flex-col max-h-[80vh] overflow-y-auto">
        {request.timeline.map((step, idx) => {
          const style = (step.done || step.active) ? (stepIcon[step.label] ?? pendingIcon) : pendingIcon;
          const isLast = idx === request.timeline.length - 1;

          return (
            <div key={idx} className="flex gap-3.5 relative">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${style.bg} ${
                    step.active ? `shadow-[0_0_0_3px_${style.bg}]` : ''
                  }`}
                >
                  <i className={`${style.icon} text-body-sm ${style.color}`} />
                </div>
                {!isLast && (
                  <div
                    className={`w-px flex-1 mt-1 mb-1 ${step.done ? 'bg-brand/30 dark:bg-indigo-accent/40' : 'bg-surface-300'} min-h-[20px]`}

                  />
                )}
              </div>

              <div className={`flex-1 min-w-0 ${!isLast ? 'pb-4' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2">
                  <div>
                    <p
                      className={`text-label-md font-semibold font-satoshi ${step.done || step.active ? 'text-ink dark:text-ink' : 'text-stone-350'}`}

                    >
                      {step.label}
                    </p>
                    {step.active && (
                      <span
                        className="inline-block mt-0.5 text-caption font-semibold px-2 py-0.5 rounded-full text-brand bg-tint-brand-soft">
                        Current Stage
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-caption flex-shrink-0 sm:mt-0.5 ${step.done || step.active ? 'text-ink-250' : 'text-stone-200'}`}

                  >
                    {step.date}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-4 p-3 rounded-xl bg-tint-warm-soft dark:bg-surface-150 border border-mist-200 dark:border-border-default"

      >
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-tint-gray-soft">
            <i className="ri-chat-quote-line text-body-sm text-ink-400"/>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-caption font-semibold text-ink-400 uppercase tracking-wider mb-1">Latest Note</p>
            <p className="text-label text-ink-600 dark:text-[#D1D5DB] leading-relaxed">{request.latestNote}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
