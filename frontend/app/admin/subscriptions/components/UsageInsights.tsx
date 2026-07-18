import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchUsageInsights } from '@/redux/slices/admin/subscriptions/adminUsageInsightsSlice';
import { fetchTopDesigners } from '@/redux/slices/admin/subscriptions/adminTopDesignersSlice';

interface UsageStat {
  label: string;
  value: string;
  subtext: string;
  bgColor: string;
  icon: React.ReactNode;
}

const iconClass = 'w-10 h-10 rounded-[12px] flex items-center justify-center';

const ShimmerLoader = () => (
  <div className="w-full space-y-6 pb-12 animate-pulse">
    <div className="mb-8">
      <div className="h-6 w-40 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-80 bg-gray-100 rounded" />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-5">
          <div className="w-10 h-10 rounded-[12px] bg-gray-100" />
          <div className="space-y-2">
            <div className="h-7 w-20 bg-gray-200 rounded" />
            <div className="h-4 w-40 bg-gray-100 rounded" />
            <div className="h-3 w-28 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>

    <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-6">
      <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-72 bg-gray-100 rounded" />
    </div>
  </div>
);

const formatValue = (value: number) => new Intl.NumberFormat('en-US').format(value);
const formatAverage = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);

export default function UsageInsights() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.adminUsageInsights);
  const { data: designersData, loading: designersLoading, error: designersError } = useAppSelector(
    (state) => state.adminTopDesigners
  );
  const hasFetched = React.useRef(false);

  const handleFetchAll = React.useCallback(() => {
    dispatch(fetchUsageInsights());
    dispatch(fetchTopDesigners({ page: 1, pageSize: 5 }));
  }, [dispatch]);

  React.useEffect(() => {
    if (!hasFetched.current) {
      handleFetchAll();
      hasFetched.current = true;
    }
  }, [handleFetchAll]);

  if ((loading && !data) || (designersLoading && !designersData)) return <ShimmerLoader />;

  const combinedError = error || designersError;

  if (combinedError && !data && !designersData) {
    return (
      <div className="w-full space-y-6 pb-12">
        <div className="p-8 text-center bg-red-50 rounded-[24px] border border-red-100">
          <p className="text-red-600 font-medium mb-3">{combinedError}</p>
          <button
            onClick={handleFetchAll}
            className="flex items-center gap-2 mx-auto text-xs font-bold text-[#2C62B9] underline uppercase tracking-widest"
          >
            <RefreshCw className="w-3 h-3" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const insights = data ?? {
    totalAIRendersGenerated: 0,
    totalCustomerShares: 0,
    totalManufacturerQuotes: 0,
    avgRendersPerRetailer: 0,
  };

  const stats: UsageStat[] = [
    {
      label: 'Total AI Renders Generated',
      value: formatValue(insights.totalAIRendersGenerated),
      subtext: 'From usage insights API',
      bgColor: 'bg-blue-50',
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 8C0 3.58172 3.58172 0 8 0H32C36.4183 0 40 3.58172 40 8V32C40 36.4183 36.4183 40 32 40H8C3.58172 40 0 36.4183 0 32V8Z" fill="#EFF6FF" />
          <path d="M25.7822 17.84L25.5872 18.275C25.5472 18.375 25.4797 18.4425 25.3847 18.4775C25.2897 18.5125 25.1947 18.5125 25.0997 18.4775C25.0047 18.4425 24.9372 18.375 24.8972 18.275L24.7022 17.84C24.5422 17.47 24.3172 17.1375 24.0272 16.8425C23.7372 16.5475 23.4072 16.32 23.0372 16.16L22.4672 15.905C22.3672 15.865 22.2997 15.795 22.2647 15.695C22.2297 15.595 22.2297 15.495 22.2647 15.395C22.2997 15.295 22.3672 15.225 22.4672 15.185L23.0072 14.945C23.3872 14.775 23.7247 14.54 24.0197 14.24C24.3147 13.94 24.5422 13.595 24.7022 13.205L24.8822 12.74C24.9322 12.64 25.0047 12.57 25.0997 12.53C25.1947 12.49 25.2897 12.49 25.3847 12.53C25.4797 12.57 25.5522 12.64 25.6022 12.74L25.7822 13.205C25.9422 13.595 26.1697 13.94 26.4647 14.24C26.7597 14.54 27.0972 14.775 27.4772 14.945L28.0172 15.185C28.1172 15.225 28.1847 15.295 28.2197 15.395C28.2547 15.495 28.2547 15.595 28.2197 15.695C28.1847 15.795 28.1172 15.865 28.0172 15.905L27.4472 16.16C27.0772 16.32 26.7472 16.5475 26.4572 16.8425C26.1672 17.1375 25.9422 17.47 25.7822 17.84ZM12.4922 14H20.7422V15.5H13.2422V26L20.7422 18.5L25.2422 23V20H26.7422V26.75C26.7422 26.96 26.6697 27.1375 26.5247 27.2825C26.3797 27.4275 26.2022 27.5 25.9922 27.5H12.4922C12.2822 27.5 12.1047 27.4275 11.9597 27.2825C11.8147 27.1375 11.7422 26.96 11.7422 26.75V14.75C11.7422 14.54 11.8147 14.3625 11.9597 14.2175C12.1047 14.0725 12.2822 14 12.4922 14ZM25.2422 25.115L20.7422 20.615L15.3572 26H25.2422V25.115ZM16.2422 20C15.9722 20 15.7222 19.9325 15.4922 19.7975C15.2622 19.6625 15.0797 19.48 14.9447 19.25C14.8097 19.02 14.7422 18.77 14.7422 18.5C14.7422 18.23 14.8097 17.98 14.9447 17.75C15.0797 17.52 15.2622 17.3375 15.4922 17.2025C15.7222 17.0675 15.9722 17 16.2422 17C16.5122 17 16.7622 17.0675 16.9922 17.2025C17.2222 17.3375 17.4047 17.52 17.5397 17.75C17.6747 17.98 17.7422 18.23 17.7422 18.5C17.7422 18.77 17.6747 19.02 17.5397 19.25C17.4047 19.48 17.2222 19.6625 16.9922 19.7975C16.7622 19.9325 16.5122 20 16.2422 20Z" fill="#2563EB" />
        </svg>
      ),
    },
    {
      label: 'Total Customer Shares',
      value: formatValue(insights.totalCustomerShares),
      subtext: 'Design links sent',
      bgColor: 'bg-emerald-50',
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 8C0 3.58172 3.58172 0 8 0H32C36.4183 0 40 3.58172 40 8V32C40 36.4183 36.4183 40 32 40H8C3.58172 40 0 36.4183 0 32V8Z" fill="#F0FDFA" />
          <path d="M21.1676 23.765L18.141 22.055C17.872 22.345 17.5549 22.575 17.1898 22.745C16.8247 22.915 16.4403 23 16.0368 23C15.5179 23 15.0375 22.865 14.5955 22.595C14.1536 22.325 13.8029 21.96 13.5434 21.5C13.284 21.04 13.1543 20.54 13.1543 20C13.1543 19.46 13.284 18.96 13.5434 18.5C13.8029 18.04 14.1536 17.675 14.5955 17.405C15.0375 17.135 15.5179 17 16.0368 17C16.4403 17 16.8247 17.085 17.1898 17.255C17.5549 17.425 17.872 17.655 18.141 17.945L21.1676 16.235C21.11 15.995 21.0812 15.75 21.0812 15.5C21.0812 14.96 21.2109 14.46 21.4703 14C21.7297 13.54 22.0804 13.175 22.5224 12.905C22.9644 12.635 23.4448 12.5 23.9637 12.5C24.4825 12.5 24.9629 12.635 25.4049 12.905C25.8469 13.175 26.1976 13.54 26.457 14C26.7165 14.46 26.8462 14.96 26.8462 15.5C26.8462 16.04 26.7165 16.54 26.457 17C26.1976 17.46 25.8469 17.825 25.4049 18.095C24.9629 18.365 24.4825 18.5 23.9637 18.5C23.5601 18.5 23.1758 18.415 22.8107 18.245C22.4456 18.075 22.1285 17.845 21.8594 17.555L18.8328 19.265C18.8905 19.505 18.9193 19.75 18.9193 20C18.9193 20.25 18.8905 20.495 18.8328 20.735L21.8594 22.445C22.1285 22.155 22.4456 21.925 22.8107 21.755C23.1758 21.585 23.5601 21.5 23.9637 21.5C24.4825 21.5 24.9629 21.635 25.4049 21.905C25.8469 22.175 26.1976 22.54 26.457 23C26.7165 23.46 26.8462 23.96 26.8462 24.5C26.8462 25.04 26.7165 25.54 26.457 26C26.1976 26.46 25.8469 26.825 25.4049 27.095C24.9629 27.365 24.4825 27.5 23.9637 27.5C23.4448 27.5 22.9644 27.365 22.5224 27.095C22.0804 26.825 21.7297 26.46 21.4703 26C21.2109 25.54 21.0812 25.04 21.0812 24.5C21.0812 24.25 21.11 24.005 21.1676 23.765ZM16.0368 21.5C16.2962 21.5 16.5364 21.4325 16.7574 21.2975C16.9784 21.1625 17.1538 20.98 17.2835 20.75C17.4132 20.52 17.478 20.27 17.478 20C17.478 19.73 17.4132 19.48 17.2835 19.25C17.1538 19.02 16.9784 18.8375 16.7574 18.7025C16.5364 18.5675 16.2962 18.5 16.0368 18.5C15.7774 18.5 15.5372 18.5675 15.3162 18.7025C15.0952 18.8375 14.9198 19.02 14.7901 19.25C14.6604 19.48 14.5955 19.73 14.5955 20C14.5955 20.27 14.6604 20.52 14.7901 20.75C14.9198 20.98 15.0952 21.1625 15.3162 21.2975C15.5372 21.4325 15.7774 21.5 16.0368 21.5ZM23.9637 17C24.2231 17 24.4633 16.9325 24.6843 16.7975C24.9053 16.6625 25.0806 16.48 25.2104 16.25C25.3401 16.02 25.4049 15.77 25.4049 15.5C25.4049 15.23 25.3401 14.98 25.2104 14.75C25.0806 14.52 24.9053 14.3375 24.6843 14.2025C24.4633 14.0675 24.2231 14 23.9637 14C23.7042 14 23.464 14.0675 23.243 14.2025C23.0221 14.3375 22.8467 14.52 22.717 14.75C22.5873 14.98 22.5224 15.23 22.5224 15.5C22.5224 15.77 22.5873 16.02 22.717 16.25C22.8467 16.48 23.0221 16.6625 23.243 16.7975C23.464 16.9325 23.7042 17 23.9637 17ZM23.9637 26C24.2231 26 24.4633 25.9325 24.6843 25.7975C24.9053 25.6625 25.0806 25.48 25.2104 25.25C25.3401 25.02 25.4049 24.77 25.4049 24.5C25.4049 24.23 25.3401 23.98 25.2104 23.75C25.0806 23.52 24.9053 23.3375 24.6843 23.2025C24.4633 23.0675 24.2231 23 23.9637 23C23.7042 23 23.464 23.0675 23.243 23.2025C23.0221 23.3375 22.8467 23.52 22.717 23.75C22.5873 23.98 22.5224 24.23 22.5224 24.5C22.5224 24.77 22.5873 25.02 22.717 25.25C22.8467 25.48 23.0221 25.6625 23.243 25.7975C23.464 25.9325 23.7042 26 23.9637 26Z" fill="#0D9488" />
        </svg>
      ),
    },
    {
      label: 'Total Manufacturer Quotes',
      value: formatValue(insights.totalManufacturerQuotes),
      subtext: 'Quotes prepared',
      bgColor: 'bg-purple-50',
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 8C0 3.58172 3.58172 0 8 0H32C36.4183 0 40 3.58172 40 8V32C40 36.4183 36.4183 40 32 40H8C3.58172 40 0 36.4183 0 32V8Z" fill="#FAF5FF" />
          <path d="M25.0446 27.5H14.9558C14.5619 27.5 14.1992 27.4 13.8677 27.2C13.5362 27 13.2744 26.7275 13.0822 26.3825C12.89 26.0375 12.7939 25.66 12.7939 25.25V13.25C12.7939 13.04 12.8636 12.8625 13.0029 12.7175C13.1422 12.5725 13.3128 12.5 13.5146 12.5H23.6033C23.8051 12.5 23.9756 12.5725 24.115 12.7175C24.2543 12.8625 24.3239 13.04 24.3239 13.25V22.25H27.2064V25.25C27.2064 25.66 27.1104 26.0375 26.9182 26.3825C26.726 26.7275 26.4642 27 26.1327 27.2C25.8012 27.4 25.4385 27.5 25.0446 27.5ZM24.3239 23.75V25.25C24.3239 25.46 24.3936 25.6375 24.5329 25.7825C24.6722 25.9275 24.8428 26 25.0446 26C25.2463 26 25.4169 25.9275 25.5562 25.7825C25.6955 25.6375 25.7652 25.46 25.7652 25.25V23.75H24.3239ZM22.8827 26V14H14.2352V25.25C14.2352 25.46 14.3049 25.6375 14.4442 25.7825C14.5835 25.9275 14.754 26 14.9558 26H22.8827ZM14.2352 14H22.8827V26H14.9558C14.754 26 14.5835 25.9275 14.4442 25.7825C14.3049 25.6375 14.2352 25.46 14.2352 25.25V14ZM15.6764 16.25H21.4414V17.75H15.6764V16.25ZM15.6764 19.25H21.4414V20.75H15.6764V19.25ZM15.6764 22.25H19.2796V23.75H15.6764V22.25Z" fill="#9333EA" />
        </svg>
      ),
    },
    {
      label: 'Avg Renders Per Retailer',
      value: formatAverage(insights.avgRendersPerRetailer),
      subtext: 'Per active retailer',
      bgColor: 'bg-indigo-50',
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 8C0 3.58172 3.58172 0 8 0H32C36.4183 0 40 3.58172 40 8V32C40 36.4183 36.4183 40 32 40H8C3.58172 40 0 36.4183 0 32V8Z" fill="#EEF2FF" />
          <path d="M13.1543 20.375H14.5955V27.125H13.1543V20.375ZM15.3162 21.875H16.7574V27.125H15.3162V21.875ZM23.243 17.375H24.6843V27.125H23.243V17.375ZM25.4049 18.875H26.8462V27.125H25.4049V18.875ZM18.1987 12.875H19.6399V27.125H18.1987V12.875ZM20.3605 14.375H21.8018V27.125H20.3605V14.375Z" fill="#4F46E5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[#111827] mb-1">Usage Insights</h1>
        <p className="text-sm text-gray-500">Track platform activity to optimize pricing strategy.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-5 transition-all">
            <div className={`${iconClass} ${stat.bgColor}`}>{stat.icon}</div>
            <div>
              <div className="text-2xl font-bold text-[#111827] mb-0.5 leading-none">{stat.value}</div>
              <div className="text-sm font-medium text-[#374151] leading-tight mt-1">{stat.label}</div>
              <div className="text-xs text-[#9CA3AF] font-normal mt-1">{stat.subtext}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-6 overflow-x-auto -mx-4 sm:mx-0">
        <div className="mb-6">
          <h2 className="text-base font-bold text-[#111827]">Most Active Retailers</h2>
          <p className="text-xs text-gray-500 font-normal">
            Ranked by total renders generated this billing period.
          </p>
        </div>

        <table className="w-full min-w-[600px] text-left border-collapse">
          <thead>
            <tr className="border-b border-[#F3F4F6] pt-5 bg-[#F9FAFB] text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="pb-4 w-20 pl-4 pt-4">Rank</th>
              <th className="pb-4 pt-4">Retailer</th>
              <th className="pb-4 pt-4">Renders</th>
              <th className="pb-4 pl-6 pt-4">Customer Shares</th>
              <th className="pb-4 pl-6 pt-4">Manufacturer Quotes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6] text-sm text-[#111827]">
            {designersData?.items?.map((item, index) => {
              const rank = index + 1;
              const name = item.user?.name || 'Unknown Retailer';
              const initial = name.charAt(0).toUpperCase();

              // Rank badge styling
              let rankBadgeClass = 'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ';
              if (rank === 1) {
                rankBadgeClass += 'bg-[#FEF3C7] text-[#D97706]';
              } else if (rank === 2) {
                rankBadgeClass += 'bg-[#F3F4F6] text-[#4B5563]';
              } else if (rank === 3) {
                rankBadgeClass += 'bg-[#FFEDD5] text-[#EA580C]';
              } else {
                rankBadgeClass += 'bg-transparent text-[#9CA3AF] border border-transparent';
              }

              // Calculate render percentage bar relative to maximum renders
              const maxRenders = Math.max(...(designersData?.items?.map(d => d.totalDesignsCreated) || [100]), 1);
              const percentage = Math.min((item.totalDesignsCreated / maxRenders) * 100, 100);

              return (
                <tr key={item.user?.id || index} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 pl-4">
                    <div className={rankBadgeClass}>{rank}</div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-sm">
                        {initial}
                      </div>
                      <span className="font-semibold text-gray-900">{name}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-[140px] bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="font-bold text-gray-800">{item.totalDesignsCreated}</span>
                    </div>
                  </td>
                  <td className="py-4 pl-6 text-gray-500 font-medium">{item.totalDesignShares}</td>
                  <td className="py-4 pl-6 text-gray-500 font-medium">{item.totalManufacturerQuotes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
