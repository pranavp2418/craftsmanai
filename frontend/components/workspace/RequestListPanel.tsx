'use client';

import { useRef, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { toast } from 'react-toastify';
import { fetchDesigns } from '@/redux/slices/retailer/designsSlice';
import { archiveDesign } from '@/redux/slices/retailer/designArchiveSlice';
import { deleteDesign } from '@/redux/slices/retailer/designDeleteSlice';
import { placeholderImage } from '@/lib/placeholders';
import { statusStyles, RequestData, statusLabels } from '@/lib/requestsData';
import { getCacheBustedUrl } from '@/src/utils/image';

const filters = [
  { label: 'All', value: 'All' },
  { label: 'Generating', value: 'GENERATING' },
  { label: 'Generated', value: 'GENERATED' },
  { label: 'Shared', value: 'SHARED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Sent to Manufacturer', value: 'SENT_TO_MANUFACTURER' },
];

interface ArchivedRequestEntry {
  id: string;
  type: string;
  customer: string;
  date: string;
  reason: string;
}

interface RequestListPanelProps {
  activeId: string;
  onSelect: (id: string) => void;
  requestsFromParent?: RequestData[];
  loadingFromParent?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  status: 'All' | 'GENERATING' | 'GENERATED' | 'SHARED' | 'APPROVED' | 'SENT_TO_MANUFACTURER' | 'COMPLETED';
  onStatusChange: (value: 'All' | 'GENERATING' | 'GENERATED' | 'SHARED' | 'APPROVED' | 'SENT_TO_MANUFACTURER' | 'COMPLETED') => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onDeleteSuccess?: (deletedId: string) => void;
  onArchiveSuccess?: (archivedId: string) => void;
}

const normalizeApiStatus = (status?: string): RequestData['status'] => {
  return (status || 'DRAFT').trim().toUpperCase() as RequestData['status'];
};

export default function RequestListPanel({
  activeId,
  onSelect,
  requestsFromParent,
  loadingFromParent,
  search,
  onSearchChange,
  status,
  onStatusChange,
  hasMore,
  onLoadMore,
  onDeleteSuccess,
  onArchiveSuccess,
}: RequestListPanelProps) {
  const dispatch = useAppDispatch();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = filterScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const { items: apiItems, loading: apiLoading } = useAppSelector((s) => s.retailerDesigns);
  const [requests, setRequests] = useState<RequestData[]>([] as any);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Design list is fetched by the parent (page/dashboard). Do not trigger
  // a fetch here to avoid duplicate concurrent requests.
  useEffect(() => {
    // no-op: rely on parent to fetch designs
  }, [apiItems]);

  useEffect(() => {
    // map API items to RequestData shape used by this UI
    if (apiItems && apiItems.length > 0) {
      const generatedImages = {} as Record<string, string>;
      const mapped = (apiItems || [])
        .slice()
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .map((it) => {
          const created = it.created_at ? new Date(it.created_at) : null;
          const dateStr = created && !isNaN(created.getTime()) ? created.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) : '';
          const overrideImage = null;
          const statusVal = (it.status || '').trim().toUpperCase();
          let finalStatus = normalizeApiStatus(it.status);
          const designCodeOrId = it.design_code || String(it.id);
          if (typeof window !== 'undefined') {
            try {
              const isFailed = localStorage.getItem(`design_failed_${designCodeOrId}`) === 'true' ||
                localStorage.getItem(`design_failed_${it.id}`) === 'true' ||
                sessionStorage.getItem(`design_failed_${designCodeOrId}`) === 'true' ||
                sessionStorage.getItem(`design_failed_${it.id}`) === 'true';
              if (isFailed && (finalStatus === 'GENERATING' || finalStatus === 'PENDING' || finalStatus === 'PROCESSING')) {
                finalStatus = 'FAILED';
              }

              const isRefinementGenerating = localStorage.getItem(`refinement_generating_${designCodeOrId}`) === 'true' ||
                localStorage.getItem(`refinement_generating_${it.id}`) === 'true' ||
                sessionStorage.getItem(`refinement_generating_${designCodeOrId}`) === 'true' ||
                sessionStorage.getItem(`refinement_generating_${it.id}`) === 'true';
              if (isRefinementGenerating) {
                if (finalStatus !== 'COMPLETED' && finalStatus !== 'FAILED') {
                  finalStatus = 'GENERATING';
                }
              }
            } catch (e) { }
          }
          const isGenerating = finalStatus === 'GENERATING' || finalStatus === 'PENDING' || finalStatus === 'PROCESSING';
          const apiImage = isGenerating ? null : (it.input_image_url || it.input_image_urls?.[0] || overrideImage || null);
          const cacheBustedImage = apiImage ? getCacheBustedUrl(apiImage, it.updated_at) : null;
          return {
            id: designCodeOrId,
            type: it.jewellery_type || 'Custom',
            status: finalStatus,
            date: dateStr,
            listImage: cacheBustedImage,
            mainImage: cacheBustedImage,
            prompt: it.user_prompt || '',
            angles: [],
            drafts: [],
            customer: { name: '—', role: '', email: '', phone: '', location: '', avatar: placeholderImage({ query: 'person avatar', width: 80, height: 80, seq: `cust-${it.id}` }) },
            manufacturer: { name: '—', specialty: '', location: '', delivery: '', verified: false },
            specs: [],
            updatedAt: it.updated_at,
          };
        });
      setRequests(mapped as any);
    } else {
      // No API items — show empty list (do not use mock data)
      setRequests([]);
    }
  }, [apiItems]);

  const sourceList = requestsFromParent ?? requests;
  const isLoading = loadingFromParent ?? apiLoading;
  const filtered = sourceList.filter((r) => !hiddenIds.has(r.id)).sort((a, b) => {
    const aIsCompleted = a.status === 'Completed' || a.status === 'COMPLETED';
    const bIsCompleted = b.status === 'Completed' || b.status === 'COMPLETED';
    if (aIsCompleted && !bIsCompleted) return 1;
    if (!aIsCompleted && bIsCompleted) return -1;
    return 0;
  });

  useEffect(() => {
    if (!hasMore || !onLoadMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    const currentTarget = observerRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, onLoadMore, isLoading]);

  const resolveDesignId = (req: RequestData) => {
    const match = apiItems.find((it) => it.design_code === req.id || String(it.id) === req.id);
    return match?.id ?? null;
  };

  const handleArchive = async (req: RequestData) => {
    const designId = resolveDesignId(req);
    if (!designId) {
      toast.error('Missing design id for archive.');
      setConfirmArchiveId(null);
      return;
    }
    const resultAction = await dispatch(archiveDesign({ designId }));
    if (!archiveDesign.fulfilled.match(resultAction)) {
      const errorMsg = resultAction.payload || 'Failed to archive request.';
      toast.error(errorMsg);
      setConfirmArchiveId(null);
      return;
    }
    dispatch(fetchDesigns({
      limit: 16,
      page: 1,
      search: search.trim() || undefined,
      status: status === 'All' ? undefined : status,
    }));
    const entry: ArchivedRequestEntry = {
      id: req.id,
      type: req.type,
      customer: req.customer.name,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      reason: 'Manually archived',
    };
    const raw = localStorage.getItem('archivedRequests');
    const existing: ArchivedRequestEntry[] = raw ? JSON.parse(raw) : [];
    if (!existing.find((r) => r.id === entry.id)) {
      localStorage.setItem('archivedRequests', JSON.stringify([entry, ...existing]));
    }
    const target = requests.find((r) => r.id === req.id);
    if (target) {
      target.status = 'Completed';
      setRequests([...requests]);
    }
    setOpenMenuId(null);
    setConfirmArchiveId(null);
    toast.success('Request archived successfully.');
    onArchiveSuccess?.(req.id);
  };

  const handleDelete = async (req: RequestData) => {
    const designId = resolveDesignId(req);
    if (!designId) {
      toast.error('Missing design id for delete.');
      setConfirmDeleteId(null);
      return;
    }
    const resultAction = await dispatch(deleteDesign({ designId }));
    if (!deleteDesign.fulfilled.match(resultAction)) {
      const errorMsg = resultAction.payload || 'Failed to delete request.';
      toast.error(errorMsg);
      setConfirmDeleteId(null);
      return;
    }
    dispatch(fetchDesigns({
      limit: 16,
      page: 1,
      search: search.trim() || undefined,
      status: status === 'All' ? undefined : status,
    }));
    setHiddenIds((prev) => new Set(prev).add(req.id));
    setConfirmDeleteId(null);
    toast.success('Request deleted successfully.');
    onDeleteSuccess?.(req.id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <style>{`
        html.dark .request-skeleton-shimmer {
          background-color: #1A1F28 !important;
          background-image: linear-gradient(
            90deg,
            #1A1F28 0%,
            #2C3545 40%,
            #3A4559 50%,
            #2C3545 60%,
            #1A1F28 100%
          ) !important;
          background-size: 200% 100% !important;
          animation: skeleton-shimmer 1.6s ease-in-out infinite !important;
        }
      `}</style>
      <div className="relative mb-3">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <i className="ri-search-line text-[12px] sm:text-[13px] text-[#BDBDBD] dark:text-[#A1A8B3]"></i>
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value.replace(/^\s+/, ''))}
          onBlur={(e) => onSearchChange(e.target.value.trim())}
          placeholder="Search requests..."
          className="w-full pl-9 pr-4 py-2 rounded-[10px] bg-[#F3F4F6] dark:bg-surface-150 text-[11px] sm:text-[12px] text-[#1A1A1A] dark:text-ink placeholder:text-[#BDBDBD] dark:placeholder:text-ink-400 outline-none border border-transparent dark:border-border-default font-inter"
        />
      </div>

      <div ref={filterScrollRef} className="flex gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onStatusChange(f.value as RequestListPanelProps['status'])}
            className={`flex-shrink-0 px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap border border-transparent ${status === f.value
              ? 'bg-[#3B82F6] text-white dark:text-black shadow-[0px_2px_8px_rgba(59,130,246,0.30)] dark:bg-[#60A5FA]'
              : 'bg-[#F3F4F6] dark:bg-surface-150 text-[#6B7280] dark:text-ink-600 dark:border-border-default'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto flex-1 scrollbar-thin-neutral pr-0.5">
        {isLoading && filtered.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 sm:gap-3 p-3 rounded-[14px] bg-[#FAFAF8] dark:bg-surface-150 border border-transparent">
                <div className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 rounded-[10px] skeleton-shimmer request-skeleton-shimmer" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="h-3.5 w-16 skeleton-shimmer request-skeleton-shimmer rounded" />
                  </div>
                  <div className="h-2.5 w-14 skeleton-shimmer request-skeleton-shimmer rounded mb-2" />
                  <div className="flex items-center justify-between gap-1">
                    <div className="h-3.5 w-12 skeleton-shimmer request-skeleton-shimmer rounded-full" />
                    <div className="h-2.5 w-10 skeleton-shimmer request-skeleton-shimmer rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] dark:text-[#D1D5DB] text-[12px] sm:text-[13px]">
            <i className="ri-folder-open-line text-[28px] sm:text-[32px] mb-2 text-[#D1D5DB] dark:text-ink-600"></i>
            <p>No requests found</p>
          </div>
        ) : filtered.map((req) => {
          const s = statusStyles[req.status] || statusStyles.Draft;
          const isActive = req.id === activeId;
          const isCompleted = req.status === 'Completed';
          const isMenuOpen = openMenuId === req.id;
          const isGenerating = req.status === 'GENERATING' || req.status === 'PENDING' || req.status === 'PROCESSING';

          return (
            <div
              key={req.id}
              onClick={() => onSelect(req.id)}
              className={`relative group flex items-start gap-2.5 sm:gap-3 p-3 rounded-[14px] cursor-pointer transition-all duration-150 border ${isActive
                ? 'bg-blue-50/60 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 shadow-[0px_4px_12px_rgba(59,130,246,0.05)]'
                : 'bg-[#FAFAF8] dark:bg-surface-150 border-transparent hover:border-black/[0.04] dark:hover:border-border-default shadow-[0px_2px_8px_rgba(0,0,0,0.02)]'
                } ${isCompleted ? 'opacity-50 grayscale-[0.3]' : ''}`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[10px] overflow-hidden flex-shrink-0 relative ${isCompleted ? 'opacity-60' : ''}`}>
                  {isGenerating ? (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-950/20 text-[#3B82F6]">
                      <i className="ri-loader-4-line animate-spin text-[16px]"></i>
                    </div>
                  ) : req.listImage ? (
                    <img
                      src={req.listImage}
                      alt={req.type}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#F3F4F6] dark:bg-surface-150 text-[9px] text-[#9CA3AF] dark:text-[#D1D5DB]">
                      No image
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={`text-[11px] sm:text-[12.5px] font-semibold truncate font-satoshi ${isCompleted ? 'text-[#9CA3AF]' : 'text-[#1A1A1A] dark:text-[#E7EAEE]'}`}
                    >
                      {req.designCode || req.id}
                    </span>
                  </div>
                  <p className={`text-[10px] sm:text-[11px] mb-1.5 ${isCompleted ? 'text-[#C4C4C4]' : 'text-[#9CA3AF] dark:text-ink-600'}`}>{req.type}</p>
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}
                    >
                      {statusLabels[req.status] || req.status}
                    </span>
                    <span className={`text-[9px] sm:text-[10px] truncate ${isCompleted ? 'text-[#D1D5DB]' : 'text-[#C4C4C4]'}`}>{req.date.split(',')[0]}</span>
                  </div>
                </div>
              </div>

              {/* Three-dot dropdown */}
              <div className="relative flex-shrink-0" ref={isMenuOpen ? menuRef : undefined}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(isMenuOpen ? null : req.id);
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#F3F4F6] dark:hover:bg-surface-200 transition-all cursor-pointer opacity-0 group-hover:opacity-100 duration-150 mt-0.5"
                  title="More options"
                >
                  <i className="ri-more-2-fill text-[12px] text-[#9CA3AF] dark:text-[#A1A8B3]"></i>
                </button>

                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 rounded-[10px] overflow-hidden py-1 min-w-[150px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-surface-100 shadow-[0px_8px_24px_rgba(0,0,0,0.12),_0px_2px_6px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.06)] dark:border-border-default"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmArchiveId(req.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#6B7280] dark:text-ink-600 hover:bg-[#F3F4F6] dark:hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-archive-line text-[12px] dark:text-[#D1D5DB]"></i>
                      </span>
                      Archive Request
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        setConfirmDeleteId(req.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-delete-bin-line text-[12px]"></i>
                      </span>
                      Delete Request
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={`req-loadmore-skeleton-${i}`} className="flex items-start gap-2.5 sm:gap-3 p-3 rounded-[14px] bg-[#FAFAF8] dark:bg-surface-150 border border-transparent opacity-60">
                <div className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 rounded-[10px] skeleton-shimmer request-skeleton-shimmer" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="h-3.5 w-16 skeleton-shimmer request-skeleton-shimmer rounded" />
                  </div>
                  <div className="h-2.5 w-14 skeleton-shimmer request-skeleton-shimmer rounded mb-2" />
                  <div className="flex items-center justify-between gap-1">
                    <div className="h-3.5 w-12 skeleton-shimmer request-skeleton-shimmer rounded-full" />
                    <div className="h-2.5 w-10 skeleton-shimmer request-skeleton-shimmer rounded" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        {hasMore && !isLoading && (
          <div ref={observerRef} className="h-6 w-full flex-shrink-0" />
        )}
      </div>

      {/* Archive Confirmation Modal */}
      {confirmArchiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-surface-100 rounded-2xl p-6 w-[360px] shadow-xl border border-[#E5E7EB] dark:border-border-default">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-10 h-10 rounded-full bg-[#F3F4F6] dark:bg-surface-300 flex items-center justify-center mb-3">
                <i className="ri-archive-line text-[18px] text-[#6B7280] dark:text-[#A1A8B3]" />
              </div>
              <h3 className="text-[15px] font-semibold text-[#111827] dark:text-ink mb-1">Archive Request</h3>
              <p className="text-[12px] text-[#6B7280] dark:text-ink-600">Are you sure you want to archive this request? It will be moved to the Archive tab.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmArchiveId(null)}
                className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold text-[#6B7280] dark:text-ink-600 bg-[#F3F4F6] dark:bg-surface-150 hover:bg-[#E5E7EB] dark:hover:bg-surface-200 transition-colors cursor-pointer whitespace-nowrap border border-transparent dark:border-border-default"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const req = requests.find((r) => r.id === confirmArchiveId);
                  if (req) void handleArchive(req);
                }}
                className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold text-white bg-[#6B7280] hover:bg-[#4B5563] transition-colors cursor-pointer whitespace-nowrap"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-surface-100 rounded-2xl p-6 w-[360px] shadow-xl border border-[#E5E7EB] dark:border-border-default">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-10 h-10 rounded-full bg-[#EFF6FF] dark:bg-blue-500/10 flex items-center justify-center mb-3">
                <i className="ri-alert-line text-[18px] text-[#2563EB]" />
              </div>
              <h3 className="text-[15px] font-semibold text-[#111827] dark:text-ink mb-1">Remove Request</h3>
              <p className="text-[12px] text-[#6B7280] dark:text-ink-600">Are you sure you want to remove this request from the list?</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold text-[#6B7280] dark:text-ink-600 bg-[#F3F4F6] dark:bg-surface-150 hover:bg-[#E5E7EB] dark:hover:bg-surface-200 transition-colors cursor-pointer whitespace-nowrap border border-transparent dark:border-border-default"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const req = requests.find((r) => r.id === confirmDeleteId);
                  if (req) void handleDelete(req);
                }}
                className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#60A5FA] dark:text-black dark:hover:bg-[#60A5FA]/90 transition-colors cursor-pointer whitespace-nowrap"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
