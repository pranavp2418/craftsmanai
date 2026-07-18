'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import AppLayout from '@/src/components/app-layout';
import SearchBar from './components/SearchBar';
import FilterTabs, { FilterType, SubFilterType } from './components/FilterTabs';
import ManufacturerTable, { Manufacturer } from './components/ManufacturerTable';
import Pagination from '../dashboard/components/Pagination';
import ViewManufacturerModal from './components/ViewManufacturerModal';
import DisableManufacturerModal from './components/DisableManufacturerModal';
import EnableManufacturerModal from './components/EnableManufacturerModal';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useDebounce } from '@/src/utils/hooks/useDebounce';
import {
  fetchAdminManufacturers,
  updateManufacturerStatus,
} from '@/redux/slices/admin/manufacturers/adminManufacturersSlice';
import {
  fetchAdminManufacturerDetail,
  clearManufacturerDetail,
} from '@/redux/slices/admin/manufacturers/adminManufacturerDetailSlice';
import {
  disableManufacturer,
  resetDisableState,
} from '@/redux/slices/admin/manufacturers/adminManufacturerDisableSlice';
import {
  enableManufacturer,
  resetEnableState,
} from '@/redux/slices/admin/manufacturers/adminManufacturerEnableSlice';
import { fetchAdminManufacturersSummary } from '@/redux/slices/admin/manufacturers/adminManufacturersSummarySlice';

export default function ManufacturersPage() {
  const dispatch = useAppDispatch();
  const { manufacturers, pagination, loading } = useAppSelector((s) => s.adminManufacturers);
  const { detail: manufacturerDetail, loading: detailLoading } = useAppSelector(
    (s) => s.adminManufacturerDetail,
  );
  const { loading: disableLoading } = useAppSelector((s) => s.adminManufacturerDisable);
  const { loading: enableLoading } = useAppSelector((s) => s.adminManufacturerEnable);
  const { summary } = useAppSelector((s) => s.adminManufacturersSummary);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeSubFilter, setActiveSubFilter] = useState<SubFilterType>('recently_added');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [manufacturerToDisable, setManufacturerToDisable] = useState<Manufacturer | null>(null);
  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
  const [manufacturerToEnable, setManufacturerToEnable] = useState<Manufacturer | null>(null);
  const itemsPerPage = 10;

  // Centralized fetch function — called whenever filter/subfilter/page/search changes
  const fetchManufacturersList = useCallback(() => {
    const params: {
      page: number;
      limit: number;
      status?: string;
      subfilter?: string;
      search?: string;
    } = {
      page: currentPage,
      limit: itemsPerPage,
    };

    // Map filter tab to API status param
    if (activeFilter === 'active') params.status = 'ACTIVE';
    if (activeFilter === 'inactive') params.status = 'INACTIVE';

    // Send subfilter
    params.subfilter = activeSubFilter;

    // Send debounced search query if present
    const search = debouncedSearchQuery.trim();
    if (search) params.search = search;

    dispatch(fetchAdminManufacturers(params));
  }, [dispatch, currentPage, activeFilter, activeSubFilter, debouncedSearchQuery]);

  // Initial KPI fetch
  useEffect(() => {
    dispatch(fetchAdminManufacturersSummary());
  }, [dispatch]);

  // Re-fetch whenever filters / page / search changes
  useEffect(() => {
    fetchManufacturersList();
  }, [fetchManufacturersList]);

  // Reset to page 1 when filter or subfilter changes
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleSubFilterChange = (subFilter: SubFilterType) => {
    setActiveSubFilter(subFilter);
    setCurrentPage(1);
  };

  // Search handler - reset page to 1 when user types
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusToggle = (id: string) => {
    const manufacturer = manufacturers.find((m) => m.id === id);
    if (manufacturer) {
      if (manufacturer.status === 'active') {
        setManufacturerToDisable(manufacturer);
        setIsDisableModalOpen(true);
      } else {
        setManufacturerToEnable(manufacturer);
        setIsEnableModalOpen(true);
      }
    }
  };

  const handleConfirmDisable = async (id: string) => {
    // Optimistic UI update
    dispatch(updateManufacturerStatus({ id, status: 'disabled' }));
    setIsDisableModalOpen(false);
    setManufacturerToDisable(null);
    try {
      await dispatch(disableManufacturer(id)).unwrap();
      // Refresh list and summary to sync with server
      fetchManufacturersList();
      dispatch(fetchAdminManufacturersSummary());
      toast.success('Manufacturer disabled successfully.');
    } catch (error) {
      // Revert optimistic update on failure
      dispatch(updateManufacturerStatus({ id, status: 'active' }));
      toast.error(String(error || 'Failed to disable manufacturer.'));
    }
    dispatch(resetDisableState());
  };

  const handleCloseDisableModal = () => {
    setIsDisableModalOpen(false);
    setManufacturerToDisable(null);
  };

  const handleConfirmEnable = async (id: string) => {
    // Optimistic UI update
    dispatch(updateManufacturerStatus({ id, status: 'active' }));
    setIsEnableModalOpen(false);
    setManufacturerToEnable(null);
    try {
      await dispatch(enableManufacturer(id)).unwrap();
      // Refresh list and summary to sync with server
      fetchManufacturersList();
      dispatch(fetchAdminManufacturersSummary());
      toast.success('Manufacturer enabled successfully.');
    } catch (error) {
      // Revert optimistic update on failure
      dispatch(updateManufacturerStatus({ id, status: 'disabled' }));
      toast.error(String(error || 'Failed to enable manufacturer.'));
    }
    dispatch(resetEnableState());
  };

  const handleCloseEnableModal = () => {
    setIsEnableModalOpen(false);
    setManufacturerToEnable(null);
  };

  const handleViewClick = (manufacturer: Manufacturer) => {
    dispatch(fetchAdminManufacturerDetail(manufacturer.id));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    dispatch(clearManufacturerDetail());
    setIsModalOpen(false);
  };

  const totalItems = pagination.totalItems;
  const totalPages = pagination.totalPages;

  return (
    <AppLayout
      headerTitle="Manufacturers"
      headerDescription="View and manage manufacturer accounts"
    >
      <div className="w-full h-full">
        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 md:p-6 [box-shadow:1px_1px_4px_0px_#0000001A]">
          {/* Search and Filters */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Search Bar */}
            <div className="w-full xl:w-80">
              <SearchBar value={searchQuery} onChange={handleSearchChange} placeholder="Search" />
            </div>

            {/* Filter Tabs */}
            <div className="w-full xl:w-auto">
              <FilterTabs
                activeFilter={activeFilter}
                onFilterChange={handleFilterChange}
                activeSubFilter={activeSubFilter}
                onSubFilterChange={handleSubFilterChange}
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="border border-gray-200 rounded-t-2xl overflow-hidden -mx-3 sm:mx-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px]">
                <thead className="bg-[#F1F1F1] !truncate">
                  <tr>
                    {[
                      'Manufacturer Name',
                      'Email',
                      'Phone',
                      'Location',
                      'Status',
                      'Jobs Received',
                      'Approved Jobs',
                      'Jewellery Type',
                      'Actions',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-left !text-xs md:!text-sm !font-medium text-[#6B7280]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'}`}
                    >
                      {/* Name + avatar */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-200" />
                          <div className="space-y-1.5">
                            <div className="h-3 w-24 bg-gray-200 rounded" />
                            <div className="h-2.5 w-16 bg-gray-200 rounded" />
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-5 py-4">
                        <div className="h-3 w-36 bg-gray-200 rounded" />
                      </td>
                      {/* Phone */}
                      <td className="px-5 py-4">
                        <div className="h-3 w-24 bg-gray-200 rounded" />
                      </td>
                      {/* Location */}
                      <td className="px-5 py-4">
                        <div className="h-3 w-20 bg-gray-200 rounded" />
                      </td>
                      {/* Status badge */}
                      <td className="px-5 py-4">
                        <div className="h-6 w-16 bg-gray-200 rounded-full" />
                      </td>
                      {/* Jobs Received */}
                      <td className="px-5 py-4">
                        <div className="h-3 w-8 bg-gray-200 rounded mx-auto" />
                      </td>
                      {/* Approved Jobs */}
                      <td className="px-5 py-4">
                        <div className="h-3 w-8 bg-gray-200 rounded mx-auto" />
                      </td>
                      {/* Jewellery Type */}
                      <td className="px-5 py-4">
                        <div className="h-3 w-20 bg-gray-200 rounded" />
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <div className="h-7 w-14 bg-gray-200 rounded-full" />
                          <div className="h-7 w-14 bg-gray-200 rounded-full" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
            <div className="border border-gray-200 rounded-t-2xl overflow-hidden -mx-3 sm:mx-0">
              <ManufacturerTable
                manufacturers={manufacturers}
                onStatusToggle={handleStatusToggle}
                onViewClick={handleViewClick}
              />
            </div>
          )}
          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, totalPages)}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
          />
        </div>

        {/* Stats Section */}
        <div className="bg-white rounded-2xl shadow-sm mt-4 px-6 py-5 [box-shadow:1px_1px_4px_0px_#0000001A] overflow-hidden">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-0 w-full mx-auto divide-y sm:divide-y-0 sm:divide-x divide-gray-200 overflow-hidden">
            {loading ? (
              // Shimmer for stats
              <>
                <div className="w-full flex items-center justify-evenly py-3 sm:py-0">
                  <div className="flex flex-col gap-2 animate-pulse px-2 md:px-4 items-center">
                    <div className="h-7 w-10 bg-gray-200 rounded" />
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                  </div>
                  <div className="flex flex-col gap-2 animate-pulse px-2 md:px-4 items-center">
                    <div className="h-7 w-10 bg-gray-200 rounded" />
                    <div className="h-3.5 w-16 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="w-full flex items-center justify-evenly py-3 sm:py-0">
                  <div className="flex flex-col gap-2 animate-pulse px-2 md:px-4 items-center">
                    <div className="h-7 w-10 bg-gray-200 rounded" />
                    <div className="h-3.5 w-12 bg-gray-200 rounded" />
                  </div>
                  <div className="flex flex-col gap-2 animate-pulse px-2 md:px-4 items-center">
                    <div className="h-7 w-10 bg-gray-200 rounded" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-full flex items-center justify-evenly py-3 sm:py-0">
                  <div className="flex flex-col items-center justify-center text-center px-2 md:px-4">
                    <span className="text-2xl font-semibold text-gray-900">
                      {summary.totalManufacturers}
                    </span>
                    <span className="text-sm text-gray-500 mt-1">Total Manufacturers</span>
                  </div>
                  <div className="flex flex-col items-center justify-center text-center px-2 md:px-4">
                    <span className="text-2xl font-semibold text-gray-900">
                      {summary.disabledManufacturers}
                    </span>
                    <span className="text-sm text-gray-500 mt-1">Disabled</span>
                  </div>
                </div>

                <div className="w-full flex items-center justify-evenly py-3 sm:py-0">
                  <div className="flex flex-col items-center justify-center text-center px-2 md:px-4">
                    <span className="text-2xl font-semibold text-green-500">
                      {summary.activeManufacturers}
                    </span>
                    <span className="text-sm text-gray-500 mt-1">Active</span>
                  </div>
                  <div className="flex flex-col items-center justify-center text-center px-2 md:px-4">
                    <span className="text-2xl font-semibold" style={{ color: '#2F68C5' }}>
                      {summary.totalJobs}
                    </span>
                    <span className="text-sm text-gray-500 mt-1">Total Jobs</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* View Manufacturer Modal */}
        <ViewManufacturerModal
          manufacturer={manufacturerDetail}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          loading={detailLoading}
        />

        {/* Disable Manufacturer Modal */}
        <DisableManufacturerModal
          manufacturer={manufacturerToDisable}
          isOpen={isDisableModalOpen}
          onClose={handleCloseDisableModal}
          onConfirm={handleConfirmDisable}
        />

        {/* Enable Manufacturer Modal */}
        <EnableManufacturerModal
          manufacturer={manufacturerToEnable}
          isOpen={isEnableModalOpen}
          onClose={handleCloseEnableModal}
          onConfirm={handleConfirmEnable}
        />
      </div>
    </AppLayout>
  );
}
