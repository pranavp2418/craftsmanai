'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import TopBar from '@/components/TopBar';
import ManufacturerListPanel from './ManufacturerListPanel';
import ManufacturerHeader from './ManufacturerHeader';
import SentRequests from './SentRequests';
import ProductionTimeline from './ProductionTimeline';
import { Manufacturer, ManufacturerRequest, ProductionStep } from '@/lib/manufacturersData';
import { placeholderImage } from '@/lib/placeholders';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  ManufacturerApiResponse,
  deleteManufacturer,
  fetchManufacturerById,
  updateManufacturer,
} from '@/redux/slices/retailer/manufacturerSlice';

function formatShortDate(value?: string): string {
  if (!value) return '—';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const [, year, monthStr, dayStr] = match;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(monthStr, 10) - 1;
  const month = months[monthIdx] || monthStr;
  const day = parseInt(dayStr, 10);
  return `${month} ${day}, ${year}`;
}

function formatCurrency(value?: number | string): string {
  if (typeof value === 'number') return `$${value.toLocaleString()}`;
  if (typeof value === 'string' && value.trim()) return value;
  return '$0';
}

function mapManufacturerStatus(status?: string): Manufacturer['status'] {
  const normalized = (status ?? '').toLowerCase();
  if (normalized.includes('inactive') || normalized.includes('delay')) return 'Inactive';
  return 'Active';
}

function mapRequestStatus(status?: string): ManufacturerRequest['status'] {
  const normalized = (status ?? '').toLowerCase();
  if (normalized.includes('quote')) return 'Quote Received';
  if (normalized.includes('approved')) return 'Approved';
  if (normalized.includes('production')) return 'In Production';
  if (normalized.includes('complete')) return 'Completed';
  if (normalized.includes('view')) return 'Viewed';
  return 'Sent';
}

const requestStyles: Record<ManufacturerRequest['status'], { color: string; bg: string; noteColor: string; noteBg: string }> = {
  Sent: { color: 'text-ink-500', bg: 'bg-tint-gray', noteColor: 'text-ink-500', noteBg: 'bg-tint-gray' },
  Viewed: { color: 'text-ink-500', bg: 'bg-tint-gray', noteColor: 'text-ink-500', noteBg: 'bg-tint-gray' },
  'Quote Received': { color: 'text-warning-medium', bg: 'bg-tint-amber-strong', noteColor: 'text-warning-medium', noteBg: 'bg-tint-amber-soft' },
  Approved: { color: 'text-success', bg: 'bg-tint-success', noteColor: 'text-success', noteBg: 'bg-tint-success' },
  'In Production': { color: 'text-violet-deep', bg: 'bg-tint-violet', noteColor: 'text-violet-deep', noteBg: 'bg-tint-violet-soft' },
  Completed: { color: 'text-success', bg: 'bg-tint-success', noteColor: 'text-success', noteBg: 'bg-tint-success' },
};

function mapProductionSteps(steps: any[]): ProductionStep[] {
  return steps.map((step, index) => ({
    label: String(step.label ?? step.name ?? step.stage ?? `Step ${index + 1}`),
    date: formatShortDate(step.date ?? step.timestamp ?? step.created_at ?? step.time),
    done: Boolean(step.done ?? step.completed ?? step.is_done),
    active: Boolean(step.active ?? step.current ?? step.is_current),
  }));
}

function mapManufacturerRequest(
  req: any,
  index: number,
  productionTimeline: any[] = []
): ManufacturerRequest {
  const status = mapRequestStatus(req?.status);
  const style = requestStyles[status];

  const dateSentRaw =
    req?.created_at ??
    req?.sent_at ??
    req?.date_sent;

  const dateSent = formatShortDate(dateSentRaw);

  const timeline =
    productionTimeline.length > 0
      ? productionTimeline.map((step, idx) => ({
        label: step.action_type,
        date: formatShortDate(step.created_at),
        done: idx < productionTimeline.length - 1,
        active: idx === productionTimeline.length - 1,
        description: step.message,
      }))
      : [
        {
          label: status,
          date: dateSent,
          done: true,
          active: true,
        },
      ];

  return {
    id: req.design_code || String(req.id),
    type:
      req.name ||
      req.jewellery_type ||
      'Request',

    dateSent,

    status,

    statusColor: style.color,
    statusBg: style.bg,

    image:
      req.thumbnail_url ||
      req.image_url || "/NoPreview.png",

    statusNote: req.status || '—',

    statusNoteColor: style.noteColor,
    statusNoteBg: style.noteBg,

    latestNote:
      // @ts-ignore
      timeline[timeline.length - 1]?.description ||
      '—',

    timeline,
  };
}

function mapApiManufacturer(item: ManufacturerApiResponse): Manufacturer {
  const specialty = item.speciality ?? '';
  const stats = item.stats ?? {};

  const manufacturerTimeline =
    Array.isArray((item as any).production_timeline)
      ? (item as any).production_timeline
      : [];

  const requests = Array.isArray(item.sent_requests)
    ? item.sent_requests.map((req, index) =>
      mapManufacturerRequest(req, index, manufacturerTimeline)
    )
    : [];

  const initials = item.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const primaryEmail = item.emails?.[0]?.email || '';

  return {
    id: `m${item.id}`,
    name: item.name,
    initials,
    avatarColor: 'bg-surface-avatar-blue',
    email: primaryEmail,
    emails: item.emails?.map((e) => ({
      label: e.label,
      value: e.email,
    })) ?? [],
    phone: item.phone_number || '',
    location: item.location || '',
    specialty,
    status: mapManufacturerStatus(item.status),
    lastActivity: formatShortDate(
      stats.last_activity ?? item.updated_at
    ),
    totalRequests: stats.total_requests ?? requests.length,
    completedRequests: stats.completed_requests ?? 0,
    pendingRequests: stats.pending_requests ?? 0,
    totalProfit: formatCurrency(stats.total_profit),
    avgResponseTime: stats.avg_response_time ?? '—',
    requests,
  };
}

function ManufacturerDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-sheet p-4 sm:p-6 bg-gradient-surface dark:bg-none dark:bg-surface-100 shadow-card-lg backdrop-blur-md border border-glass dark:border-border-default">
        <div className="flex flex-col xl:flex-row xl:items-start gap-4 xl:gap-5">
          <div className="w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] rounded-full skeleton-shimmer flex-shrink-0" />

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="h-6 w-52 rounded-card skeleton-shimmer" />
              <div className="h-5 w-24 rounded-full skeleton-shimmer" />
              <div className="h-5 w-28 rounded-full skeleton-shimmer" />
            </div>
            <div className="space-y-2.5">
              <div className="h-4 w-80 max-w-full rounded-card skeleton-shimmer" />
              <div className="h-4 w-64 max-w-full rounded-card skeleton-shimmer" />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap xl:flex-shrink-0 w-full xl:w-auto">
            <div className="h-10 w-full sm:w-36 rounded-card skeleton-shimmer" />
            <div className="h-10 w-full sm:w-40 rounded-card skeleton-shimmer" />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border-default flex items-center gap-2 flex-wrap">
          <div className="h-4 w-44 rounded-card skeleton-shimmer" />
          <div className="h-4 w-36 rounded-card skeleton-shimmer" />
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-sheet p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-card-soft bg-white dark:bg-surface-100 border border-transparent dark:border-border-default">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-card-lg sm:rounded-section skeleton-shimmer flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-3 w-24 rounded-card skeleton-shimmer" />
              <div className="h-5 w-28 rounded-card skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
        <div className="rounded-sheet-lg p-4 sm:p-6 shadow-card-soft bg-white dark:bg-surface-100 border border-transparent dark:border-border-default">
          <div className="flex items-center justify-between mb-5">
            <div className="h-6 w-40 rounded-card skeleton-shimmer" />
            <div className="h-6 w-24 rounded-full skeleton-shimmer" />
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-panel border-1.5 border-border-default">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-card-lg skeleton-shimmer flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 w-36 max-w-full rounded-card skeleton-shimmer" />
                  <div className="h-3.5 w-52 max-w-full rounded-card skeleton-shimmer" />
                </div>
                <div className="h-8 w-20 rounded-full skeleton-shimmer flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sheet-lg p-4 sm:p-6 shadow-card-soft bg-white dark:bg-surface-100 border border-transparent dark:border-border-default">
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 w-36 rounded-card skeleton-shimmer" />
            <div className="h-6 w-20 rounded-full skeleton-shimmer" />
          </div>
          <div className="flex flex-col gap-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-8 h-8 sm:w-[34px] sm:h-[34px] rounded-full skeleton-shimmer" />
                  {index < 3 && <div className="w-px flex-1 mt-1.5 mb-1.5 bg-surface-200 min-h-[24px]" />}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 w-36 rounded-card skeleton-shimmer" />
                  <div className="h-3.5 w-full rounded-card skeleton-shimmer" />
                  <div className="h-3.5 w-4/5 rounded-card skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NoManufacturerState() {
  return (
    <div className="min-h-[calc(100vh-220px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px] rounded-sheet-lg border border-dashed border-border-default bg-gradient-to-b from-white to-surface-50 dark:from-surface-100 dark:to-surface-150 shadow-card-lg px-6 sm:px-10 py-10 sm:py-12 text-center">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-brand-light dark:bg-brand/15 flex items-center justify-center shadow-glow-avatar dark:shadow-none">
          <i className="ri-building-2-line text-heading text-brand dark:text-brand" />
        </div>
        <p className="text-ui font-bold text-ink-900 dark:text-ink font-satoshi">No manufacturer selected</p>
        <p className="mt-2 text-body-sm text-ink-400 dark:text-[#D1D5DB] max-w-[420px] mx-auto">
          Choose a manufacturer from the list to view their details, sent requests, and production progress.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-label-sm text-ink-400 dark:text-[#D1D5DB] flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-150 border border-border-default">
            <span className="w-2 h-2 rounded-full bg-brand" />
            Manufacturer details
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-150 border border-border-default">
            <span className="w-2 h-2 rounded-full bg-warning-medium" />
            Requests
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-150 border border-border-default">
            <span className="w-2 h-2 rounded-full bg-violet-accent" />
            Timeline
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ManufacturersPage() {
  const dispatch = useAppDispatch();
  const {
    items,
    listStatus,
    listError,
    detailItem,
    detailStatus,
    detailError,
    updateStatus,
    updateError,
    createStatus,
    createError,
    lastDeletedId,
    deleteStatus,
    deleteError,
  } = useAppSelector(
    (state) => state.retailerManufacturer
  );
  const prevCreateStatus = useRef(createStatus);
  const prevUpdateStatus = useRef(updateStatus);
  const prevDeleteStatus = useRef(deleteStatus);
  const prevListStatus = useRef(listStatus);
  const prevDetailStatus = useRef(detailStatus);
  const [activeId, setActiveId] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    if (createStatus === 'succeeded' && prevCreateStatus.current !== 'succeeded') {
      toast.success('Manufacturer created.');
    }
    if (createStatus === 'failed' && prevCreateStatus.current !== 'failed') {
      toast.error(createError || 'Failed to create manufacturer.');
    }
    prevCreateStatus.current = createStatus;
  }, [createStatus, createError]);

  useEffect(() => {
    if (updateStatus === 'succeeded' && prevUpdateStatus.current !== 'succeeded') {
      toast.success('Manufacturer updated.');
    }
    if (updateStatus === 'failed' && prevUpdateStatus.current !== 'failed') {
      toast.error(updateError || 'Failed to update manufacturer.');
    }
    prevUpdateStatus.current = updateStatus;
  }, [updateStatus, updateError]);

  useEffect(() => {
    if (deleteStatus === 'succeeded' && prevDeleteStatus.current !== 'succeeded') {
      toast.success('Manufacturer deleted.');
    }
    if (deleteStatus === 'failed' && prevDeleteStatus.current !== 'failed') {
      toast.error(deleteError || 'Failed to delete manufacturer.');
    }
    prevDeleteStatus.current = deleteStatus;
  }, [deleteStatus, deleteError]);

  useEffect(() => {
    if (listStatus === 'failed' && prevListStatus.current !== 'failed') {
      toast.error(listError || 'Failed to load manufacturers.');
    }
    prevListStatus.current = listStatus;
  }, [listStatus, listError]);

  useEffect(() => {
    if (detailStatus === 'failed' && prevDetailStatus.current !== 'failed') {
      toast.error(detailError || 'Failed to load manufacturer.');
    }
    prevDetailStatus.current = detailStatus;
  }, [detailStatus, detailError]);

  useEffect(() => {
    if (listStatus !== 'succeeded') return;

    if (activeId && !items.some((m) => `m${m.id}` === activeId)) {
      setActiveId('');
      setSelectedRequestId('');
    }
  }, [items, listStatus, activeId]);

  useEffect(() => {
    if (deleteStatus !== 'succeeded' || !lastDeletedId) return;

    const deletedId = `m${lastDeletedId}`;
    setActiveId((prev) => (prev === deletedId ? '' : prev));
    setSelectedRequestId('');
  }, [lastDeletedId, deleteStatus]);

  const manufacturers = useMemo(
    () => items.map(mapApiManufacturer),
    [items]
  );

  const detailManufacturer = useMemo(
    () => (detailStatus === 'succeeded' && detailItem ? mapApiManufacturer(detailItem) : null),
    [detailItem, detailStatus]
  );

  const selectedManufacturer = useMemo(
    () => detailManufacturer?.id === activeId
      ? detailManufacturer
      : manufacturers.find((m) => m.id === activeId) ?? null,
    [activeId, detailManufacturer, manufacturers]
  );

  const selectedRequest = useMemo(
    () => selectedManufacturer?.requests.find((r) => r.id === selectedRequestId) ?? selectedManufacturer?.requests[0],
    [selectedManufacturer, selectedRequestId]
  );

  const showDetailSkeleton =
    listStatus === 'loading' ||
    detailStatus === 'loading' ||
    (Boolean(activeId) && !selectedManufacturer && (listStatus === 'idle' || listStatus === 'succeeded'));

  const handleSelectManufacturer = (m: Manufacturer) => {
    setActiveId(m.id);
    setSelectedRequestId(m.requests[0]?.id ?? '');
    setMobileView('detail');

    const numericId = Number(m.id.replace(/^m/, ''));
    if (!Number.isNaN(numericId)) {
      dispatch(fetchManufacturerById(numericId));
    }
  };

  const handleAddManufacturer = (_m: Manufacturer) => { };

  const handleEditManufacturer = (updated: Manufacturer) => {
    const numericId = Number(updated.id.replace(/^m/, ''));
    const payload = {
      name: updated.name,
      speciality: updated.specialty,
      emails: (updated.emails ?? []).map((e) => ({ label: e.label, email: e.value })),
      phone_number: updated.phone,
      location: updated.location,
      is_active: updated.status === 'Active',
    };

    if (!Number.isNaN(numericId)) {
      dispatch(updateManufacturer({ manufacturerId: numericId, payload }));
    }
  };

  const handleDeleteManufacturer = (id: string) => {
    const numericId = Number(id.replace(/^m/, ''));
    if (!Number.isNaN(numericId)) {
      dispatch(deleteManufacturer(numericId));
    }
  };

  return (
    <div className="min-h-screen bg-surface-page">
      <TopBar />

      <div className="max-w-[1350px] mx-auto px-4 sm:px-6 pb-6 lg:pb-8 pt-4 lg:pt-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-5 lg:h-[calc(100vh-120px)]">
          <div
            className={`${[
              'rounded-sheet p-4 flex flex-col w-full lg:w-[280px] flex-shrink-0',
              mobileView === 'list' ? 'flex' : 'hidden',
              'lg:flex',
            ].join(' ')} bg-white dark:bg-surface-100 border border-transparent dark:border-border-default shadow-card h-[calc(100dvh-104px)] lg:h-[calc(100vh-120px)] overflow-hidden`}
          >
            <ManufacturerListPanel
              manufacturers={manufacturers}
              selectedId={activeId}
              onSelect={handleSelectManufacturer}
              onAdd={handleAddManufacturer}
            />
          </div>

          <div
            className={`${[
              'flex-1 min-w-0 overflow-y-auto rounded-sheet px-4 sm:px-6 py-5 sm:py-6 h-[calc(100dvh-104px)] lg:h-[calc(100vh-120px)]',
              mobileView === 'detail' ? 'block' : 'hidden',
              'lg:block',
            ].join(' ')} bg-gradient-paper dark:bg-none dark:bg-[#171C22] shadow-card`}
          >
            {/* Mobile back button */}
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="lg:hidden flex items-center gap-2 mb-4 text-body-sm font-medium text-ink-500 hover:text-ink min-h-touch"
            >
              <i className="ri-arrow-left-line text-heading-xs" />
              All Manufacturers
            </button>

            {showDetailSkeleton ? (
              <ManufacturerDetailSkeleton />
            ) : selectedManufacturer ? (
              <>
                <ManufacturerHeader
                  manufacturer={selectedManufacturer}
                  onEdit={handleEditManufacturer}
                  onDelete={handleDeleteManufacturer}
                />

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
                  <div className="w-full">
                    <SentRequests
                      requests={selectedManufacturer.requests}
                      selectedId={selectedRequest?.id ?? ''}
                      onSelect={(req) => setSelectedRequestId(req.id)}
                    />
                  </div>
                  <div className="min-w-0">
                    <ProductionTimeline request={selectedRequest} />
                  </div>
                </div>
              </>
            ) : (
              <NoManufacturerState />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
