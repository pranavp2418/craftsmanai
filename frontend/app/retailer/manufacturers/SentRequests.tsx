'use client';

import Link from 'next/link';
import { ManufacturerRequest } from '@/lib/manufacturersData';

interface Props {
  requests: ManufacturerRequest[];
  selectedId: string;
  onSelect: (r: ManufacturerRequest) => void;
}

export default function SentRequests({ requests, selectedId, onSelect }: Props) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 mb-5 bg-glass-72 backdrop-blur-md border border-sand shadow-card-soft-md"

    >
      <h3 className="text-body-sm font-semibold text-ink uppercase tracking-widest mb-4 font-satoshi">
        Sent Requests
      </h3>
      <div className="flex flex-col gap-3 max-h-[80vh] overflow-y-auto ">
        {requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-full mb-3 bg-surface-200">
              <i className="ri-inbox-line text-heading-xs text-ink-300" />
            </div>
            <p className="text-label text-ink-400">No requests yet</p>
          </div>
        )}
        {requests.map((req) => {
          const isSelected = req.id === selectedId;
          return (
            <button
              type="button"
              key={req.id}
              onClick={() => onSelect(req)}
              className={`w-full text-left py-8 flex items-center gap-3 p-3 rounded-xl transition-all duration-150 min-h-touch ${
                isSelected
                  ? 'border-1.5 border-brand bg-tint-brand-05'
                  : 'border border-warm-mist dark:border-border-default hover:border-warm-600 dark:hover:border-ink-300 bg-white/50 dark:bg-surface-150'
              }`}
            >
              <img
                src={req.image}
                alt={req.type}
                className="w-12 h-12 rounded-xl object-cover object-top flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2">
                  <span className="text-label-md font-semibold text-ink font-satoshi whitespace-nowrap">
                    {req.id}
                  </span>
                  <span
                    className={`text-caption font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${req.statusBg} ${req.statusColor}`}
                  >
                    {req.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between mt-0.5 gap-1 sm:gap-2">
                  <span className="text-label-sm text-ink-500 whitespace-nowrap">{req.type}</span>
                  <span className="text-caption text-stone-350 whitespace-nowrap">{req.dateSent}</span>
                </div>
              </div>
              <Link
                href={`/retailer/requests?id=${req.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 touch-target-hitbox w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-brand hover:bg-tint-brand-soft transition-all"
              >
                <span className="ri-external-link-line text-body-md" />
              </Link>
            </button>
          );
        })}
      </div>
    </div>
  );
}
