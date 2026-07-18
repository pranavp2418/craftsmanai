'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppLayout } from '@/src/components/app-layout';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchAdminDashboardStats } from '@/redux/slices/admin/dashboard/adminDashboardSlice';
import { fetchRequestsOverTime } from '@/redux/slices/admin/dashboard/adminRequestsOverTimeSlice';
import { fetchStatusDistribution } from '@/redux/slices/admin/dashboard/adminStatusDistributionSlice';
import { fetchAdminSysActivity } from '@/redux/slices/admin/dashboard/adminSysActivitySlice';
import { fetchAdminRequestStatus } from '@/redux/slices/admin/dashboard/adminRequestStatusSlice';
import { fetchAdminRetailers } from '@/redux/slices/admin/retailers/adminRetailersSlice';
import { fetchAdminCustomersList } from '@/redux/slices/admin/customers/adminCustomersListSlice';
import { fetchAdminManufacturers } from '@/redux/slices/admin/manufacturers/adminManufacturersSlice';
import StatCard from './components/StatCard';
import RequestsOverTimeChart from './components/RequestsOverTimeChart';
import StatusDistributionChart from './components/StatusDistributionChart';
import SearchBar from './components/SearchBar';
import FilterDropdown from './components/FilterDropdown';
import Pagination from './components/Pagination';
import RecentActivityTable, {
  type ActivityRecord,
} from './components/RecentActivityTable';
import RequestStatusTable, {
  type RequestStatusRecord,
} from './components/RequestStatusTable';
import ActivityDetailsModal from './components/ActivityDetailsModal';
import RequestDetailsModal from './components/RequestDetailsModal';
import { useDebounce } from '@/src/utils/hooks/useDebounce';

export default function AdminDashboard() {
  const dispatch = useAppDispatch();
  const { stats, loading: statsLoading } = useAppSelector((state) => state.adminDashboard);
  const { activities, pagination: activityPagination, loading: activitiesLoading } = useAppSelector((state) => state.adminSysActivity);
  const { requests, pagination: requestPagination, loading: requestsLoading } = useAppSelector((state) => state.adminRequestStatus);

  // Retailers, customers, manufacturers lists for dynamic dropdown options
  const { retailers } = useAppSelector((state) => state.adminRetailers);
  const { customers } = useAppSelector((state) => state.adminCustomersList);
  const { manufacturers } = useAppSelector((state) => state.adminManufacturers);


  const hasFetchedStaticData = useRef(false);
  const lastActivityParams = useRef<string | null>(null);
  const lastRequestParams = useRef<string | null>(null);

  // Fetch static data on mount
  useEffect(() => {
    if (hasFetchedStaticData.current) return;
    hasFetchedStaticData.current = true;

    dispatch(fetchAdminDashboardStats());
    dispatch(fetchRequestsOverTime());
    dispatch(fetchStatusDistribution());
    // Fetch lists for filter dropdowns
    dispatch(fetchAdminRetailers({ page: 1, limit: 100 }));
    dispatch(fetchAdminCustomersList({ page: 1, limit: 100 }));
    dispatch(fetchAdminManufacturers({ page: 1, limit: 100 }));
  }, [dispatch]);

  // ─── Activity section state (server-side filters) ────────────────────────
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const debouncedActivitySearchQuery = useDebounce(activitySearchQuery, 400);
  const [activityActorTypeFilter, setActivityActorTypeFilter] = useState('all');
  const [activityActorIdFilter, setActivityActorIdFilter] = useState('all');
  const [activityCurrentPage, setActivityCurrentPage] = useState(1);
  const activityItemsPerPage = 10;

  // ─── Request Status section state (server-side filters) ────────────────── 
  const [requestSearchQuery, setRequestSearchQuery] = useState('');
  const debouncedRequestSearchQuery = useDebounce(requestSearchQuery, 400);
  const [requestRetailerFilter, setRequestRetailerFilter] = useState('all');
  const [requestCustomerFilter, setRequestCustomerFilter] = useState('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [requestCurrentPage, setRequestCurrentPage] = useState(1);
  const requestItemsPerPage = 10;

  // Modal states
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestStatusRecord | null>(null);

  // ─── Activity: Centralized fetch ─────────────────────────────────────────
  const fetchActivitiesList = useCallback(() => {
    const params: { page: number; limit: number; actor_type?: string; actor_id?: string; search?: string } = {
      page: activityCurrentPage,
      limit: activityItemsPerPage,
    };
    const search = debouncedActivitySearchQuery.trim();
    if (activityActorTypeFilter !== 'all') params.actor_type = activityActorTypeFilter;
    if (activityActorIdFilter !== 'all') params.actor_id = activityActorIdFilter;
    if (search) params.search = search;

    const paramStr = JSON.stringify(params);
    if (lastActivityParams.current === paramStr) return;
    lastActivityParams.current = paramStr;

    dispatch(fetchAdminSysActivity(params));
  }, [
    dispatch,
    activityCurrentPage,
    activityActorTypeFilter,
    activityActorIdFilter,
    debouncedActivitySearchQuery,
  ]);

  useEffect(() => {
    fetchActivitiesList();
  }, [fetchActivitiesList]);

  // Activity filter change handlers — reset page to 1
  const handleActivityActorTypeChange = (value: string) => {
    setActivityActorTypeFilter(value);
    setActivityActorIdFilter('all'); // reset actor filter when type changes
    setActivityCurrentPage(1);
  };
  const handleActivityActorIdChange = (value: string) => {
    setActivityActorIdFilter(value);
    setActivityCurrentPage(1);
  };
  const handleActivitySearchChange = (value: string) => {
    setActivitySearchQuery(value);
    setActivityCurrentPage(1);
  };

  // Client-side search for activity
  const filteredActivities = activities;

  const activityTotalPages = Math.max(1, activityPagination.total_pages);
  const activityTotalItems = activityPagination.total_items;

  // ─── Request Status: Centralized fetch ───────────────────────────────────
  const fetchRequestsList = useCallback(() => {
    const params: { page: number; limit: number; status?: string; retailer_id?: string; customer_id?: string; search?: string } = {
      page: requestCurrentPage,
      limit: requestItemsPerPage,
    };
    const search = debouncedRequestSearchQuery.trim();
    if (requestStatusFilter !== 'all') params.status = requestStatusFilter;
    if (requestRetailerFilter !== 'all') params.retailer_id = requestRetailerFilter;
    if (requestCustomerFilter !== 'all') params.customer_id = requestCustomerFilter;
    if (search) params.search = search;

    const paramStr = JSON.stringify(params);
    if (lastRequestParams.current === paramStr) return;
    lastRequestParams.current = paramStr;

    dispatch(fetchAdminRequestStatus(params));
  }, [
    dispatch,
    requestCurrentPage,
    requestStatusFilter,
    requestRetailerFilter,
    requestCustomerFilter,
    debouncedRequestSearchQuery,
  ]);

  useEffect(() => {
    fetchRequestsList();
  }, [fetchRequestsList]);

  // Request filter change handlers — reset page to 1
  const handleRequestStatusFilterChange = (value: string) => {
    setRequestStatusFilter(value);
    setRequestCurrentPage(1);
  };
  const handleRequestRetailerFilterChange = (value: string) => {
    setRequestRetailerFilter(value);
    setRequestCurrentPage(1);
  };
  const handleRequestCustomerFilterChange = (value: string) => {
    setRequestCustomerFilter(value);
    setRequestCurrentPage(1);
  };
  const handleRequestSearchChange = (value: string) => {
    setRequestSearchQuery(value);
    setRequestCurrentPage(1);
  };

  // Client-side search for requests
  const filteredRequests = requests;

  const requestTotalPages = Math.max(1, requestPagination.total_pages);
  const requestTotalItems = requestPagination.total_items;

  // ─── Dynamic dropdown options ────────────────────────────────────────────

  // Actor Type options for Activity
  const actorTypeOptions = [
    { label: 'All Actor Types', value: 'all' },
    { label: 'Retailer', value: 'RETAILER' },
    { label: 'Customer', value: 'CUSTOMER' },
    { label: 'Manufacturer', value: 'MANUFACTURER' },
  ];

  // Actor ID options — dynamically change based on selected actor type
  const actorIdOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [{ label: 'All Actors', value: 'all' }];

    if (activityActorTypeFilter === 'all' || activityActorTypeFilter === 'RETAILER') {
      retailers.forEach((r) => {
        if (r.name && r.id) opts.push({ label: `${r.name} (Retailer)`, value: r.id });
      });
    }
    if (activityActorTypeFilter === 'all' || activityActorTypeFilter === 'CUSTOMER') {
      customers.forEach((c) => {
        if (c.name && c.id) opts.push({ label: `${c.name} (Customer)`, value: c.id });
      });
    }
    if (activityActorTypeFilter === 'all' || activityActorTypeFilter === 'MANUFACTURER') {
      manufacturers.forEach((m) => {
        if (m.name && m.id) opts.push({ label: `${m.name} (Manufacturer)`, value: m.id });
      });
    }

    return opts;
  }, [activityActorTypeFilter, retailers, customers, manufacturers]);

  // Retailer options for Request Status
  const retailerOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [{ label: 'All Retailers', value: 'all' }];
    retailers.forEach((r) => {
      if (r.name && r.id) opts.push({ label: r.name, value: r.id });
    });
    return opts;
  }, [retailers]);

  // Customer options for Request Status
  const customerOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [{ label: 'All Customers', value: 'all' }];
    customers.forEach((c) => {
      if (c.name && c.id) opts.push({ label: c.name, value: c.id });
    });
    return opts;
  }, [customers]);

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Detected', value: 'DETECTED' },
    { label: 'Quote Requested', value: 'QUOTE_REQUESTED' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'In Production', value: 'IN_PRODUCTION' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Refinement Requested', value: 'REFINEMENT_REQUESTED' },
  ];

  // ─── Modal handlers ─────────────────────────────────────────────────────

  const handleActivityViewDetails = (activity: ActivityRecord) => {
    setSelectedActivity(activity);
    setIsActivityModalOpen(true);
  };

  const handleRequestViewDetails = (request: RequestStatusRecord) => {
    setSelectedRequest(request);
    setIsRequestModalOpen(true);
  };

  return (
    <AppLayout
      appName="Craftsman.ai"
      headerTitle="Dashboard"
      headerDescription="System overview and activity monitoring"
      notificationCount={5}
    >
      <div className="space-y-4 sm:space-y-5 lg:space-y-6 xl:space-y-8 w-full min-w-0 overflow-x-hidden text-ink dark:text-ink">


        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 xl:gap-6 mt-2 sm:mt-3">
          <StatCard title="Total Retailers" value={stats?.total_retailers ?? '-'} loading={statsLoading} />
          <StatCard title="Active Manufacturers" value={stats?.active_manufacturers ?? '-'} loading={statsLoading} />
          <StatCard title="Total Customers" value={stats?.total_customers ?? '-'} loading={statsLoading} />
          <StatCard title="Active Requests" value={stats?.active_requests ?? '-'} loading={statsLoading} />
          <StatCard title="Pending Approvals" value={stats?.pending_approvals ?? '-'} loading={statsLoading} />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 xl:gap-8">
          <RequestsOverTimeChart />
          <StatusDistributionChart />
        </div>

        {/* Recent System Activity */}
        <div className="bg-white dark:bg-surface-100 rounded-2xl p-4 sm:p-5 lg:p-6 xl:p-8 shadow-sm">
          <div className="mb-3 sm:mb-4 lg:mb-5">
            <h2 className="text-base sm:text-lg lg:text-xl xl:text-[20px] font-medium text-gray-900 dark:text-ink mb-1 sm:mb-1.5 lg:mb-2 leading-tight">
              Recent System Activity
            </h2>
            <p className="text-xs sm:text-sm lg:text-base text-gray-600 dark:text-ink-600 leading-snug sm:leading-normal">
              Latest actions across the platform
            </p>
          </div>

          {/* Activity Filters */}
          <div className="flex flex-col xl:flex-row gap-2.5 sm:gap-3 lg:gap-4 mb-3 sm:mb-4 lg:mb-5 xl:items-center justify-between">
            <div className="w-full xl:w-1/2">
              <SearchBar
                value={activitySearchQuery}
                onChange={handleActivitySearchChange}
                placeholder="Search"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5 lg:gap-3 xl:gap-4 w-full xl:w-auto">
              <div className="w-full xl:min-w-[180px]">
                <FilterDropdown
                  value={activityActorTypeFilter}
                  onChange={handleActivityActorTypeChange}
                  placeholder="All Actor Types"
                  options={actorTypeOptions}
                />
              </div>
              <div className="w-full xl:min-w-[180px]">
                <FilterDropdown
                  value={activityActorIdFilter}
                  onChange={handleActivityActorIdChange}
                  placeholder="All Actors"
                  options={actorIdOptions}
                />
              </div>
            </div>
          </div>

          {/* Activity Table */}
          {activitiesLoading ? (
            <div className="border border-gray-200 dark:border-border-default rounded-t-2xl overflow-hidden">
              <table className="w-full min-w-[900px]">
                <thead className="sticky top-0 z-0">
                  <tr className="bg-[#F1F1F1] dark:bg-surface-150 text-[#6D6D6D] dark:text-[#D1D5DB] border-b border-gray-200 dark:border-border-default">
                    {['Timestamp', 'Actor Type', 'Actor', 'Action', 'Reference ID', 'Details'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-surface-100 divide-y divide-gray-200 dark:divide-border-default animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4"><div className="h-3 w-32 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-5 w-20 bg-gray-200 rounded-full" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-28 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-36 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-24 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-7 w-7 bg-gray-200 rounded-full mx-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              {filteredActivities.length === 0 ? (
                <div className="border border-gray-200 dark:border-border-default rounded-2xl bg-white dark:bg-surface-100 p-8 text-center">
                  <p className="text-sm sm:text-base text-gray-600 dark:text-ink-600">
                    {debouncedActivitySearchQuery.trim() ? 'No activity records match your search.' : 'No activity records found.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="border border-gray-200 dark:border-border-default rounded-t-2xl overflow-hidden">
                    <RecentActivityTable
                      activities={filteredActivities}
                      onViewDetails={handleActivityViewDetails}
                    />
                  </div>
                  <Pagination
                    currentPage={activityCurrentPage}
                    totalPages={activityTotalPages}
                    onPageChange={setActivityCurrentPage}
                    totalItems={activityTotalItems}
                    itemsPerPage={activityItemsPerPage}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Request Status */}
        <div className="bg-white dark:bg-surface-100 rounded-2xl p-4 sm:p-5 lg:p-6 xl:p-8 shadow-sm">
          <div className="mb-3 sm:mb-4 lg:mb-5">
            <h2 className="text-base sm:text-lg lg:text-xl xl:text-[20px] font-medium text-gray-900 dark:text-ink mb-1 sm:mb-1.5 lg:mb-2 leading-tight">
              Request Status
            </h2>
            <p className="text-xs sm:text-sm lg:text-base text-gray-600 dark:text-ink-600 leading-snug sm:leading-normal">
              Platform activity and request lifecycle visibility
            </p>
          </div>

          {/* Request Filters */}
          <div className="flex flex-col xl:flex-row gap-2.5 sm:gap-3 lg:gap-4 mb-3 sm:mb-4 lg:mb-5 xl:items-center justify-between">
            <div className="w-full xl:w-1/2">
              <SearchBar
                value={requestSearchQuery}
                onChange={handleRequestSearchChange}
                placeholder="Search"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5 lg:gap-3 xl:gap-4 w-full xl:w-auto">
              <div className="w-full xl:min-w-[170px]">
                <FilterDropdown
                  value={requestRetailerFilter}
                  onChange={handleRequestRetailerFilterChange}
                  placeholder="All Retailers"
                  options={retailerOptions}
                />
              </div>
              <div className="w-full xl:min-w-[170px]">
                <FilterDropdown
                  value={requestCustomerFilter}
                  onChange={handleRequestCustomerFilterChange}
                  placeholder="All Customers"
                  options={customerOptions}
                />
              </div>
              <div className="w-full xl:min-w-[170px] md:col-span-2 xl:col-span-1">
                <FilterDropdown
                  value={requestStatusFilter}
                  onChange={handleRequestStatusFilterChange}
                  placeholder="All Status"
                  options={statusOptions}
                />
              </div>
            </div>
          </div>

          {/* Request Status Table */}
          {requestsLoading ? (
            <div className="border border-gray-200 dark:border-border-default rounded-t-2xl overflow-hidden">
              <table className="w-full min-w-[1200px]">
                <thead className="sticky top-0 z-0">
                  <tr className="bg-[#F1F1F1] dark:bg-surface-150 text-[#6D6D6D] dark:text-[#D1D5DB] border-b border-gray-200 dark:border-border-default">
                    {['Request ID', 'Jewellery Type', 'Current Status', 'Retailer', 'Customer', 'Created Date', 'Completed Date & time', 'Details'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-surface-100 divide-y divide-gray-200 dark:divide-border-default animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4"><div className="h-3 w-28 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-24 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-5 w-36 bg-gray-200 rounded-full" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-28 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-24 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-20 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-28 bg-gray-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-7 w-7 bg-gray-200 rounded-full mx-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              {filteredRequests.length === 0 ? (
                <div className="border border-gray-200 dark:border-border-default rounded-2xl bg-white dark:bg-surface-100 p-8 text-center">
                  <p className="text-sm sm:text-base text-gray-600 dark:text-ink-600">
                    {debouncedRequestSearchQuery.trim() ? 'No request records match your search.' : 'No request records found.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="border border-gray-200 rounded-t-2xl overflow-hidden">
                    <RequestStatusTable
                      requests={filteredRequests}
                      onViewDetails={handleRequestViewDetails}
                    />
                  </div>
                  <Pagination
                    currentPage={requestCurrentPage}
                    totalPages={requestTotalPages}
                    onPageChange={setRequestCurrentPage}
                    totalItems={requestTotalItems}
                    itemsPerPage={requestItemsPerPage}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <ActivityDetailsModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        activity={selectedActivity}
      />
      <RequestDetailsModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        request={selectedRequest}
      />
    </AppLayout>
  );
}
