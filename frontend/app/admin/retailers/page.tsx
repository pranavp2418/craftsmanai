'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import AppLayout from '@/src/components/app-layout';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchAdminRetailers, updateRetailerStatus, deleteRetailer } from '@/redux/slices/admin/retailers/adminRetailersSlice';
import { fetchAdminRetailerInfo, clearRetailerInfo } from '@/redux/slices/admin/retailers/adminRetailerInfoSlice';
import { useDebounce } from '@/src/utils/hooks/useDebounce';
import SearchBar from './components/SearchBar';
import FilterTabs, { FilterType, SubFilterType } from './components/FilterTabs';
import RetailerTable, { Retailer } from './components/RetailerTable';
import Pagination from '../dashboard/components/Pagination';
import ViewRetailerModal from './components/ViewRetailerModal';
import DisableRetailerModal from './components/DisableRetailerModal';
import DeleteRetailerModal from './components/DeleteRetailerModal';
import EnableRetailerModal from './components/EnableRetailerModal';
import AddRetailerModal from './components/AddRetailerModal';

export default function RetailersPage() {
  const dispatch = useAppDispatch();
  const { retailers, pagination, loading, deleteLoading } = useAppSelector((state) => state.adminRetailers);
  const { info: retailerInfo, loading: infoLoading } = useAppSelector((state) => state.adminRetailerInfo);
  const lastFetchedParams = useRef<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeSubFilter, setActiveSubFilter] = useState<SubFilterType>('recently_added');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [retailerToDisable, setRetailerToDisable] = useState<Retailer | null>(null);
  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
  const [retailerToEnable, setRetailerToEnable] = useState<Retailer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [retailerToDelete, setRetailerToDelete] = useState<Retailer | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const itemsPerPage = 10;

  // Centralized fetch function — called whenever filter/subfilter/page/search changes
  const fetchRetailersList = useCallback((force = false) => {
    const params: { page: number; limit: number; status?: string; subfilter?: string; search?: string } = {
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

    const paramStr = JSON.stringify(params);
    if (!force && lastFetchedParams.current === paramStr) return;
    lastFetchedParams.current = paramStr;

    dispatch(fetchAdminRetailers(params));
  }, [dispatch, currentPage, activeFilter, activeSubFilter, debouncedSearchQuery]);

  // Re-fetch whenever filters / page changes
  useEffect(() => {
    fetchRetailersList();
  }, [fetchRetailersList]);

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

  const filteredRetailers = retailers;

  const totalItems = pagination.total_items;
  const totalPages = pagination.total_pages;

  const handleStatusToggle = (id: string) => {
    const retailer = retailers.find((r) => r.id === id);
    if (retailer) {
      if (retailer.status === 'active') {
        setRetailerToDisable(retailer);
        setIsDisableModalOpen(true);
      } else {
        setRetailerToEnable(retailer);
        setIsEnableModalOpen(true);
      }
    }
  };

  const handleConfirmDisable = async () => {
    if (retailerToDisable) {
      try {
        await dispatch(
          updateRetailerStatus({ retailer_id: retailerToDisable.id, status: 'INACTIVE' }),
        ).unwrap();
        setIsDisableModalOpen(false);
        setRetailerToDisable(null);
        fetchRetailersList(true);
        toast.success('Retailer disabled successfully.');
      } catch (error) {
        toast.error(String(error || 'Failed to disable retailer.'));
      }
    }
  };

  const handleCloseDisableModal = () => {
    setIsDisableModalOpen(false);
    setRetailerToDisable(null);
  };

  const handleDeleteClick = (retailer: Retailer) => {
    setRetailerToDelete(retailer);
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (deleteLoading) return;
    setIsDeleteModalOpen(false);
    setRetailerToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (retailerToDelete) {
      try {
        await dispatch(deleteRetailer({ retailer_id: retailerToDelete.id })).unwrap();
        setIsDeleteModalOpen(false);
        setRetailerToDelete(null);
        fetchRetailersList(true);
        toast.success('Retailer and all their data deleted.');
      } catch (error) {
        toast.error(String(error || 'Failed to delete retailer.'));
      }
    }
  };

  const handleConfirmEnable = async () => {
    if (retailerToEnable) {
      try {
        await dispatch(
          updateRetailerStatus({ retailer_id: retailerToEnable.id, status: 'ACTIVE' }),
        ).unwrap();
        setIsEnableModalOpen(false);
        setRetailerToEnable(null);
        fetchRetailersList(true);
        toast.success('Retailer enabled successfully.');
      } catch (error) {
        toast.error(String(error || 'Failed to enable retailer.'));
      }
    }
  };

  const handleCloseEnableModal = () => {
    setIsEnableModalOpen(false);
    setRetailerToEnable(null);
  };

  const handleViewClick = (retailer: Retailer) => {
    setIsModalOpen(true);
    dispatch(fetchAdminRetailerInfo(retailer.id));
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    dispatch(clearRetailerInfo());
  };

  const handleAddRetailer = () => {
    fetchRetailersList(true);
  };

  return (
    <AppLayout
      headerTitle="Retailers"
      headerDescription="Manage and monitor retailer accounts"
    >
      <div className="w-full h-full">
        {/* Main Content Card */}
        <div className="bg-white rounded-2xl [box-shadow:1px_1px_4px_0px_#0000001A] p-3 sm:p-4 md:p-6">
          {/* Search and Filters */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Search Bar */}
            <div className="w-full xl:w-80">
              <SearchBar
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search"
              />
            </div>

            {/* Filter Tabs and Add Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full xl:w-auto">
              <FilterTabs
                activeFilter={activeFilter}
                onFilterChange={handleFilterChange}
                activeSubFilter={activeSubFilter}
                onSubFilterChange={handleSubFilterChange}
              />
              {/* <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[#2F68C5] text-white rounded-full font-medium hover:bg-[#2558A8] transition-colors text-xs sm:text-sm whitespace-nowrap flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">+</span>
                <span>Add New retailer</span>
              </button> */}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="border border-gray-200 rounded-t-2xl overflow-hidden -mx-3 sm:mx-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] truncate">
                <thead className="bg-[#F1F1F1] truncate">
                  <tr className='truncate'>
                    {['Retailers Name', 'Retailer Id', 'Email', 'Contact Number', 'Status', 'Total Requests', 'Joined Date', 'Action'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3.5 text-left text-xs md:text-sm truncate font-medium text-[#6B7280] ${i === 0 ? 'rounded-tl-lg' : i === 7 ? 'rounded-tr-lg' : ''
                          }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <tr key={i} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'}`}>
                      {/* Retailer Name */}
                      <td className="px-5 py-4"><div className="h-3 w-28 bg-gray-200 rounded" /></td>
                      {/* Retailer Id */}
                      <td className="px-5 py-4"><div className="h-3 w-20 bg-gray-200 rounded" /></td>
                      {/* Email */}
                      <td className="px-5 py-4"><div className="h-3 w-36 bg-gray-200 rounded" /></td>
                      {/* Contact */}
                      <td className="px-5 py-4"><div className="h-3 w-24 bg-gray-200 rounded" /></td>
                      {/* Status badge */}
                      <td className="px-5 py-4"><div className="h-6 w-16 bg-gray-200 rounded-full" /></td>
                      {/* Total Requests */}
                      <td className="px-5 py-4"><div className="h-3 w-8 bg-gray-200 rounded mx-auto" /></td>
                      {/* Joined Date */}
                      <td className="px-5 py-4"><div className="h-3 w-24 bg-gray-200 rounded" /></td>
                      {/* Action */}
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <div className="h-7 w-14 bg-gray-200 rounded-full" />
                          <div className="h-7 w-16 bg-gray-200 rounded-full" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
            <>
              <div className="border border-gray-200 rounded-t-2xl overflow-hidden -mx-3 sm:mx-0">
                <RetailerTable
                  onDeleteClick={handleDeleteClick}
                  retailers={filteredRetailers}
                  onStatusToggle={handleStatusToggle}
                  onViewClick={handleViewClick}
                />
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={Math.max(1, totalPages)}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
              />
            </>
          )}
        </div>

        {/* View Retailer Modal */}
        <ViewRetailerModal
          retailer={retailerInfo}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          loading={infoLoading}
        />

        {/* Disable Retailer Modal */}
        <DeleteRetailerModal
          retailer={retailerToDelete}
          isOpen={isDeleteModalOpen}
          onClose={handleCloseDeleteModal}
          onConfirm={handleConfirmDelete}
          loading={deleteLoading}
        />

        <DisableRetailerModal
          retailer={retailerToDisable}
          isOpen={isDisableModalOpen}
          onClose={handleCloseDisableModal}
          onConfirm={handleConfirmDisable}
        />

        {/* Enable Retailer Modal */}
        <EnableRetailerModal
          retailer={retailerToEnable}
          isOpen={isEnableModalOpen}
          onClose={handleCloseEnableModal}
          onConfirm={handleConfirmEnable}
        />

        {/* Add Retailer Modal */}
        <AddRetailerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleAddRetailer}
        />
      </div>
    </AppLayout>
  );
}
