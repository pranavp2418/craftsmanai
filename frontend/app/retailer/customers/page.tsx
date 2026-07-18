'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import TopBar from '@/components/TopBar';
import CustomerListPanel from './CustomerListPanel';
import CustomerHeader from './CustomerHeader';
import CustomerInsights from './CustomerInsights';
import LinkedProjects from './LinkedProjects';
import ActivityTimeline from './ActivityTimeline';
import { Customer } from '@/lib/customersData';
import { placeholderImage } from '@/lib/placeholders';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  CustomerApiResponse,
  fetchCustomerById,
  updateCustomer,
  deleteCustomer,
} from '@/redux/slices/retailer/customerSlice';

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '-';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return withTime
      ? date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const [, year, monthStr, dayStr, hourStr, minStr] = match;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(monthStr, 10) - 1;
  const month = months[monthIdx] || monthStr;
  const day = parseInt(dayStr, 10);
  if (withTime) {
    const hour24 = parseInt(hourStr, 10);
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    return `${month} ${day}, ${year}, ${hour12}:${minStr} ${ampm}`;
  }
  return `${month} ${day}, ${year}`;
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function mapStatusStyle(status?: string | null) {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('await')) return { statusColor: 'text-danger', statusBg: 'bg-tint-danger' };
  if (normalized.includes('approve')) return { statusColor: 'text-success', statusBg: 'bg-tint-success' };
  if (normalized.includes('shared')) return { statusColor: 'text-success-medium', statusBg: 'bg-tint-emerald' };
  if (normalized.includes('production')) return { statusColor: 'text-violet-deep', statusBg: 'bg-tint-violet' };
  if (normalized.includes('delivered')) return { statusColor: 'text-ink-500', statusBg: 'bg-tint-gray' };
  return { statusColor: 'text-ink-500', statusBg: 'bg-tint-gray' };
}

function mapActivityStyle(action?: string | null) {
  const normalized = (action || '').toLowerCase();
  if (normalized.includes('approved')) return { icon: 'ri-checkbox-circle-line', iconColor: 'text-success', iconBg: 'bg-tint-success' };
  if (normalized.includes('shared')) return { icon: 'ri-share-forward-line', iconColor: 'text-brand', iconBg: 'bg-tint-brand' };
  if (normalized.includes('feedback')) return { icon: 'ri-chat-3-line', iconColor: 'text-warning', iconBg: 'bg-tint-warning' };
  if (normalized.includes('render')) return { icon: 'ri-image-line', iconColor: 'text-brand', iconBg: 'bg-tint-brand' };
  if (normalized.includes('request')) return { icon: 'ri-add-circle-line', iconColor: 'text-violet-accent', iconBg: 'bg-tint-violet' };
  return { icon: 'ri-notification-3-line', iconColor: 'text-ink-500', iconBg: 'bg-tint-gray' };
}

function DetailPanelSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-sheet p-4 sm:p-6 bg-gradient-surface dark:bg-none dark:bg-surface-100 shadow-card-lg backdrop-blur-md border border-glass dark:border-border-default">
        <div className="flex flex-col xl:flex-row xl:items-start gap-4 xl:gap-5">
          <div className="flex-shrink-0">
            <div className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] rounded-full skeleton-shimmer" />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="h-6 w-48 rounded-card skeleton-shimmer" />
              <div className="h-5 w-24 rounded-full skeleton-shimmer" />
            </div>
            <div className="space-y-2.5">
              <div className="h-4 w-72 max-w-full rounded-card skeleton-shimmer" />
              <div className="h-4 w-64 max-w-full rounded-card skeleton-shimmer" />
              <div className="h-4 w-56 max-w-full rounded-card skeleton-shimmer" />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap xl:flex-shrink-0 w-full xl:w-auto">
            <div className="h-10 w-full sm:w-32 rounded-card skeleton-shimmer" />
            <div className="h-10 w-full sm:w-36 rounded-card skeleton-shimmer" />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border-default flex items-center gap-2 flex-wrap">
          <div className="h-4 w-44 rounded-card skeleton-shimmer" />
          <div className="h-4 w-32 rounded-card skeleton-shimmer" />
        </div>
      </div>

      <div className="grid grid-cols-2 2xl:grid-cols-4 gap-3 lg:gap-4 mb-5">
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

      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_340px] gap-5">
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

function NoCustomerState() {
  return (
    <div className="min-h-[calc(100vh-220px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px] rounded-sheet-lg border border-dashed border-border-default bg-gradient-to-b from-white to-surface-50 dark:from-surface-100 dark:to-surface-150 shadow-card-lg px-6 sm:px-10 py-10 sm:py-12 text-center">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-brand-light dark:bg-brand/15 flex items-center justify-center shadow-glow-avatar dark:shadow-none">
          <i className="ri-user-search-line text-heading text-brand dark:text-brand" />
        </div>
        <p className="text-ui font-bold text-ink-900 dark:text-ink font-satoshi">No customer selected</p>
        <p className="mt-2 text-body-sm text-ink-400 dark:text-[#D1D5DB] max-w-[420px] mx-auto">
          Choose a customer from the list to view their details, linked projects, and activity timeline.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-label-sm text-ink-400 dark:text-[#D1D5DB] flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-150 border border-border-default">
            <span className="w-2 h-2 rounded-full bg-brand" />
            Customer details
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-150 border border-border-default">
            <span className="w-2 h-2 rounded-full bg-success" />
            Projects
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

function mapApiCustomer(item: CustomerApiResponse): Customer {
  const initials = item.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const primaryEmail = item.emails?.[0]?.email || '';
  const stats = item.stats;

  return {
    id: `c${item.id}`,
    name: item.full_name,
    initials,
    avatarColor: 'bg-surface-avatar-blue',
    email: primaryEmail,
    emails: item.emails?.map((e) => ({ label: e.label, value: e.email })) ?? [],
    phone: item.phone_number || '',
    location: item.location || '',
    role: item.tag || '',
    addedDate: formatDate(item.client_since || item.created_at),
    totalRequests: stats?.total_requests ?? 0,
    activeProjects: stats?.active_projects ?? 0,
    lastInteraction: formatDate(stats?.last_interaction || item.last_interaction),
    totalSpent: formatMoney(stats?.total_spent ?? 0),
    status: item.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
    projects:
      item.linked_projects?.map((project) => {
        const style = mapStatusStyle(project.status);
        return {
          id: project.design_code || `P${project.id}`,
          type: project.jewellery_type || project.name || 'Project',
          status: project.status || 'Unknown',
          statusColor: style.statusColor,
          statusBg: style.statusBg,
          image:
            project.thumbnail_url || "/NoPreview.png",
          activity: [],
        };
      }) ?? [],
    activity:
      item.timeline?.map((event) => {
        const style = mapActivityStyle(event.action_type);
        return {
          action: event.action_type || 'Update',
          detail: event.message || '',
          time: formatDate(event.created_at, true),
          icon: style.icon,
          iconColor: style.iconColor,
          iconBg: style.iconBg,
        };
      }) ?? [],
    avatar: '',
  };
}

export default function CustomersPage() {
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
    (state) => state.retailerCustomer
  );
  const prevCreateStatus = useRef(createStatus);
  const prevUpdateStatus = useRef(updateStatus);
  const prevDeleteStatus = useRef(deleteStatus);
  const prevListStatus = useRef(listStatus);
  const prevDetailStatus = useRef(detailStatus);
  const [activeId, setActiveId] = useState('');
  const [activeProjectId, setActiveProjectId] = useState('');
  // Mobile: which pane is visible. Tablet+: ignored.
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    if (createStatus === 'succeeded' && prevCreateStatus.current !== 'succeeded') {
      toast.success('Customer created.');
    }
    if (createStatus === 'failed' && prevCreateStatus.current !== 'failed') {
      toast.error(createError || 'Failed to create customer.');
    }
    prevCreateStatus.current = createStatus;
  }, [createStatus, createError]);

  useEffect(() => {
    if (updateStatus === 'succeeded' && prevUpdateStatus.current !== 'succeeded') {
      toast.success('Customer updated.');
    }
    if (updateStatus === 'failed' && prevUpdateStatus.current !== 'failed') {
      toast.error(updateError || 'Failed to update customer.');
    }
    prevUpdateStatus.current = updateStatus;
  }, [updateStatus, updateError]);

  useEffect(() => {
    if (deleteStatus === 'succeeded' && prevDeleteStatus.current !== 'succeeded') {
      toast.success('Customer deleted.');
    }
    if (deleteStatus === 'failed' && prevDeleteStatus.current !== 'failed') {
      toast.error(deleteError || 'Failed to delete customer.');
    }
    prevDeleteStatus.current = deleteStatus;
  }, [deleteStatus, deleteError]);

  useEffect(() => {
    if (listStatus === 'failed' && prevListStatus.current !== 'failed') {
      toast.error(listError || 'Failed to load customers.');
    }
    prevListStatus.current = listStatus;
  }, [listStatus, listError]);

  useEffect(() => {
    if (detailStatus === 'failed' && prevDetailStatus.current !== 'failed') {
      toast.error(detailError || 'Failed to load customer.');
    }
    prevDetailStatus.current = detailStatus;
  }, [detailStatus, detailError]);

  useEffect(() => {
    if (listStatus !== 'succeeded') return;

    if (activeId && !items.some((c) => `c${c.id}` === activeId)) {
      setActiveId('');
      setActiveProjectId('');
    }
  }, [items, listStatus, activeId]);

  useEffect(() => {
    if (deleteStatus !== 'succeeded' || !lastDeletedId) return;

    const deletedId = `c${lastDeletedId}`;
    setActiveId((prev) => (prev === deletedId ? '' : prev));
    setActiveProjectId('');
  }, [lastDeletedId, deleteStatus]);

  const customers = useMemo(
    () => items.map(mapApiCustomer),
    [items]
  );

  const detailCustomer = useMemo(
    () => (detailStatus === 'succeeded' && detailItem ? mapApiCustomer(detailItem) : null),
    [detailItem, detailStatus]
  );

  const customer = useMemo(
    () => detailCustomer?.id === activeId
      ? detailCustomer
      : customers.find((c) => c.id === activeId) ?? null,
    [activeId, customers, detailCustomer]
  );

  const handleSelectCustomer = (id: string) => {
    setActiveId(id);
    const found = customers.find((c) => c.id === id);
    if (found && found.projects.length > 0) {
      setActiveProjectId(found.projects[0].id);
    } else {
      setActiveProjectId('');
    }
    setMobileView('detail');

    const numericId = Number(id.replace(/^c/, ''));
    if (!Number.isNaN(numericId)) {
      dispatch(fetchCustomerById(numericId));
    }
  };

  const handleAddCustomer = (_newCustomer: Customer) => { };

  const handleEditCustomer = (updatedCustomer: Customer) => {
    const numericId = Number(updatedCustomer.id.replace(/^c/, ''));
    const payload = {
      full_name: updatedCustomer.name,
      tag: updatedCustomer.role,
      emails: (updatedCustomer.emails ?? []).map((e) => ({
        label: e.label,
        email: e.value,
      })),
      phone_number: updatedCustomer.phone,
      location: updatedCustomer.location,
      status: updatedCustomer.status === 'inactive' ? 'Inactive' : 'Active',
    };

    if (!Number.isNaN(numericId)) {
      dispatch(updateCustomer({ customerId: numericId, payload }));
    }
  };

  const handleDeleteCustomer = (customerId: string) => {
    const numericId = Number(customerId.replace(/^c/, ''));
    if (!Number.isNaN(numericId)) {
      dispatch(deleteCustomer(numericId));
    }
  };

  const activeProject = useMemo(() => {
    if (!customer) return undefined;
    return customer.projects.find((p) => p.id === activeProjectId) ?? customer.projects[0];
  }, [customer, activeProjectId]);

  const showDetailSkeleton =
    listStatus === 'loading' ||
    detailStatus === 'loading' ||
    (Boolean(activeId) && !customer && (listStatus === 'idle' || listStatus === 'succeeded'));

  const timelineActivity = useMemo(() => {
    if (!customer) return [];
    if (!activeProject) return customer.activity;
    return activeProject.activity.length > 0 ? activeProject.activity : customer.activity;
  }, [customer, activeProject]);

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
            <CustomerListPanel
              activeId={activeId}
              onSelect={handleSelectCustomer}
              customers={customers}
              onAdd={handleAddCustomer}
            />
          </div>

          {/* Detail pane */}
          <div
            className={`${[
              'rounded-sheet flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6',
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
              All Customers
            </button>

            {showDetailSkeleton ? (
              <DetailPanelSkeleton />
            ) : customer ? (
              <>
                <CustomerHeader
                  customer={customer}
                  onEdit={handleEditCustomer}
                  onDelete={handleDeleteCustomer}
                />
                <CustomerInsights customer={customer} />

                <div className="grid grid-cols-1 2xl:grid-cols-[1fr_340px] gap-5">
                  <LinkedProjects
                    customer={customer}
                    activeProjectId={activeProject?.id ?? ''}
                    onSelectProject={setActiveProjectId}
                  />
                  <ActivityTimeline
                    activity={timelineActivity}
                    projectId={activeProject?.id ?? ''}
                  />
                </div>
              </>
            ) : (
              <NoCustomerState />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
