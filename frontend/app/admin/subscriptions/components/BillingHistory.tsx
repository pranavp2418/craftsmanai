import React, { useState, useEffect, useMemo } from 'react';
import { Download, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import RefundModal from './RefundModal';
import InvoiceDetailsModal from './InvoiceDetailsModal';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchPaymentHistory } from '@/redux/slices/admin/subscriptions/adminPaymentHistorySlice';
import { downloadPaymentRecordCSV } from '@/redux/slices/admin/subscriptions/adminDownloadPaymentRecordCSVSlice';
import { exportPaymentHistory } from '@/redux/slices/admin/subscriptions/adminExportPaymentHistorySlice';
import { useDebounce } from '@/src/utils/hooks/useDebounce';
import Pagination from '@/app/admin/dashboard/components/Pagination';

const statusStyles = {
  Paid: 'bg-[#ECFDF5] text-[#10B981]',
  Failed: 'bg-[#FEF2F2] text-[#EF4444]',
  Refunded: 'bg-[#F3F4F6] text-[#6B7280]',
  Pending: 'bg-[#FFFBEB] text-[#F59E0B]',
};

const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '??';
const avatarColors = [
  'bg-blue-100 text-blue-600',
  'bg-indigo-100 text-indigo-600',
  'bg-sky-100 text-sky-600',
  'bg-purple-100 text-purple-600',
  'bg-rose-100 text-rose-600'
];
const getAvatarColor = (index: number) => avatarColors[index % avatarColors.length];

export default function BillingHistory() {
  const dispatch = useAppDispatch();
  const { history, loading, error } = useAppSelector((state) => state.adminPaymentHistory);
  const { exportingId: downloadingId } = useAppSelector((state) => state.adminDownloadPaymentRecordCSV);
  const { exporting } = useAppSelector((state) => state.adminExportPaymentHistory);

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const lastFetchedParams = React.useRef<string | null>(null);

  useEffect(() => {
    const params = {
      search: debouncedSearchQuery.trim(),
      status: activeFilter,
    };
    const paramStr = JSON.stringify(params);
    if (lastFetchedParams.current === paramStr) return;
    lastFetchedParams.current = paramStr;

    dispatch(fetchPaymentHistory(params));
  }, [debouncedSearchQuery, activeFilter, dispatch]);


  const handleOpenRefund = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsRefundModalOpen(true);
  };

  const handleOpenInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsInvoiceModalOpen(true);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleDownload = (item: any) => {
    dispatch(downloadPaymentRecordCSV({ paymentId: item.payment_id, invoiceId: item.id }));
  };

  const handleExportAll = () => {
    dispatch(exportPaymentHistory({ search: debouncedSearchQuery.trim(), status: activeFilter }));
  };

  const filters = ['All', 'Paid', 'Pending', 'Failed'];

  const filteredHistory = useMemo(() => {
    const list = Array.isArray(history) ? history : [];
    return list
      .map((item, idx) => {
        const date = new Date(item.created_at);
        const formattedDate = !isNaN(date.getTime())
          ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '-';

        const displayStatus = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase() : 'Unknown';

        return {
          ...item,
          id: item.invoice_id,
          payment_id: item.id,
          retailer: item.retailer_name,
          plan: item.plan_name,
          amount: `${item.currency === 'USD' ? '$' : item.currency + ' '}${item.amount}`,
          status: displayStatus,
          date: formattedDate,
          initial: getInitials(item.retailer_name),
          color: getAvatarColor(idx),
        };
      });
  }, [history]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, activeFilter]);

  const displayedHistory = useMemo(() => {
    return filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredHistory, currentPage, itemsPerPage]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#111827] mb-1">Billing History</h1>
          <p className="text-sm text-gray-500">View all platform billing transactions and manage invoices.</p>
        </div>
        <button
          onClick={handleExportAll}
          disabled={exporting}
          className="flex items-center gap-2 bg-[#2F68C5] hover:bg-[#2556A3] text-white px-5 py-2.5 rounded-full text-[13px] sm:text-sm font-bold shadow-md transition-all active:scale-95 group disabled:opacity-70 disabled:pointer-events-none"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0px_1px_2px_0px_#0000000D] overflow-hidden mb-6 -mx-4 sm:mx-0">
        {/* Search & Filter Header */}
        <div className="p-4 sm:p-6 flex flex-col xl:flex-row items-center justify-between gap-4 mb-2">
          <div className="relative w-full xl:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID or retailer..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full h-10 sm:h-11 pl-11 pr-4 bg-white border border-[#E5E7EB] rounded-[12px] text-[13px] sm:text-sm focus:outline-none focus:border-[#2F68C5] transition-all font-medium"
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

        {/* Table */}
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200">
          <table className="w-full border-collapse text-left min-w-[900px]">
            <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
              <tr>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Invoice ID</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Retailer</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Plan</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Amount</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider text-center">Status</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Date</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-right text-[11px] sm:text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4FB]">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-5 whitespace-nowrap"><div className="h-4 w-24 bg-gray-50 rounded" /></td>
                    <td className="px-6 py-5 whitespace-nowrap"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-gray-100 rounded-full" /><div className="h-4 w-32 bg-gray-50 rounded" /></div></td>
                    <td className="px-6 py-5 whitespace-nowrap"><div className="h-4 w-16 bg-gray-50 rounded" /></td>
                    <td className="px-6 py-5 whitespace-nowrap"><div className="h-5 w-20 bg-gray-50 rounded" /></td>
                    <td className="px-6 py-5 whitespace-nowrap"><div className="flex justify-center"><div className="h-6 w-16 bg-gray-100 rounded-full" /></div></td>
                    <td className="px-6 py-5 whitespace-nowrap"><div className="h-4 w-24 bg-gray-50 rounded" /></td>
                    <td className="px-6 py-5 whitespace-nowrap"><div className="flex justify-end gap-3"><div className="h-4 w-8 bg-gray-50 rounded" /><div className="h-4 w-8 bg-gray-50 rounded" /><div className="h-4 w-8 bg-gray-50 rounded" /></div></td>
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center border-none"><div className="flex flex-col items-center gap-2"><p className="text-sm text-red-500 font-medium">Error: {error}</p><button onClick={() => dispatch(fetchPaymentHistory())} className="px-4 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-[#2F68C5] font-bold transition-all">TRY AGAIN</button></div></td></tr>
              ) : displayedHistory.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center border-none"><span className="text-sm text-gray-500 font-medium">No transactions found matching your criteria.</span></td></tr>
              ) : (
                displayedHistory.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 sm:px-6 py-4 sm:py-5 font-normal text-[13px] sm:text-sm text-[#374151]">{item.id}</td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center font-medium justify-center text-[11px] sm:text-xs ${item.color} shrink-0`}>
                          {item.initial}
                        </div>
                        <span className="text-[13px] sm:text-sm font-normal text-[#111827]">{item.retailer}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 whitespace-nowrap">
                      <span className="text-[13px] sm:text-sm text-[#374151] font-normal">{item.plan}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 whitespace-nowrap">
                      <span className="text-[14px] sm:text-[15px] font-semibold text-[#111827]">{item.amount}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 whitespace-nowrap">
                      <div className="flex justify-center">
                        <span className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[12px] font-bold ${statusStyles[item.status as keyof typeof statusStyles]}`}>
                          {item.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 whitespace-nowrap text-[13px] sm:text-sm text-[#374151] font-normal">
                      {item.date}
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-3 sm:gap-4">
                        <button
                          onClick={() => handleOpenInvoice(item)}
                          className="text-[12px] sm:text-xs font-medium text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDownload(item)}
                          disabled={downloadingId === item.payment_id}
                          className="text-[12px] sm:text-xs font-medium text-[#374151] hover:text-gray-900 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {downloadingId === item.payment_id && <Loader2 className="w-3 h-3 animate-spin" />}
                          Download
                        </button>
                        {/* {(item.status === 'Paid' || item.id === 'INV-2026-0834') && (
                        <button 
                          onClick={() => handleOpenRefund(item)}
                          className="text-[12px] sm:text-xs font-medium text-[#EF4444] hover:text-red-700 transition-colors"
                        >
                          Refund
                        </button>
                      )} */}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredHistory.length}
          itemsPerPage={itemsPerPage}
        />
      </div>

      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        invoiceData={selectedInvoice}
      />

      <InvoiceDetailsModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        data={selectedInvoice}
      />
    </div>
  );
}
