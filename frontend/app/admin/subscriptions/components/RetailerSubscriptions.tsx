import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import SubscriptionDetailsModal from './SubscriptionDetailsModal';
import ChangePlanModal from './ChangePlanModal';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import Pagination from '@/app/admin/dashboard/components/Pagination';
import { fetchUserSubscriptions, type UserSubscription } from '@/redux/slices/admin/subscriptions/adminUserSubscriptionsSlice';
import { useDebounce } from '@/src/utils/hooks/useDebounce';
import ActiveTopUpPurchases from './ActiveTopUpPurchases';

type Status = 'Active' | 'Trial' | 'Past Due' | 'Paused' | 'Cancelled';

interface RetailerData {
  id: string;
  name: string;
  initials: string;
  business: string;
  plan: string;
  cycle: string;
  status: Status;
  usage: number;
  totalUsage: number;
  nextBilling: string;
  avatarColor: string;
}

const statusStyles: Record<string, string> = {
  Active: 'bg-[#ECFDF5] text-[#10B981]',
  Trial: 'bg-[#EEF2FF] text-[#6366F1]',
  'Past Due': 'bg-[#FEF2F2] text-[#EF4444]',
  Paused: 'bg-[#FFFBEB] text-[#F59E0B]',
  Cancelled: 'bg-[#F3F4F6] text-[#6B7280]',
};

const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '??';
const avatarColors = [
  'bg-blue-100 text-blue-600',
  'bg-indigo-100 text-indigo-600',
  'bg-purple-100 text-purple-600',
  'bg-sky-100 text-sky-600',
  'bg-blue-50 text-blue-500'
];
const getAvatarColor = (index: number) => avatarColors[index % avatarColors.length];

const formatDateInUTC = (isoString: string) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return !isNaN(date.getTime())
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : '-';
};

export default function RetailerSubscriptions() {
  const dispatch = useAppDispatch();
  const { subscriptions, total, loading, error } = useAppSelector((state) => state.adminUserSubscriptions);
  const lastFetchedParams = useRef<string | null>(null);

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState<any>(null);

  // Pagination states
  const [skip, setSkip] = useState(0);
  const limit = 10;

  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const handlePageChange = (pageNumber: number) => {
    setSkip((pageNumber - 1) * limit);
  };

  const mapFilterToStatus = (filter: string) => {
    switch (filter) {
      case 'Active': return 'ACTIVE';
      case 'Trial': return 'TRIAL';
      case 'Paused': return 'PAUSED';
      case 'Past Due': return 'PAST_DUE';
      case 'Cancelled': return 'CANCELLED';
      default: return undefined;
    }
  };

  // Reset pagination when filters or search change
  useEffect(() => {
    setSkip(0);
  }, [debouncedSearchQuery, activeFilter]);

  // Fetch subscriptions based on search, status, and pagination
  useEffect(() => {
    const statusVal = mapFilterToStatus(activeFilter);
    const params = {
      search: debouncedSearchQuery.trim() || undefined,
      status: statusVal,
      skip,
      limit
    };
    const paramStr = JSON.stringify(params);
    if (lastFetchedParams.current === paramStr) return;
    lastFetchedParams.current = paramStr;

    dispatch(fetchUserSubscriptions(params));
  }, [debouncedSearchQuery, activeFilter, skip, dispatch]);

  const handleOpenDetails = (retailer: any) => {
    setSelectedRetailer(retailer);
    setIsDetailsModalOpen(true);
  };

  const handleChangePlan = (retailer: any) => {
    setSelectedRetailer(retailer);
    setIsChangePlanModalOpen(true);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const filters = ['All', 'Active', 'Past Due', 'Cancelled'];

  const filteredRetailers = React.useMemo(() => {
    const list = Array.isArray(subscriptions) ? subscriptions : [];
    return list.map((item, idx) => {
      // Format status label for UI
      let displayStatus = 'Unknown';
      if (item.status) {
        if (item.status === 'PAST_DUE') {
          displayStatus = 'Past Due';
        } else {
          displayStatus = item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase();
        }
      }

      // Extract usage data from the API response
      const usageData = item.usage;
      const rendersUsed = usageData ? Number(usageData.renders_used) || 0 : 0;
      const rendersTotal = usageData ? Number(usageData.renders_total) || 0 : 0;

      return {
        ...item,
        name: item.user_name,
        business: item.business_name,
        plan: item.plan_name,
        cycle: 'Monthly',
        status: displayStatus,
        initials: getInitials(item.user_name),
        avatarColor: getAvatarColor(idx),
        nextBilling: item.end_date,
        usage: rendersUsed,
        totalUsage: rendersTotal,
      };
    });
  }, [subscriptions]);

  return (
    <div className="w-full">
      <h1 className="text-lg sm:text-xl font-bold text-[#111827] mb-6 px-1 sm:px-0">Retailer Subscription</h1>

      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0px_1px_2px_0px_#0000000D] overflow-hidden mb-6 -mx-4 sm:mx-0">
        {/* Search & Filter Header */}
        <div className="p-4 sm:p-6 flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="relative w-full xl:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search retailers..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full h-10 sm:h-11 pl-11 pr-4 bg-white border border-[#E5E7EB] rounded-[12px] text-[13px] sm:text-sm focus:outline-none focus:border-[#2F68C5] transition-all"
            />
          </div>

          <div className="flex items-center bg-[#F0F2F4] p-1 rounded-full overflow-x-auto no-scrollbar max-w-full">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium transition-all whitespace-nowrap ${activeFilter === filter
                  ? 'bg-[#2F68C5] text-white'
                  : 'text-[#6D6D6D] hover:text-gray-900'
                  }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200">
          <table className="w-full border-collapse text-left min-w-[800px] xl:min-w-full">
            <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
              <tr>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Retailer</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Business</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Plan</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Cycle</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Status</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Usage</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Next Billing</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-right text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4FB]">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-gray-100 rounded-full" /><div className="h-4 w-24 bg-gray-50 rounded" /></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-32 bg-gray-50 rounded" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-gray-50 rounded" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-16 bg-gray-50 rounded" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-6 w-16 bg-gray-100 rounded-full" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-2 w-24 bg-gray-100 rounded-full" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-20 bg-gray-50 rounded" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex justify-end gap-3"><div className="h-4 w-8 bg-gray-50 rounded" /><div className="h-4 w-16 bg-gray-50 rounded" /></div></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center border-none">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-red-500 font-medium">Error: {error}</p>
                      <button onClick={() => dispatch(fetchUserSubscriptions({ skip, limit }))} className="px-4 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-[#2F68C5] font-bold transition-all">TRY AGAIN</button>
                    </div>
                  </td>
                </tr>
              ) : filteredRetailers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center border-none">
                    <span className="text-sm text-gray-500 font-medium">No retailers found matching your criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredRetailers.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-medium text-[11px] sm:text-xs ${item.avatarColor} shrink-0`}>
                          {item.initials}
                        </div>
                        <span className="text-[13px] sm:text-sm font-medium text-[#111827]">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="text-[13px] sm:text-sm text-[#4B5563] font-normal">{item.business}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="text-[13px] sm:text-sm font-medium text-[#111827]">{item.plan}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="text-[13px] sm:text-sm text-[#4B5563] font-normal">{item.cycle}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[12px] font-bold ${statusStyles[item.status] || 'bg-gray-100 text-gray-500'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 sm:gap-3 w-28 sm:w-32">
                        <div className="flex-1 h-1 sm:h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2F68C5] rounded-full"
                            style={{ width: `${item.totalUsage > 0 ? (item.usage / item.totalUsage) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 w-7 sm:w-8">{item.usage}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[13px] sm:text-sm text-[#4B5563] font-normal">
                      {formatDateInUTC(item.nextBilling)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-3 sm:gap-4">
                        <button
                          onClick={() => handleOpenDetails(item)}
                          className="text-[12px] sm:text-xs font-medium text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={total}
          itemsPerPage={limit}
        />
      </div>

      <ActiveTopUpPurchases />

      <SubscriptionDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onChangePlan={(retailer) => {
          setIsDetailsModalOpen(false);
          handleChangePlan(retailer);
        }}
        data={selectedRetailer}
      />

      <ChangePlanModal
        isOpen={isChangePlanModalOpen}
        onClose={() => setIsChangePlanModalOpen(false)}
        retailerName={selectedRetailer?.name}
        businessName={selectedRetailer?.business}
      />
    </div>
  );
}
