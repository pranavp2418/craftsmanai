import React, { useEffect, useState } from 'react';
import { X, ImageOff, Images } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchRetailerHistory,
  type RetailerInfo,
  type HistoryVariant,
} from '@/redux/slices/admin/retailers/adminRetailerInfoSlice';
import Pagination from '../../dashboard/components/Pagination';

interface ViewRetailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailer: RetailerInfo | null;
  loading?: boolean;
}

const formatDateTime = (iso: string | null) => {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'N/A';
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
};

const HISTORY_LIMIT = 8;

// Clickable image thumbnail (opens full image in a new tab).
const Thumb = ({ src, alt, size = 'md' }: { src: string | null; alt: string; size?: 'sm' | 'md' }) => {
  const box = size === 'sm' ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-16 h-16 sm:w-20 sm:h-20';
  if (!src) {
    return (
      <div className={`${box} rounded-lg border border-gray-200 bg-white flex items-center justify-center shrink-0`}>
        <ImageOff className="w-4 h-4 text-gray-300" />
      </div>
    );
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className={`${box} rounded-lg overflow-hidden border border-gray-200 bg-white block shrink-0 hover:ring-2 hover:ring-[#2F68C5] transition`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover object-center" />
    </a>
  );
};

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center gap-3 py-2 border-b border-gray-100 last:border-0">
    <span className="text-[11px] sm:text-xs text-[#6D6D6D] shrink-0">{label}</span>
    <span className="text-[11px] sm:text-xs font-medium text-[#1F2937] text-right break-all">{value}</span>
  </div>
);

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-[#F9F9F9] rounded-xl p-2.5 sm:p-3">
    <p className="text-[10px] sm:text-[11px] text-[#8A8A8A] mb-0.5 leading-snug">{label}</p>
    <p className="text-lg sm:text-xl font-semibold text-[#1F2937] leading-tight">{value}</p>
  </div>
);

// One output render (base or refine) as a compact card in the horizontal strip.
const VariantCard = ({ v }: { v: HistoryVariant }) => (
  <div className="shrink-0 w-28 sm:w-32">
    <Thumb src={v.output_image} alt={v.label} />
    <div className="mt-1">
      <span
        className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold ${
          v.label === 'Base' ? 'bg-[#EDE9FE] text-[#6D28D9]' : 'bg-[#E0F2FE] text-[#0369A1]'
        }`}
      >
        {v.label}
      </span>
      {v.prompt?.trim() && (
        <p className="text-[9px] sm:text-[10px] text-[#4B5563] mt-0.5 line-clamp-2 break-words leading-snug">{v.prompt}</p>
      )}
      <p className="text-[8px] sm:text-[9px] text-[#9CA3AF] mt-0.5">{formatDateTime(v.created_at)}</p>
    </div>
  </div>
);

const ViewRetailerModal: React.FC<ViewRetailerModalProps> = ({ isOpen, onClose, retailer, loading = false }) => {
  const dispatch = useAppDispatch();
  const { history, historyLoading, historyPagination } = useAppSelector((state) => state.adminRetailerInfo);
  const [historyPage, setHistoryPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  const retailerId = retailer?.id;

  useEffect(() => {
    if (isOpen && retailerId && activeTab === 'history') {
      dispatch(fetchRetailerHistory({ retailer_id: retailerId, page: historyPage, limit: HISTORY_LIMIT }));
    }
  }, [isOpen, retailerId, historyPage, activeTab, dispatch]);

  useEffect(() => {
    setHistoryPage(1);
    setActiveTab('details');
  }, [retailerId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-[#00000080] backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl md:rounded-3xl w-full sm:max-w-3xl h-[90vh] sm:h-[88vh] relative z-10 flex flex-col overflow-hidden"
        style={{ boxShadow: '0px 20px 25px -5px #0000001A, 0px 8px 10px -6px #0000001A' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-[#1F2937] leading-tight truncate">{retailer?.name || 'Retailer Details'}</h2>
            {retailer?.email && <p className="text-[10px] sm:text-xs text-[#8A8A8A] truncate">{retailer.email}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0">
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 sm:px-6 gap-1 border-b border-gray-100 shrink-0">
          {(['details', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab ? 'text-[#2F68C5]' : 'text-[#8A8A8A] hover:text-[#4B5563]'
              }`}
            >
              {tab === 'details' ? 'Details' : 'Generation History'}
              {activeTab === tab && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#2F68C5] rounded-full" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="bg-[#F9F9F9] rounded-xl p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                    <div className="h-3 w-32 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : !retailer ? (
            <p className="text-center text-sm text-[#8A8A8A] py-10">No data.</p>
          ) : activeTab === 'details' ? (
            <div className="space-y-4">
              <div className="bg-[#F9F9F9] rounded-xl px-3 sm:px-4 py-1">
                <InfoRow label="Retailer ID" value={retailer.retailerId || 'N/A'} />
                <InfoRow label="Contact" value={retailer.contactNumber || 'N/A'} />
                <InfoRow label="Joined" value={retailer.joinedDate || 'N/A'} />
                <InfoRow
                  label="Status"
                  value={
                    <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium ${
                      retailer.status === 'active' ? 'bg-[#DCFCE7] text-[#1D8C1D]' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {retailer.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <StatCard label="Total Requests" value={retailer.totalRequests} />
                <StatCard label="Active Requests" value={retailer.activeRequests} />
                <StatCard label="Completed" value={retailer.completedRequests} />
                <StatCard label="Manufacturers" value={retailer.associatedManufacturers} />
              </div>
            </div>
          ) : (
            /* ── HISTORY (full view) ── */
            <div>
              {historyLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-[#F9F9F9] rounded-xl p-3 space-y-2">
                      <div className="h-3 w-1/3 bg-gray-200 rounded" />
                      <div className="flex gap-2">
                        {[...Array(4)].map((_, j) => <div key={j} className="w-16 h-16 bg-gray-200 rounded-lg" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 text-[#8A8A8A]">
                  <Images className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-xs sm:text-sm">No generations yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.design_id} className="bg-[#F9F9F9] rounded-xl p-3 sm:p-4">
                      {/* Header row: type + code + date */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {item.jewellery_type && (
                            <span className="px-2 py-0.5 rounded-full bg-[#EBF3FE] text-[#2F68C5] text-[9px] sm:text-[10px] font-semibold shrink-0">{item.jewellery_type}</span>
                          )}
                          {item.design_code && <span className="text-[9px] sm:text-[10px] text-[#B0B0B0] truncate">{item.design_code}</span>}
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-[#9CA3AF] shrink-0">{formatDateTime(item.created_at)}</span>
                      </div>

                      {/* Inputs + create prompt */}
                      <div className="flex gap-3 mb-3">
                        <div className="shrink-0">
                          <p className="text-[9px] sm:text-[10px] font-medium text-[#6D6D6D] mb-1">
                            Input{item.input_images.length !== 1 ? `s (${item.input_images.length})` : ''}
                          </p>
                          {item.input_images.length > 0 ? (
                            <div className="flex gap-1.5">
                              {item.input_images.map((src, i) => <Thumb key={i} src={src} alt={`Input ${i + 1}`} size="sm" />)}
                            </div>
                          ) : (
                            <Thumb src={null} alt="No input" size="sm" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] sm:text-[10px] font-medium text-[#6D6D6D] mb-1">Prompt</p>
                          <p className="text-[10px] sm:text-[11px] text-[#374151] line-clamp-3 break-words leading-snug">
                            {item.prompt?.trim() ? item.prompt : <span className="italic text-[#B0B0B0]">No prompt</span>}
                          </p>
                        </div>
                      </div>

                      {/* Outputs: base + refines (horizontal scroll) */}
                      <div>
                        <p className="text-[9px] sm:text-[10px] font-medium text-[#6D6D6D] mb-1.5">
                          Outputs — base + refines ({item.variants.length})
                        </p>
                        {item.variants.length > 0 ? (
                          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                            {item.variants.map((v) => <VariantCard key={v.variant_id} v={v} />)}
                          </div>
                        ) : (
                          <p className="text-[10px] text-[#B0B0B0] italic">No output generated.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 shrink-0">
          {activeTab === 'history' && !historyLoading && historyPagination.total_pages > 1 ? (
            <Pagination
              currentPage={historyPagination.page}
              totalPages={historyPagination.total_pages}
              onPageChange={setHistoryPage}
              totalItems={historyPagination.total_items}
              itemsPerPage={historyPagination.limit}
            />
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2 sm:py-2.5 bg-[#EBF3FE] text-[#2F68C5] rounded-lg sm:rounded-full font-medium hover:bg-[#DBE9FD] transition-colors text-xs sm:text-sm cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewRetailerModal;
