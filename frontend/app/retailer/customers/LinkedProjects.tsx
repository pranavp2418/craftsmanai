'use client';

import Link from 'next/link';
import { Customer, LinkedProject } from '@/lib/customersData';
import Image from 'next/image';

interface Props {
  customer: Customer;
  activeProjectId: string;
  onSelectProject: (id: string) => void;
}

export default function LinkedProjects({ customer, activeProjectId, onSelectProject }: Props) {
 
  return (
    <div
      className="rounded-sheet-lg p-4 sm:p-6 mb-5 shadow-card-soft bg-white dark:bg-surface-100 border border-transparent dark:border-border-default">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-ui-lg font-bold text-ink-900 font-satoshi dark:text-ink">
          Linked Projects
        </h3>
        <span
          className="px-3 py-1 rounded-full text-label-sm font-semibold text-brand dark:text-brand bg-brand-light dark:bg-brand/15">
          {customer.projects.length} projects
        </span>
      </div>

      {customer.projects.length === 0 ? (
        <div className="rounded-card-lg border border-dashed border-border-default bg-surface-50 dark:bg-surface-150 px-4 py-6 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-light dark:bg-brand/15 flex items-center justify-center">
            <i className="ri-folder-add-line text-ui-md text-brand dark:text-brand" />
          </div>
          <p className="text-body-sm font-semibold text-ink-700 dark:text-ink">No linked projects yet</p>
          <p className="text-label-sm text-ink-400 mt-1">
            Projects will appear here once a request is created.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
          {customer.projects.map((proj) => {
          const isSelected = proj.id === activeProjectId;
          return (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj.id)}
              className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-panel group transition-all duration-200 w-full text-left cursor-pointer border-1.5 ${isSelected ? 'bg-brand-tint dark:bg-brand/10 border-brand-soft dark:border-brand-soft/20 text-brand-dark dark:text-brand' : 'bg-white dark:bg-surface-150 border-border-default hover:border-border-strong'}`}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-card-lg bg-surface-warm-tint overflow-hidden flex-shrink-0 relative">
                <Image src={proj.image} alt={proj.type} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover object-center" />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="text-body-sm sm:text-body-md font-bold text-ink-900 dark:text-ink font-satoshi truncate mb-1">
                  {proj.id} <span className="text-ink-400 font-normal mx-1">·</span> <span className="text-ink-500 font-medium text-label-sm sm:text-body-sm">{proj.type}</span>
                </div>
                <div className="flex">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-caption font-semibold truncate max-w-[110px] sm:max-w-none ${proj.statusBg} ${proj.statusColor}`}
                    title={proj.status}
                  >
                    {proj.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isSelected && (
                  <Link
                    href={`/retailer/requests?id=${proj.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2 rounded-full text-label-xs sm:text-label-sm font-bold whitespace-nowrap transition-all hover:opacity-80 text-brand dark:text-brand bg-brand-light dark:bg-brand/15 min-h-touch sm:min-h-0 max-sm:min-h-0"
                  >
                    <i className="ri-external-link-line text-label-sm" />
                    <span className="hidden sm:inline">View Request</span>
                  </Link>
                )}
                <div
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isSelected ? 'bg-brand-light dark:bg-brand/15 text-brand dark:text-brand opacity-100' : 'bg-transparent text-ink-300 opacity-0'}`}
                >
                  <i className="ri-arrow-right-s-line text-body-md" />
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
