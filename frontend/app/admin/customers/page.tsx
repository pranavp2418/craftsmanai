'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/src/components/app-layout';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchAdminCustomersKpi } from '@/redux/slices/admin/customers/adminCustomersKpiSlice';
import { fetchAdminCustomersList } from '@/redux/slices/admin/customers/adminCustomersListSlice';
import { fetchAdminCustomerDetail, clearCustomerDetail } from '@/redux/slices/admin/customers/adminCustomerDetailSlice';
import { useDebounce } from '@/src/utils/hooks/useDebounce';
import StatsCards from './components/StatsCards';
import SearchBar from './components/SearchBar';
import FilterTabs, { FilterType, SubFilterType } from './components/FilterTabs';
import CustomerTable, { Customer } from './components/CustomerTable';
import Pagination from '../dashboard/components/Pagination';
import ViewCustomerModal from './components/ViewCustomerModal';

const SuperadminCustomersPage = () => {
  const dispatch = useAppDispatch();
  const { kpi, loading: kpiLoading } = useAppSelector((state) => state.adminCustomersKpi);
  const { customers, pagination, loading: listLoading } = useAppSelector((state) => state.adminCustomersList);
  const { customer: customerDetail, loading: detailLoading } = useAppSelector((state) => state.adminCustomerDetail);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeSubFilter, setActiveSubFilter] = useState<SubFilterType>('recently_added');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const itemsPerPage = 10;

  // Centralized fetch function — called whenever filter/subfilter/page changes
  const fetchCustomers = useCallback(() => {
    const params: { page: number; limit: number; status?: string; subfilter?: string; search?: string } = {
      page: currentPage,
      limit: itemsPerPage,
    };

    // Map filter tab to API status param
    if (activeFilter === 'active') params.status = 'ACTIVE';
    if (activeFilter === 'inactive') params.status = 'INACTIVE';

    // Send subfilter
    params.subfilter = activeSubFilter;

    const search = debouncedSearchQuery.trim();
    if (search) params.search = search;

    dispatch(fetchAdminCustomersList(params));
  }, [dispatch, currentPage, activeFilter, activeSubFilter, debouncedSearchQuery]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchAdminCustomersKpi());
  }, [dispatch]);

  // Re-fetch whenever filters / page changes
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Reset to page 1 when filter or subfilter changes
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleSubFilterChange = (subFilter: SubFilterType) => {
    setActiveSubFilter(subFilter);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const filteredCustomers = customers;

  const handleViewClick = (customer: Customer) => {
    dispatch(fetchAdminCustomerDetail(customer.id));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    dispatch(clearCustomerDetail());
  };

  const totalItems = pagination.totalItems;
  const totalPages = pagination.totalPages;

  // KPI stats from API
  const totalCustomers = kpi.totalCustomers;
  const activeCustomers = kpi.activeCustomers;
  const inactiveCustomers = kpi.inactiveCustomers;
  const totalOrders = kpi.totalOrders;

  return (
    <AppLayout
      appName="Craftsman.ai"
      headerTitle="Customers"
      headerDescription="Monitor customer activity across the platform"
      notificationCount={5}
    >
      <div className="w-full h-full">
        {/* Stats Cards */}
        {kpiLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-5 xl:gap-6 mb-4 sm:mb-5 md:mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 lg:p-6 xl:p-7 border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <StatsCards
            totalCustomers={totalCustomers}
            activeCustomers={activeCustomers}
            inactiveCustomers={inactiveCustomers}
            totalOrders={totalOrders}
          />
        )}

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 md:p-6">
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

          {/* Customer Table */}
          {listLoading ? (
            <div className="border border-gray-200 rounded-t-2xl overflow-hidden -mx-3 sm:mx-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                <thead className="bg-[#F1F1F1] truncate">
                  <tr>
                    {['Customer Name', 'Email', 'Associated Retailers', 'Total Orders', 'Active Order', 'Last Activity', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs  md:text-sm font-medium text-[#1E1E1E]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <tr key={i} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'}`}>
                      {/* Customer Name + avatar */}
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
                      <td className="px-5 py-4"><div className="h-3 w-36 bg-gray-200 rounded" /></td>
                      {/* Associated Retailers */}
                      <td className="px-5 py-4"><div className="h-3 w-28 bg-gray-200 rounded" /></td>
                      {/* Total Orders */}
                      <td className="px-5 py-4 text-center"><div className="h-3 w-8 bg-gray-200 rounded mx-auto" /></td>
                      {/* Active Order */}
                      <td className="px-5 py-4 text-center"><div className="h-3 w-8 bg-gray-200 rounded mx-auto" /></td>
                      {/* Last Activity */}
                      <td className="px-5 py-4"><div className="h-3 w-24 bg-gray-200 rounded" /></td>
                      {/* Actions */}
                      <td className="px-5 py-4"><div className="h-7 w-16 bg-gray-200 rounded-full" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
            <div className="border border-gray-200 rounded-t-2xl overflow-hidden -mx-3 sm:mx-0">
              <CustomerTable
                customers={filteredCustomers}
                onViewClick={handleViewClick}
              />
            </div>
          )}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>

      {/* View Customer Modal */}
      <ViewCustomerModal
        customer={customerDetail}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        loading={detailLoading}
      />
    </AppLayout>
  );
};

export default SuperadminCustomersPage;
