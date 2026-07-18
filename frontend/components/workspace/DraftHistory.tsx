'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAppDispatch } from '@/redux/hooks';
import { archiveVariant } from '@/redux/slices/retailer/designVariantArchiveSlice';
import { deleteVariant } from '@/redux/slices/retailer/designVariantDeleteSlice';
import { fetchVariantsByDesignId, fetchVariantById, resetVariantsState, resetSingleVariantState } from '@/redux/slices/retailer/designVariantSlice';

interface Draft {
  version: string;
  label: string;
  image: string;
  base_design_image_url?: string;
  variantId?: string | number;
  timestamp: string;
  isCurrent: boolean;
  isGenerating?: boolean;
}

interface DraftHistoryProps {
  drafts: Draft[];
  loading?: boolean;
  onSwitchVersion?: (version: string) => void;
  onArchiveVersion?: (draft: Draft, requestId: string, type: string) => void;
  activeRequestId?: string;
  activeRequestType?: string;
  onDeleteVersion?: (draft: Draft) => void;
  designId?: string | number | null;
}

export default function DraftHistory({ drafts: initialDrafts, loading = false, onSwitchVersion, onArchiveVersion, activeRequestId, activeRequestType, onDeleteVersion, designId }: DraftHistoryProps) {
  const dispatch = useAppDispatch();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [openMenuVersion, setOpenMenuVersion] = useState<string | null>(null);
  const [confirmArchiveVersion, setConfirmArchiveVersion] = useState<Draft | null>(null);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<Draft | null>(null);
  const [showArchiveToast, setShowArchiveToast] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrafts(initialDrafts);
  }, [initialDrafts]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const targetNode = e.target as Node;
      const targetEl = e.target as HTMLElement;

      if (menuRef.current?.contains(targetNode)) return;
      if (targetEl.closest('[data-draft-menu-trigger="true"]')) return;

      setOpenMenuVersion(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!openMenuVersion) return;
    const handleViewportChange = () => {
      setOpenMenuVersion(null);
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [openMenuVersion]);

  const handleDelete = async (draft: Draft) => {
    if (!draft.variantId) {
      toast.error('Missing variant id for delete.');
      setOpenMenuVersion(null);
      return;
    }
    const resultAction = await dispatch(deleteVariant({ variantId: draft.variantId }));
    if (!deleteVariant.fulfilled.match(resultAction)) {
      const errorMsg = resultAction.payload || 'Failed to delete variant.';
      toast.error(errorMsg);
      setOpenMenuVersion(null);
      return;
    }
    setDrafts((prev) => prev.filter((d) => d.version !== draft.version));
    setOpenMenuVersion(null);
    // Notify parent to refresh variants or take other actions after delete
    try {
      onDeleteVersion?.(draft);
    } catch (e) {
      console.error('[DraftHistory] onDeleteVersion callback failed', e);
    }
  };

  const openDraft = openMenuVersion ? drafts.find((d) => d.version === openMenuVersion) ?? null : null;

  return (
    <div>
      <h4 className="text-[12px] sm:text-[13px] font-semibold text-[#6B7280] mb-3 uppercase tracking-wide pt-4 border-t border-hairline font-satoshi">
        Draft History
      </h4>

      <div className="flex items-start gap-2 sm:gap-3 overflow-x-auto overflow-y-visible pb-28 pr-10 scrollbar-hide snap-x snap-mandatory">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`draft-skeleton-${index}`} className="relative flex-shrink-0 w-[115px] sm:w-[120px] snap-start">
              <div className="relative rounded-[12px] overflow-hidden border border-[rgba(0,0,0,0.04)] dark:border-border-default bg-[#F3F4F6] dark:bg-[#1E2530] animate-pulse">
                <div className="aspect-square w-full bg-gradient-to-br from-[#F3F4F6] via-[#E5E7EB] to-[#F3F4F6] dark:from-surface-150 dark:via-surface-200 dark:to-surface-150" />
              </div>
              <div className="mt-1.5 space-y-1">
                <div className="h-3 w-20 rounded bg-[#E5E7EB] dark:bg-surface-200 animate-pulse" />
                <div className="h-2.5 w-14 rounded bg-[#E5E7EB] dark:bg-surface-200 animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          <>
            {drafts.map((draft) => (
              <div
                key={draft.version}
                className="relative flex-shrink-0 w-[108px] sm:w-[120px] snap-start"
              >
                <div
                  className={`relative rounded-[12px] overflow-hidden transition-all duration-200 cursor-pointer group shadow-none border ${draft.isCurrent ? 'border-[rgba(0,0,0,0.04)]' : 'border-transparent'
                    } ${draft.isCurrent ? '' : 'group-hover:shadow-[0_4px_16px_0_rgba(59,130,246,0.15)]'}`}
                  onClick={() => onSwitchVersion && onSwitchVersion(draft.version)}
                >
                  {draft.base_design_image_url || draft.image ? (
                    <img
                      src={draft.base_design_image_url || draft.image}
                      alt={draft.label}
                      className="w-full aspect-square object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-[#F3F4F6] dark:bg-[#1E2530] animate-pulse flex items-center justify-center">
                      <i className="ri-image-line text-[16px] text-gray-400 dark:text-[#D1D5DB]" />
                    </div>
                  )}

                  {draft.isCurrent && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-[#3B82F6] text-white text-[8px] sm:text-[9px] font-semibold">
                      Current
                    </div>
                  )}

                  {draft.isGenerating && (
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[2.5px] flex flex-col items-center justify-center gap-1.5 z-10 pointer-events-none">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span className="text-[7.5px] sm:text-[8px] font-bold text-white uppercase tracking-wider font-satoshi">Generating...</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                    {!draft.isCurrent && !draft.isGenerating && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-white bg-black/50 px-2 py-0.5 rounded-full">
                        Switch
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-1.5 flex flex-col gap-0.5">
                  {/* Row 1: Version Name & Three-Dot Menu */}
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] sm:text-[11.5px] font-medium text-[#1A1A1A] truncate dark:text-white">
                      {draft.version}
                    </p>
                    <div className="relative flex-shrink-0">
                      <button
                        disabled={drafts.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation();

                          if (openMenuVersion === draft.version) {
                            setOpenMenuVersion(null);
                            return;
                          }
                          setOpenMenuVersion(draft.version);
                        }}
                        data-draft-menu-trigger="true"
                        className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                          drafts.length <= 1
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-[#F3F4F6] dark:hover:bg-zinc-800 cursor-pointer'
                        }`}
                        title={drafts.length <= 1 ? "Cannot delete or archive the only version" : "More options"}
                      >
                        <i className="ri-more-2-fill text-[11px] sm:text-[12px] text-[#9CA3AF]"></i>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Date & Timestamp */}
                  <p className="text-[9px] sm:text-[10px] text-[#9CA3AF] truncate w-full">
                    {draft.timestamp}
                  </p>
                </div>

                {/* Dropdown Menu - Card level positioning to prevent clipping */}
                {openMenuVersion === draft.version && (
                  <div
                    ref={menuRef}
                    className="absolute left-0 top-[calc(100%+4px)] z-[80] rounded-[10px] overflow-hidden py-1 min-w-[140px] bg-white dark:bg-[#171C22] dark:border dark:border-zinc-700/60 shadow-[0px_8px_24px_rgba(0,0,0,0.12),_0px_2px_6px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.06)]"
                  >
                    <button
                      disabled={drafts.length <= 1}
                      onClick={(e) => {
                        if (drafts.length <= 1) return;
                        e.stopPropagation();
                        setOpenMenuVersion(null);
                        setConfirmArchiveVersion(openDraft);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors whitespace-nowrap ${
                        drafts.length <= 1
                          ? 'text-gray-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
                          : 'text-[#6B7280] hover:bg-[#F3F4F6] dark:hover:bg-zinc-800/80 cursor-pointer'
                      }`}
                    >
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-archive-line text-[12px]"></i>
                      </span>
                      Archive version
                    </button>
                    <button
                      disabled={drafts.length <= 1}
                      onClick={(e) => {
                        if (drafts.length <= 1) return;
                        e.stopPropagation();
                        setOpenMenuVersion(null);
                        setConfirmDeleteVersion(draft);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors whitespace-nowrap ${
                        drafts.length <= 1
                          ? 'text-gray-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
                          : 'text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-zinc-800/80 cursor-pointer'
                      }`}
                    >
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-delete-bin-line text-[12px]"></i>
                      </span>
                      Delete version
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Archive Version Confirmation Modal */}
      {confirmArchiveVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-[360px] shadow-xl border border-[#E5E7EB] dark:bg-surface-100 dark:border-border-default">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-10 h-10 rounded-full bg-[#F3F4F6] dark:bg-surface-300 flex items-center justify-center mb-3">
                <i className="ri-archive-line text-[18px] text-[#6B7280]" />
              </div>
              <h3 className="text-[15px] font-semibold text-[#111827] mb-1">Archive Version</h3>
              <p className="text-[12px] text-[#6B7280]">Are you sure you want to archive {confirmArchiveVersion.version}? It will be moved to the Archive tab.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmArchiveVersion(null)}
                className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold text-[#6B7280] dark:text-ink-600 bg-[#F3F4F6] dark:bg-surface-150 hover:bg-[#E5E7EB] dark:hover:bg-surface-200 transition-colors cursor-pointer whitespace-nowrap border border-transparent dark:border-border-default"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!confirmArchiveVersion?.variantId) {
                    toast.error('Missing variant id for archive.');
                    setConfirmArchiveVersion(null);
                    return;
                  }
                  const resultAction = await dispatch(archiveVariant({ variantId: confirmArchiveVersion.variantId }));
                  if (!archiveVariant.fulfilled.match(resultAction)) {
                    const errorMsg = resultAction.payload || 'Failed to archive variant.';
                    toast.error(errorMsg);
                    setConfirmArchiveVersion(null);
                    return;
                  }
                  onArchiveVersion?.(confirmArchiveVersion, activeRequestId ?? '', activeRequestType ?? '');
                  if (designId !== undefined && designId !== null) {
                    dispatch(resetVariantsState());
                    dispatch(resetSingleVariantState());
                    try {
                      const freshVariants = await dispatch(fetchVariantsByDesignId({ designId })).unwrap();
                      toast.success('Version archived successfully');
                      // Also fetch the newest remaining variant's full detail
                      const newestVariant = freshVariants.length > 0
                        ? [...freshVariants].sort((a: any, b: any) => {
                            const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
                            const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
                            return tB - tA;
                          })[0]
                        : null;
                      if (newestVariant?.id) {
                        dispatch(fetchVariantById({ variantId: newestVariant.id }));
                      }
                    } catch (err: any) {
                      const refreshError = err || 'Version archived, but failed to refresh variants.';
                      toast.error(String(refreshError));
                    }
                  } else {
                    toast.success('Version archived successfully');
                  }
                  setDrafts((prev) => prev.filter((d) => d.version !== confirmArchiveVersion.version));
                  setConfirmArchiveVersion(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold text-white bg-[#6B7280] hover:bg-[#4B5563] transition-colors cursor-pointer whitespace-nowrap"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Version Confirmation Modal */}
      {confirmDeleteVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
          <div className="bg-white dark:bg-surface-100 rounded-2xl p-6 w-[calc(100vw-2rem)] max-w-[360px] shadow-xl border border-[#E5E7EB] dark:border-border-default flex flex-col items-center text-center animate-modal-enter">
            <div className="w-12 h-12 rounded-full bg-[#EFF6FF] dark:bg-blue-950/40 flex items-center justify-center mb-4">
              <i className="ri-alert-line text-[20px] text-[#2563EB] dark:text-[#3B82F6]" />
            </div>
            <h3 className="text-[16px] font-bold text-[#111827] dark:text-white mb-2 font-satoshi">Remove Version</h3>
            <p className="text-[13px] text-[#6B7280] dark:text-zinc-400 mb-6 font-inter leading-relaxed max-w-[280px]">
              Are you sure you want to remove this version from the list?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setConfirmDeleteVersion(null)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#4B5563] dark:text-zinc-300 bg-[#F3F4F6] dark:bg-surface-150 hover:bg-[#E5E7EB] dark:hover:bg-surface-200 transition-colors cursor-pointer whitespace-nowrap border border-transparent dark:border-border-default"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const target = confirmDeleteVersion;
                  setConfirmDeleteVersion(null);
                  await handleDelete(target);
                }}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#60A5FA] dark:text-black dark:hover:bg-[#60A5FA]/90 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
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
