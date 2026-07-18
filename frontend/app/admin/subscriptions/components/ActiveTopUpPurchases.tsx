import React, { useState, useEffect, useRef } from 'react';
import { Search, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import Pagination from '@/app/admin/dashboard/components/Pagination';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchActiveTopups } from '@/redux/slices/admin/subscriptions/adminActiveTopupsSlice';
import {
  clearActiveTopupDetails,
  fetchActiveTopupDetails,
} from '@/redux/slices/admin/subscriptions/adminActiveTopupDetailsSlice';
import { useDebounce } from '@/src/utils/hooks/useDebounce';

// ── Types ────────────────────────────────────────────────────────────────────
type TopUpStatus = string;
type StripeStatus = string;

interface TopUpPack {
  name: string;
  status: string;
  pricePerMonth: string;
}

interface TopUpRetailer {
  id: string;
  email: string;
  name: string;
  initials: string;
  avatarColor: string;
  currentPlan: string;
  purchasedPacks: string[];
  extraRenders: number;
  monthlyRenewal: number;
  stripeStatus: StripeStatus;
  renewalDate: string;
  status: TopUpStatus;
  basePlanRenders: number;
  topUpRenders: number;
  totalRenders: number;
  rendersUsed: number;
  remainingRenders: number;
  renewalStatus: string;
  activeTopUpPacks: TopUpPack[];
  monthlyRenewalTotal: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const getInitials = (name: string) =>
  name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '??';

const avatarColors = [
  'bg-blue-100 text-blue-600',
  'bg-indigo-100 text-indigo-600',
  'bg-purple-100 text-purple-600',
  'bg-sky-100 text-sky-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
  'bg-rose-100 text-rose-600',
  'bg-orange-100 text-orange-600',
];
const getAvatarColor = (index: number) => avatarColors[index % avatarColors.length];

const getString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const getNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toTitleCase = (value: string): string => {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const normalizeDisplayStatus = (value: unknown): TopUpStatus => {
  const raw = getString(value, 'Active').trim();
  const normalized = raw.replace(/_/g, ' ').toUpperCase();
  if (normalized === 'PAST DUE') return 'Past Due';
  if (normalized === 'ACTIVE') return 'Active';
  return toTitleCase(raw.replace(/_/g, ' '));
};

const normalizeStripeStatus = (value: unknown): StripeStatus => {
  const raw = getString(value, 'Pending').trim().toUpperCase();
  if (['PAID', 'SUCCESS', 'SUCCEEDED', 'COMPLETED', 'COMPLETE'].includes(raw)) return 'Paid';
  if (['FAILED', 'FAIL', 'ERROR', 'CANCELLED', 'CANCELED'].includes(raw)) return 'Failed';
  return 'Pending';
};

const formatMoney = (value: number): string => {
  if (!Number.isFinite(value)) return '$0.00';
  return `$${value.toFixed(2)}`;
};

const formatDate = (value: unknown): string => {
  const input = getString(value);
  if (!input) return 'N/A';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const normalizePack = (pack: any, fallbackName = 'Top-up Pack'): TopUpPack => {
  const price = getNumber(pack?.price_per_month ?? pack?.monthly_price ?? pack?.price ?? pack?.amount, 0);
  return {
    name: getString(pack?.name ?? pack?.pack_name, fallbackName),
    status: getString(pack?.status ?? pack?.payment_status ?? pack?.state, 'Active'),
    pricePerMonth: `${formatMoney(price)}/mo`,
  };
};

const normalizeTopUpRetailer = (item: any, idx: number): TopUpRetailer => {
  const basePlanRenders = getNumber(
    item?.base_plan_renders ?? item?.monthly_renders_limit ?? item?.base_renders,
    0,
  );
  const topUpRenders = getNumber(item?.topup_renders ?? item?.top_up_renders ?? item?.extra_renders, 0);
  const totalRenders = getNumber(item?.total_renders, basePlanRenders + topUpRenders);
  const rendersUsed = getNumber(item?.renders_used ?? item?.monthly_renders_used, 0);
  const remainingRenders = getNumber(item?.remaining_renders, Math.max(totalRenders - rendersUsed, 0));

  const packsSource = item?.active_topup_packs ?? item?.topup_packs ?? item?.purchased_packs ?? [];
  const rawPacks = Array.isArray(packsSource) ? packsSource : [];
  const activeTopUpPacks = rawPacks.map((pack: any, packIdx: number) =>
    typeof pack === 'string' ? normalizePack({}, pack) : normalizePack(pack),
  );

  const purchasedPacks = rawPacks.length
    ? rawPacks.map((pack: any) =>
        typeof pack === 'string'
          ? pack
          : getString(pack?.name ?? pack?.pack_name ?? `${getNumber(pack?.renders, 0)} Pack`),
      )
    : ['-'];

  const name = getString(
    item?.retailer_name ?? item?.user_name ?? item?.name ?? item?.retailer?.name,
    'Unknown Retailer',
  );

  const planName = getString(item?.plan_name ?? item?.current_plan_name ?? item?.subscription_plan, '-');
  const monthlyRenewal = getNumber(
    item?.monthly_renewal ?? item?.monthly_renewal_price ?? item?.monthly_amount,
    0,
  );
  const status = normalizeDisplayStatus(item?.status ?? item?.renewal_status);

  return {
    id: getString(item?.retailer_id ?? item?.id ?? item?.user_id, String(idx + 1)),
    email: getString(item?.retailer_email ?? item?.email ?? item?.user_email),
    name,
    initials: getInitials(name),
    avatarColor: getAvatarColor(idx),
    currentPlan: planName,
    purchasedPacks,
    extraRenders: topUpRenders,
    monthlyRenewal,
    stripeStatus: normalizeStripeStatus(item?.stripe_status ?? item?.payment_status),
    renewalDate: formatDate(item?.renewal_date ?? item?.next_billing_date),
    status,
    basePlanRenders,
    topUpRenders,
    totalRenders,
    rendersUsed,
    remainingRenders,
    renewalStatus: normalizeDisplayStatus(item?.renewal_status ?? item?.status),
    activeTopUpPacks,
    monthlyRenewalTotal: getNumber(item?.monthly_renewal_total, monthlyRenewal),
  };
};

const statusStyles: Record<string, string> = {
  Active: 'bg-[#ECFDF5] text-[#10B981]',
  'Past Due': 'bg-[#FEF2F2] text-[#EF4444]',
};

const stripeStatusStyles: Record<string, string> = {
  Paid: 'text-[#10B981]',
  Failed: 'text-[#EF4444]',
  Pending: 'text-[#F59E0B]',
};

const stripeBgStatusStyles: Record<string, string> = {
  Paid: 'bg-[#F0FDF4]',
  Failed: 'bg-[#FEF2F2]',
  Pending: 'bg-[#FFFBEB]',
};

// const planBadgeStyles: Record<string, string> = {
//   Starter: 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]',
//   Pro: 'bg-[#EEF2FF] text-[#6366F1] border border-[#C7D2FE]',
//   Business: 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]',
//   Enterprise: 'bg-[#F3E8FF] text-[#9333EA] border border-[#D8B4FE]',
// };

const planBadgeStyles: Record<string, string> = {
  Starter: 'text-[#16A34A]',
  Pro: 'text-[#6366F1]',
  Business: 'text-[#D97706]',
  Enterprise: 'text-[#9333EA]',
};

const statusBadgeStyles: Record<string, string> = {
  Active: 'bg-[#ECFDF5] text-[#10B981]',
  'Past Due': 'bg-[#FEF2F2] text-[#EF4444]',
};

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════
export default function ActiveTopUpPurchases() {
  const dispatch = useAppDispatch();
  const { items, total, loading, error } = useAppSelector((state) => state.adminActiveTopups);
  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
  } = useAppSelector((state) => state.adminActiveTopupDetails);

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState<TopUpRetailer | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  const filters = ['All', 'Starter', 'Pro', 'Business', 'Enterprise'];

  const lastFetchedParams = useRef<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeFilter]);

  useEffect(() => {
    const params = {
      planName: activeFilter,
      search: debouncedSearch.trim() || undefined,
      page: currentPage,
      limit,
    };
    const paramStr = JSON.stringify(params);
    if (lastFetchedParams.current === paramStr) return;
    lastFetchedParams.current = paramStr;

    dispatch(fetchActiveTopups(params));
  }, [dispatch, activeFilter, debouncedSearch, currentPage]);

  const tableData = React.useMemo(() => {
    if (!Array.isArray(items)) return [];
    
    // Deduplicate by retailer ID to prevent duplicate rows
    const seen = new Set<string>();
    const uniqueItems = items.filter((item: any) => {
      const id = getString(item?.retailer_id ?? item?.id ?? item?.user_id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    
    // Client-side filter by plan name
    let filtered = uniqueItems;
    if (activeFilter !== 'All') {
      filtered = uniqueItems.filter((item: any) => {
        const planName = getString(item?.plan_name ?? item?.current_plan_name ?? item?.subscription_plan, '').toLowerCase();
        return planName === activeFilter.toLowerCase();
      });
    }
    
    return filtered.map((item, idx) => normalizeTopUpRetailer(item, idx));
  }, [items, activeFilter]);

  const detailRetailer = React.useMemo(() => {
    if (detailData) {
      return normalizeTopUpRetailer(detailData, 0);
    }
    return selectedRetailer;
  }, [detailData, selectedRetailer]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleOpenDetails = (retailer: TopUpRetailer) => {
    setSelectedRetailer(retailer);
    dispatch(fetchActiveTopupDetails(retailer.id));
    setIsDetailOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailOpen(false);
    setSelectedRetailer(null);
    dispatch(clearActiveTopupDetails());
  };

  // Lock body scroll when detail panel is open
  useEffect(() => {
    if (isDetailOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDetailOpen]);

  // Close detail panel on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseDetails();
    };
    if (isDetailOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isDetailOpen]);

  const usagePercent =
    detailRetailer && detailRetailer.totalRenders > 0
      ? (detailRetailer.rendersUsed / detailRetailer.totalRenders) * 100
      : 0;

  return (
    <div className="w-full mt-8">
      {/* Section header */}

      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0px_1px_2px_0px_#0000000D] overflow-hidden mb-6 -mx-4 sm:mx-0">
        {/* Search & Filter */}
        <div className="p-4 sm:p-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="px-1 sm:px-0">
            <h2 className="text-sm md:text-base font-bold text-[#111827]">
              Active Top-Up Purchases
            </h2>
            <p className="text-xs md:text-sm text-[#6B7280] mt-0.5">
              All active retailer top-up subscriptions.
            </p>
          </div>
          <div className="w-full xl:w-auto flex flex-col md:flex-row gap-3">
            <div className="relative w-full xl:w-[320px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search retailers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-11 pr-4 bg-white border border-[#E5E7EB] rounded-[14px] text-[13px] sm:text-sm focus:outline-none focus:border-[#2F68C5] focus:ring-4 focus:ring-[#2F68C5]/10 transition-all"
              />
            </div>

            <div className="w-full xl:w-auto overflow-x-auto no-scrollbar">
              <div className="inline-flex items-center bg-[#F5F7FA] p-1 rounded-full border border-[#E5E7EB] shadow-[0px_1px_2px_0px_#00000008] min-w-full xl:min-w-0">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium transition-all whitespace-nowrap ${
                      activeFilter === filter
                        ? 'bg-[#2F68C5] text-white shadow-sm'
                        : 'text-[#6D6D6D] hover:text-[#111827]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Table */}
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200  ">
          <table className="w-full border-collapse text-left min-w-[950px] xl:min-w-full truncate">
            <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
              <tr>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Retailer Name
                </th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Current Plan
                </th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Purchased Packs
                </th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Extra Renders
                </th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Monthly Renewal
                </th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Stripe Status
                </th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Renewal Date
                </th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-right text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4FB]">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="animate-pulse">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100" />
                        <div className="h-4 w-28 bg-gray-100 rounded" />
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="h-4 w-16 bg-gray-100 rounded" />
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="h-4 w-24 bg-gray-100 rounded" />
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="h-4 w-10 bg-gray-100 rounded" />
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="h-4 w-16 bg-gray-100 rounded" />
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="h-6 w-16 bg-gray-100 rounded-full" />
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="h-4 w-20 bg-gray-100 rounded" />
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="h-6 w-16 bg-gray-100 rounded-full" />
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                      <div className="ml-auto h-4 w-8 bg-gray-100 rounded" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center border-none">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm text-red-500 font-medium">Error: {error}</span>
                      <button
                        onClick={() =>
                          dispatch(
                            fetchActiveTopups({
                              planName: activeFilter,
                              search: debouncedSearch.trim() || undefined,
                              page: currentPage,
                              limit,
                            }),
                          )
                        }
                        className="px-4 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-[#2F68C5] font-bold transition-all"
                      >
                        TRY AGAIN
                      </button>
                    </div>
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center border-none">
                    <span className="text-sm text-gray-500 font-medium">
                      No top-up subscriptions found matching your criteria.
                    </span>
                  </td>
                </tr>
              ) : (
                tableData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    {/* Retailer Name */}
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-medium text-[11px] sm:text-xs ${item.avatarColor} shrink-0`}
                        >
                          {item.initials}
                        </div>
                        <span className="text-[13px] sm:text-sm font-medium text-[#111827]">
                          {item.name}
                        </span>
                      </div>
                    </td>

                    {/* Current Plan */}
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] sm:text-[12px] font-semibold ${planBadgeStyles[item.currentPlan] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {item.currentPlan}
                      </span>
                    </td>

                    {/* Purchased Packs */}
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        {item.purchasedPacks.map((pack, i) => (
                          <span
                            key={i}
                            className="text-[12px] sm:text-[13px] text-[#2F68C5] font-medium p-1 px-2 bg-[#EFF6FF] rounded-full w-fit"
                          >
                            {pack}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Extra Renders */}
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="text-[13px] sm:text-sm font-semibold text-[#111827]">
                        {item.extraRenders}
                      </span>
                    </td>

                    {/* Monthly Renewal */}
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="text-[13px] sm:text-sm font-medium text-[#111827]">
                        ${item.monthlyRenewal.toFixed(2)}
                      </span>
                    </td>

                    {/* Stripe Status */}
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span
                        className={`text-[12px] sm:text-[13px] font-semibold p-1 px-2 rounded-full ${stripeBgStatusStyles[item.stripeStatus]} ${stripeStatusStyles[item.stripeStatus] || 'text-gray-500'}`}
                      >
                        {item.stripeStatus}
                      </span>
                    </td>

                    {/* Renewal Date */}
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[13px] sm:text-sm text-[#4B5563] font-normal">
                      {item.renewalDate}
                    </td>

                    {/* Status */}
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[12px] font-bold ${statusStyles[item.status] || 'bg-gray-100 text-gray-500'}`}
                      >
                        {item.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleOpenDetails(item)}
                        className="text-[12px] sm:text-xs font-medium text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={total}
          itemsPerPage={limit}
        />
      </div>

      {/* Side-panel detail modal */}
      {selectedRetailer && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-[60] bg-black/30 transition-opacity duration-300 ${
              isDetailOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setIsDetailOpen(false)}
          />

          {/* Side panel */}
          <div
            className={`fixed top-0 right-0 z-[70] h-full w-full max-w-[480px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
              isDetailOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="h-full max-h-screen flex flex-col overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <h2 className="text-[16px] sm:text-[18px] font-bold text-[#111827]">
                  Retailer Top-Up Details
                </h2>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>

              <div className="px-6 pb-8 flex flex-col gap-6">
                {/* Retailer info */}
                <div className="flex items-center justify-between p-5 bg-[#F9FAFB] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${selectedRetailer.avatarColor}`}
                    >
                      {selectedRetailer.initials}
                    </div>
                    <div>
                      <p className="text-[14px] sm:text-[15px] font-semibold text-[#111827]">
                        {selectedRetailer.name}
                      </p>
                      <p className="text-[12px] sm:text-[13px] text-[#6B7280]">
                        {selectedRetailer.currentPlan} Plan
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-bold ${statusBadgeStyles[selectedRetailer.status] || 'bg-gray-100 text-gray-500'}`}
                  >
                    {selectedRetailer.status}
                  </span>
                </div>

                {/* Render Allocation */}
                <div>
                  <h3 className="text-[13px] sm:text-[14px] font-semibold text-[#111827] mb-3">
                    Render Allocation
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#EEF2FF] rounded-xl p-3 text-center">
                      <p className="text-[20px] sm:text-[24px] font-bold text-[#4F46E5]">
                        {selectedRetailer.basePlanRenders}
                      </p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">Base Plan</p>
                    </div>
                    <div className="bg-[#ECFDF5] rounded-xl p-3 text-center">
                      <p className="text-[20px] sm:text-[24px] font-bold text-[#10B981]">
                        +{selectedRetailer.topUpRenders}
                      </p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">Top-Up</p>
                    </div>
                    <div className="bg-[#FEF3C7] rounded-xl p-3 text-center">
                      <p className="text-[20px] sm:text-[24px] font-bold text-[#D97706]">
                        {selectedRetailer.totalRenders}
                      </p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">Total</p>
                    </div>
                  </div>
                </div>

                {/* Usage Logic callout */}
                <div className="bg-[#FFF7ED] border border-[#FFEDD5] rounded-xl p-3.5 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-[#92400E] mb-0.5">Usage Logic</p>
                    <p className="text-[11px] sm:text-[12px] text-[#78350F] leading-relaxed">
                      Base renders ({selectedRetailer.basePlanRenders}) are consumed first. Top-up
                      renders ({selectedRetailer.topUpRenders}) are only used after base plan
                      renders are exhausted.
                    </p>
                  </div>
                </div>

                {/* Current Usage */}
                <div>
                  <h3 className="text-[13px] sm:text-[14px] font-semibold text-[#111827] mb-3">
                    Current Usage
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#4B5563]">Renders Used</span>
                      <span className="text-[13px] font-medium text-[#111827]">
                        {selectedRetailer.rendersUsed} / {selectedRetailer.totalRenders}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(usagePercent, 100)}%`,
                          background:
                            usagePercent > 90
                              ? '#EF4444'
                              : usagePercent > 70
                                ? '#F59E0B'
                                : '#2F68C5',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#4B5563]">Remaining Renders</span>
                      <span className="text-[13px] font-semibold text-[#111827]">
                        {selectedRetailer.remainingRenders}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#4B5563]">Renewal Status</span>
                      <span
                        className={`text-[13px] font-semibold ${selectedRetailer.renewalStatus === 'Active' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}
                      >
                        {selectedRetailer.renewalStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <hr className="border-[#F3F4F6]" />

                {/* Active Top-Up Packs */}
                <div>
                  <h3 className="text-[13px] sm:text-[14px] font-semibold text-[#111827] mb-3">
                    Active Top-Up Packs
                  </h3>
                  <div className="space-y-3">
                    {selectedRetailer.activeTopUpPacks.map((pack, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#EEF2FF] rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-[#6366F1]" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-[#111827]">{pack.name}</p>
                            <p className="text-[11px] text-[#6B7280]">{pack.status}</p>
                          </div>
                        </div>
                        <span className="text-[13px] font-semibold text-[#111827]">
                          {pack.pricePerMonth}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <hr className="border-[#F3F4F6]" />

                {/* Monthly Renewal Total */}
                <div className="flex items-center justify-between">
                  <span className="text-[14px]  text-[#111827]">
                    Monthly Renewal Total
                  </span>
                  <span className="text-[16px] sm:text-[18px] font-bold text-[#111827]">
                    ${selectedRetailer.monthlyRenewalTotal.toFixed(2)}
                  </span>
                </div>
              </div>


            </div>
          </div>
        </>
      )}
    </div>
  );
}
