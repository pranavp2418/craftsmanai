import React from 'react';
import { UserX, TrendingDown, Clock, Lightbulb, RefreshCw, Search, MessageSquare } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useDebounce } from '@/src/utils/hooks/useDebounce';
import { fetchCancellationSummary } from '@/redux/slices/admin/subscriptions/adminCancellationSummarySlice';
import { fetchCancellationReasons } from '@/redux/slices/admin/subscriptions/adminCancellationReasonsSlice';
import { fetchCancellationTrends } from '@/redux/slices/admin/subscriptions/adminCancellationTrendsSlice';
import { fetchCancellationRecords } from '@/redux/slices/admin/subscriptions/adminCancellationRecordsSlice';

const COLORS = ['#EF4444', '#F59E0B', '#EAB308', '#8B5CF6', '#94A3B8'];

const REASON_FILTERS = [
  'Too expensive',
  'Not using the platform enough',
  'Found an alternative solution',
  'Store closed temporarily',
  'Other reason',
];

const ShimmerLoader = () => (
    <div className="w-full space-y-6 pb-12 animate-pulse">
      <div className="mb-8 px-1">
        <div className="h-6 w-48 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 w-96 bg-gray-100 rounded"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-[24px] border border-gray-100 p-6 flex items-center gap-5">
            <div className="w-12 h-12 bg-gray-100 rounded-[16px]"></div>
            <div className="flex-1 space-y-2">
              <div className="h-7 w-20 bg-gray-200 rounded"></div>
              <div className="h-4 w-32 bg-gray-100 rounded"></div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="h-[300px] bg-white rounded-[32px] border border-gray-100"></div>
        <div className="h-[300px] bg-white rounded-[32px] border border-gray-100"></div>
      </div>
    </div>
  );

export default function CancellationInsights() {
  const dispatch = useAppDispatch();
  const { data: summary, loading: summaryLoading, error: summaryError } = useAppSelector((state) => state.adminCancellationSummary);
  const { reasons, loading: reasonsLoading, error: reasonsError } = useAppSelector((state) => state.adminCancellationReasons);
  const { trends, loading: trendsLoading, error: trendsError } = useAppSelector((state) => state.adminCancellationTrends);
  const { records, total, loading: recordsLoading, error: recordsError, page, limit } = useAppSelector((state) => state.adminCancellationRecords);
  const hasFetched = React.useRef(false);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);

  const debouncedSearch = useDebounce(searchQuery, 400);

  const lastFetchedParams = React.useRef<string | null>(null);

  // All hooks must be called before any conditional returns
  React.useEffect(() => {
    if (!hasFetched.current) {
      dispatch(fetchCancellationSummary());
      dispatch(fetchCancellationReasons());
      dispatch(fetchCancellationTrends());
      hasFetched.current = true;
    }
  }, [dispatch]);

  // Reset pagination when search or filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeFilter]);

  // Fetch records when search, filter, or page changes
  React.useEffect(() => {
    const params = {
      search: debouncedSearch.trim() || undefined,
      reason: activeFilter || undefined,
      page: currentPage,
      limit,
    };
    const paramStr = JSON.stringify(params);
    if (lastFetchedParams.current === paramStr) return;
    lastFetchedParams.current = paramStr;

    dispatch(fetchCancellationRecords(params));
  }, [debouncedSearch, activeFilter, currentPage, dispatch, limit]);

  // Filter and search records - moved before early return
  const filteredRecords = React.useMemo(() => {
    return (records || []).map((record) => {
      const date = new Date(record.cancellation_date);
      const formattedDate = !isNaN(date.getTime())
        ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A';

      return {
        id: record.id,
        retailer: record.retailer_name,
        plan: record.plan_name,
        date: formattedDate,
        reason: record.cancellation_reason,
        status: record.status,
      };
    });
  }, [records]);

  const loading = summaryLoading || reasonsLoading || trendsLoading;
  const error = summaryError || reasonsError || trendsError;

  if (loading && !summary && reasons.length === 0 && trends.length === 0) return <ShimmerLoader />;

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-[24px] border border-red-100">
        <p className="text-red-600 font-medium mb-3">{error}</p>
        <button 
          onClick={() => {
            dispatch(fetchCancellationSummary());
            dispatch(fetchCancellationReasons());
            dispatch(fetchCancellationTrends());
          }} 
          className="flex items-center gap-2 mx-auto text-xs font-bold text-[#2C62B9] underline uppercase tracking-widest"
        >
          <RefreshCw className="w-3 h-3" /> Try Again
        </button>
      </div>
    );
  }

  const data = summary || {
    totalCancellations: 0,
    churnRate: 0,
    avgTenure: 0,
    keyInsight: {
      primary: 'No data available at the moment.',
      secondary: ''
    }
  };

  const stats = [
    { label: 'Total Cancellations', value: data.totalCancellations.toString(), subtext: '', icon: <UserX className="w-5 h-5 text-red-500" />, bgColor: 'bg-red-50' },
    { label: 'Churn Rate (Aug)', value: `${data.churnRate}%`, subtext: '', icon: <TrendingDown className="w-5 h-5 text-orange-500" />, bgColor: 'bg-orange-50' },
    { label: 'Avg Tenure Before Cancel', value: `${data.avgTenure} mo`, subtext: '', icon: <Clock className="w-5 h-5 text-purple-500" />, bgColor: 'bg-purple-50' },
  ];

  // Map reasons with colors
  const mappedReasons = reasons.map((item, idx) => ({
    name: item.reason,
    value: item.percentage,
    color: COLORS[idx % COLORS.length]
  }));

  // Fallback if no reasons
  const displayReasons = mappedReasons.length > 0 ? mappedReasons : [
    { name: 'Loading reasons...', value: 0, color: '#E5E7EB' }
  ];

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8 px-1">
        <h1 className="text-xl font-bold text-[#111827] mb-1">Cancellation Insights</h1>
        <p className="text-sm text-gray-500">Aggregated feedback from retailer cancellation flows to monitor churn behavior.</p>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-6 flex items-center gap-5 transition-all">
            <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center ${stat.bgColor}`}>
              {stat.icon}
            </div>
            <div>
              <div className="text-[28px] font-bold text-[#111827] leading-none mb-1">{stat.value}</div>
              <div className="text-sm font-medium text-[#6B7280]">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Reasons Donut Chart */}
        <div className="bg-white rounded-[32px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-8">
          <h2 className="text-sm font-bold text-[#111827] mb-8">Cancellation Reasons</h2>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="relative w-48 h-48 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="40" stroke="#F1F5F9" strokeWidth="12" fill="none" />
                {displayReasons.slice(0, 2).map((item, idx) => {
                   // This is a simplified donut for the mock UI
                   const offset = idx === 0 ? 0 : 251.2 * (displayReasons[0].value / 100);
                   return (
                     <circle 
                       key={item.name}
                       cx="50" cy="50" r="40" 
                       stroke={item.color} 
                       strokeWidth="12" 
                       fill="none" 
                       strokeDasharray="251.2" 
                       strokeDashoffset={251.2 * (1 - item.value / 100)} 
                       className={idx > 0 ? `transform rotate-[${(displayReasons[0].value / 100) * 360}deg] origin-center` : ''}
                     />
                   )
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#111827]">{data.totalCancellations}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total</div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 space-y-4 w-full">
              {displayReasons.map((item) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] font-semibold text-gray-500">{item.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#111827]">{item.value}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trend Bar Chart */}
        <div className="bg-white rounded-[32px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-8">
          <h2 className="text-sm font-bold text-[#111827] mb-8">Cancellation Trend</h2>
          <div className="h-[240px] w-full min-w-0 min-h-0 max-w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={trends} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
                />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                  {trends.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#FDA4AF" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Key Insight Section */}
      <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-6">
        <h2 className="text-sm font-bold text-[#111827] mb-2">Key Insight</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{data.keyInsight.primary}</p>
        
        {data.keyInsight.secondary && (
          <div className="bg-[#FFFBEB] rounded-[12px] p-4 flex items-center gap-4 border border-[#FEF3C7]">
            <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-[13.5px] text-[#92400E] font-medium leading-relaxed">
              {data.keyInsight.secondary}
            </div>
          </div>
        )}
      </div>

      {/* Individual Cancellation Records Table */}
      <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-6">
        {/* Table Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <h2 className="text-sm font-bold text-[#111827]">Individual Cancellation Records</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-auto sm:min-w-[220px] md:min-w-0">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search retailer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-4 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111827] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2C62B9]/20 focus:border-[#2C62B9]"
              />
            </div>
            <button
              onClick={() => setActiveFilter(null)}
              className={`h-10 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeFilter === null
                  ? 'bg-[#111827] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Reasons
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-5 overflow-x-auto md:overflow-visible pb-1">
          {REASON_FILTERS.map((reason) => (
            <button
              key={reason}
              onClick={() => setActiveFilter(activeFilter === reason ? null : reason)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                activeFilter === reason
                  ? 'border-[#111827] bg-[#111827] text-white'
                  : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
          <table className="w-full min-w-[720px] md:min-w-0">
            <thead>
              <tr className="border-b border-[#F1F5F9]">
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider pb-3 pr-4">Retailer</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider pb-3 pr-4">Plan</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider pb-3 pr-4">Cancellation Date</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider pb-3 pr-4">Reason</th>
                <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recordsLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="border-b border-[#F5F5F5] last:border-b-0 animate-pulse">
                    <td className="py-4 pr-4"><div className="h-4 w-32 bg-gray-100 rounded" /></td>
                    <td className="py-4 pr-4"><div className="h-4 w-20 bg-gray-100 rounded" /></td>
                    <td className="py-4 pr-4"><div className="h-4 w-28 bg-gray-100 rounded" /></td>
                    <td className="py-4 pr-4"><div className="h-8 w-40 bg-gray-100 rounded-md" /></td>
                    <td className="py-4 text-right"><div className="h-6 w-20 bg-gray-100 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : recordsError ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-red-500 font-medium">Error: {recordsError}</span>
                      <button
                        onClick={() => dispatch(fetchCancellationRecords({ page: currentPage, limit }))}
                        className="px-4 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-[#2F68C5] font-bold transition-all"
                      >
                        TRY AGAIN
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b border-[#F5F5F5] last:border-b-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 pr-4 text-sm font-medium text-[#111827]">{record.retailer}</td>
                    <td className="py-4 pr-4 text-sm text-[#6B7280]">{record.plan}</td>
                    <td className="py-4 pr-4 text-sm text-[#6B7280]">{record.date}</td>
                    <td className="py-4 pr-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F9FAFB] border border-[#E5E7EB] text-sm font-medium text-[#374151]">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3.341 9.11914L1.2002 10.8691V1.61914C1.2002 1.48581 1.2466 1.36914 1.3394 1.26914C1.4322 1.16914 1.5458 1.11914 1.6802 1.11914H10.3202C10.4546 1.11914 10.5682 1.16914 10.661 1.26914C10.7538 1.36914 10.8002 1.48581 10.8002 1.61914V8.61914C10.8002 8.75914 10.7538 8.87914 10.661 8.97914C10.5682 9.07914 10.4546 9.12581 10.3202 9.11914H3.341ZM2.1602 8.81914L3.005 8.11914H9.8402V2.11914H2.1602V8.81914ZM6.6818 5.11914L7.8626 6.35914L7.1906 7.06914L6.0002 5.82914L4.8098 7.06914L4.1378 6.35914L5.3186 5.11914L4.1378 3.88914L4.8098 3.17914L6.0002 4.41914L7.1906 3.17914L7.8626 3.88914L6.6818 5.11914Z" fill="#9CA3AF"/>
</svg>
                        {record.reason}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <span className="text-sm font-medium text-[#EF4444] p-2 bg-[#FEF2F2] rounded-lg">{record.status}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                    No cancellation records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!recordsLoading && filteredRecords.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing {filteredRecords.length} of {total} records
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-gray-600">
                Page {currentPage} of {Math.max(1, Math.ceil(total / limit))}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= Math.ceil(total / limit)}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
