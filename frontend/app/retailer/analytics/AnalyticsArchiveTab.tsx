'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchArchivedDesigns } from '@/redux/slices/retailer/analytics/archivedSlice';
import { fetchArchivedVersions, resetArchivedVersions } from '@/redux/slices/retailer/analytics/archivedVersionsSlice';
import { restoreVariant } from '@/redux/slices/retailer/analytics/designVariantRestoreSlice';
import { restoreDesign } from '@/redux/slices/retailer/analytics/designRestoreSlice';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/Toast';

interface AnalyticsArchiveTabProps {
  restoredIds: string[];
  onRestoreClick: (id: string) => void;
}

export default function AnalyticsArchiveTab({ restoredIds, onRestoreClick }: AnalyticsArchiveTabProps) {
  const dispatch = useAppDispatch();
  const { show: showToast } = useToast();
  
  // Archived Requests (Table)
  const { items: archivedRequests, loading: requestsLoading, pagination: requestsPagination, total: requestsTotal } = useAppSelector(
    (state) => state.retailerAnalyticsArchived
  );
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsLimit] = useState(10);
  const [restoringDesignId, setRestoringDesignId] = useState<number | null>(null);

  useEffect(() => {
    const isCached = archivedRequests.length > 0 && 
                     requestsPagination?.page === requestsPage && 
                     requestsPagination?.limit === requestsLimit;
    if (!isCached && !requestsLoading) {
      dispatch(fetchArchivedDesigns({ page: requestsPage, limit: requestsLimit }));
    }
  }, [dispatch, requestsPage, requestsLimit]);

  // Archived Versions (Grid with Infinite Scroll)
  const { items: archivedVersions, loading: versionsLoading, pagination: versionsPagination, total: versionsTotal } = useAppSelector(
    (state) => state.retailerAnalyticsArchivedVersions
  );

  const [versionsPage, setVersionsPage] = useState(1);
  const [versionsLimit] = useState(20);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  // Initialize and load first page of versions
  useEffect(() => {
    const isCached = archivedVersions.length > 0 && 
                     versionsPagination?.page === 1 && 
                     versionsPagination?.limit === versionsLimit;
    if (!isCached && !versionsLoading) {
      dispatch(resetArchivedVersions());
      dispatch(fetchArchivedVersions({ page: 1, limit: versionsLimit }));
      setVersionsPage(1);
    }
  }, [dispatch, versionsLimit]);

  // Load next pages
  useEffect(() => {
    if (versionsPage > 1) {
      const isAlreadyLoaded = versionsPagination?.page === versionsPage;
      if (!isAlreadyLoaded && !versionsLoading) {
        dispatch(fetchArchivedVersions({ page: versionsPage, limit: versionsLimit }));
      }
    }
  }, [dispatch, versionsPage, versionsLimit]);

  const handleVersionsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const nearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    
    if (nearBottom && !versionsLoading && versionsPagination?.has_next) {
      setVersionsPage((prev) => prev + 1);
    }
  };

  const handleRestoreVariant = async (variantId: number) => {
    setRestoringId(variantId);
    try {
      const response = await dispatch(restoreVariant({ variantId })).unwrap();
      
      // Show toast with exact message from the API response
      showToast(response.message || `Variant ${variantId} restored successfully.`);
      
      // Refresh the archived versions list to see updated status
      dispatch(resetArchivedVersions());
      dispatch(fetchArchivedVersions({ page: 1, limit: versionsLimit }));
      setVersionsPage(1);
    } catch (err: any) {
      showToast(err || 'Failed to restore variant.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreDesign = async (designId: number) => {
    setRestoringDesignId(designId);
    try {
      const response = await dispatch(restoreDesign({ designId })).unwrap();
      
      // Show toast with exact message from the API response
      showToast(response.message || `Design ${designId} restored successfully.`);
      
      // Refresh the archived requests list to see updated status
      dispatch(fetchArchivedDesigns({ page: requestsPage, limit: requestsLimit }));
    } catch (err: any) {
      showToast(err || 'Failed to restore design.');
    } finally {
      setRestoringDesignId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return 'N/A';
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Archived Requests Table Section */}
      <div className="rounded-2xl p-4 sm:p-6 border border-white/60 dark:border-border-default shadow-glow-indigo-faint bg-glass-72 backdrop-blur-lg">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-tint-gray dark:bg-white/[0.08]">
            <span className="ri-archive-line text-ui-md text-ink-500 dark:text-ink-300"></span>
          </div>
          <div>
            <div className="text-body-md font-semibold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Archived Requests</div>
            <div className="text-label-xs text-ink-400">
              {requestsLoading && requestsTotal === 0 ? 'Loading...' : `${requestsTotal || 0} archived items`}
            </div>
          </div>
        </div>
        
        <div className="rounded-xl overflow-y-auto border border-muted dark:border-border-default max-h-[460px]">
          <table className="w-full relative border-collapse">
            <thead>
              <tr className="bg-tint-gray-faint truncate sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">
                <th className="bg-tint-gray-faint text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Request ID</th>
                <th className="bg-tint-gray-faint text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Type</th>
                <th className="bg-tint-gray-faint text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Customer</th>
                <th className="bg-tint-gray-faint text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Archived On</th>
                <th className="bg-tint-gray-faint text-left px-4 py-3 text-label-xs font-semibold text-ink-400 uppercase tracking-wider">Reason</th>
                <th className="bg-tint-gray-faint px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {requestsLoading && archivedRequests.length === 0 ? (
                Array.from({ length: requestsLimit }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-t border-muted dark:border-border-default animate-pulse">
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-7 w-16 rounded-lg" /></td>
                  </tr>
                ))
              ) : archivedRequests && archivedRequests.length > 0 ? (
                archivedRequests.map((item) => {

                  console.log(item)
                  const itemKey = item.design_code || item.id.toString() || '0';
                  const restored = restoredIds.includes(itemKey);
                  return (
                    <tr key={item.id} className="border-t border-muted dark:border-border-default hover:bg-surface-50 dark:hover:bg-surface-150 transition-colors truncate">
                      <td className="px-4 py-3.5 text-label-md font-semibold text-ink-400">
                        {item.design_code || item.id || 'N/A'}
                      </td>
                      <td className="px-4 py-3.5 text-label-md text-ink-700">
                        {item.jewellery_type || 'N/A'}
                      </td>
                      <td className="px-4 py-3.5 text-label-md text-ink-700">
                        {item.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3.5 text-label text-ink-400">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-label text-ink-400">
                        {item.user_prompt || 'Completed & archived'}
                      </td>
                      <td className="px-4 py-3.5">
                        {restored ? (
                          <span className="text-label-xs font-medium text-success-medium">Restored</span>
                        ) : (
                          <button
                            onClick={() => handleRestoreDesign(item.id)}
                            disabled={restoringDesignId === item.id}
                            className="px-3 py-1.5 rounded-lg text-label-sm font-medium cursor-pointer whitespace-nowrap transition-all hover:opacity-80 text-indigo-accent bg-tint-indigo disabled:opacity-50">
                            {restoringDesignId === item.id ? 'Restoring...' : 'Restore'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-muted dark:border-border-default">
                  <td colSpan={6} className="px-4 py-8 text-center text-label text-ink-400">
                    No archived requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {requestsPagination && requestsPagination.total_pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-muted dark:border-border-default">
            <p className="text-label text-ink-400">
              Showing <span className="font-semibold text-ink-900 font-satoshi">{(requestsPage - 1) * requestsLimit + 1}</span> to{' '}
              <span className="font-semibold text-ink-900 font-satoshi">
                {Math.min(requestsPage * requestsLimit, requestsPagination.total_items)}
              </span>{' '}
              of <span className="font-semibold text-ink-900 font-satoshi">{requestsPagination.total_items}</span> items
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRequestsPage((p) => Math.max(p - 1, 1))}
                disabled={!requestsPagination.has_prev}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-muted dark:border-border-default text-ink-500 dark:text-[#A1A8B3] transition-all hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="ri-arrow-left-s-line text-ui"></span>
              </button>
              {Array.from({ length: requestsPagination.total_pages }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setRequestsPage(p)}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg font-semibold text-label transition-all cursor-pointer ${
                      requestsPage === p
                        ? 'bg-gradient-indigo text-white shadow-glow-indigo'
                        : 'border border-muted dark:border-border-default text-ink-500 dark:text-[#A1A8B3] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setRequestsPage((p) => Math.min(p + 1, requestsPagination.total_pages || p))}
                disabled={!requestsPagination.has_next}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-muted dark:border-border-default text-ink-500 dark:text-[#A1A8B3] transition-all hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="ri-arrow-right-s-line text-ui"></span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Archived Versions Grid Section */}
      <div className="rounded-2xl p-4 sm:p-6 border border-white/60 dark:border-border-default shadow-glow-indigo-faint bg-glass-72 backdrop-blur-lg">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-tint-indigo">
            <svg width="17" height="24" viewBox="0 0 17 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3.66453 11.4L4.99703 10.0667L8.66141 13.7333L10.9933 11.4L12.992 13.4V7.33333H3.66453V11.4ZM3.66453 13.28V16.6667H5.72991L7.71533 14.68L4.99703 11.9467L3.66453 13.28ZM7.60873 16.6667H12.992V15.28L10.9933 13.28L7.60873 16.6667ZM2.99828 6H13.6583C13.8448 6 14.0025 6.06444 14.1313 6.19333C14.2601 6.32222 14.3245 6.48 14.3245 6.66667V17.3333C14.3245 17.52 14.2601 17.6778 14.1313 17.8067C14.0025 17.9356 13.8448 18 13.6583 18H2.99828C2.81173 18 2.65405 17.9356 2.52524 17.8067C2.39644 17.6778 2.33203 17.52 2.33203 17.3333V6.66667C2.33203 6.48 2.39644 6.32222 2.52524 6.19333C2.65405 6.06444 2.81173 6 2.99828 6ZM10.6602 10.6667C10.3848 10.6667 10.1494 10.5689 9.95393 10.3733C9.7585 10.1778 9.66078 9.94222 9.66078 9.66667C9.66078 9.39111 9.7585 9.15556 9.95393 8.96C10.1494 8.76444 10.3848 8.66667 10.6602 8.66667C10.9355 8.66667 11.1709 8.76444 11.3664 8.96C11.5618 9.15556 11.6595 9.39111 11.6595 9.66667C11.6595 9.94222 11.5618 10.1778 11.3664 10.3733C11.1709 10.5689 10.9355 10.6667 10.6602 10.6667Z" fill="#6366F1"/>
            </svg>
          </div>
          <div>
            <div className="text-body-md font-semibold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Archived Versions</div>
            <div className="text-label-xs text-ink-400">
              {versionsLoading && versionsTotal === 0 ? 'Loading...' : `${versionsTotal || 0} archived items`}
            </div>
          </div>
        </div>

        <div 
          onScroll={handleVersionsScroll}
          className="overflow-y-auto max-h-[460px] pr-1"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pb-4">
            {archivedVersions && archivedVersions.length > 0 ? (
              archivedVersions.map((item) => {
                const itemKey = item.id.toString();
                const restored = restoredIds.includes(itemKey);
                
                // Graceful fallback formats
                const labelText = item.variant_name 
                  ? `${item.variant_name} (v${item.version_number ?? 0})` 
                  : `Version (v${item.version_number ?? 0})`;
                
                return (
                  <div key={item.id} className="rounded-2xl overflow-hidden border border-muted dark:border-border-default bg-white dark:bg-surface-100 shadow-soft-card">
                    <div className="relative h-40 md:h-44 overflow-hidden bg-surface-50">
                      <Image
                        src={item.base_design_image_url || '/images/req135.jpg'}
                        alt={labelText}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3">
                      <div className="text-label-md font-semibold text-ink-700 truncate">{labelText}</div>
                      <div className="text-caption text-ink-400 mt-0.5">Design #{item.design_id || 'N/A'}</div>
                      {restored ? (
                        <div className="mt-2 text-caption font-medium text-success-medium">Restored</div>
                      ) : (
                        <button
                          onClick={() => handleRestoreVariant(item.id)}
                          disabled={restoringId === item.id}
                          className="mt-3 w-full py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all hover:opacity-80 text-indigo-accent bg-tint-indigo disabled:opacity-50"
                        >
                          {restoringId === item.id ? 'Restoring...' : 'Restore'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : null}

            {/* Shimmer loaders for loading state / fetching next pages */}
            {versionsLoading && (
              Array.from({ length: archivedVersions.length === 0 ? 12 : 6 }).map((_, index) => (
                <div key={`shimmer-${index}`} className="rounded-2xl overflow-hidden border border-muted dark:border-border-default bg-white dark:bg-surface-100 shadow-soft-card animate-pulse">
                  <div className="relative h-40 md:h-44 bg-surface-200">
                    <Skeleton className="w-full h-full animate-shimmer" />
                  </div>
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4 rounded animate-shimmer" />
                    <Skeleton className="h-3 w-1/2 rounded animate-shimmer" />
                    <Skeleton className="h-7 w-full rounded-lg animate-shimmer" />
                  </div>
                </div>
              ))
            )}

            {!versionsLoading && (!archivedVersions || archivedVersions.length === 0) && (
              <div className="col-span-full py-12 text-center text-label text-ink-400">
                No archived versions found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
