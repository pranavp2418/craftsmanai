'use client';

import { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import AnalyticsKPISection from './AnalyticsKPISection';
import AnalyticsCharts from './AnalyticsCharts';
import AnalyticsFunnel from './AnalyticsFunnel';
import AnalyticsProductMix from './AnalyticsProductMix';
import AnalyticsHistoryReport from './AnalyticsHistoryReport';
import AnalyticsArchiveTab from './AnalyticsArchiveTab';
import RestoreItemModal from './RestoreItem';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchArchivedDesigns } from '@/redux/slices/retailer/analytics/archivedSlice';
import { fetchArchivedVersions, resetArchivedVersions } from '@/redux/slices/retailer/analytics/archivedVersionsSlice';

export default function Analytics() {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<'overview' | 'archive'>('overview');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [restoredIds, setRestoredIds] = useState<string[]>([]);

  const { total: requestsTotal, items: archivedRequests, loading: requestsLoading } = useAppSelector((state) => state.retailerAnalyticsArchived);
  const { total: versionsTotal, items: archivedVersions, loading: versionsLoading } = useAppSelector((state) => state.retailerAnalyticsArchivedVersions);

  useEffect(() => {
    dispatch(fetchArchivedDesigns({ page: 1, limit: 10 }));
    dispatch(resetArchivedVersions());
    dispatch(fetchArchivedVersions({ page: 1, limit: 20 }));
  }, [dispatch]);

  const archiveCount = (requestsTotal || 0) + (versionsTotal || 0);

  const handleRestoreClick = (id: string) => {
    setPendingRestoreId(id);
    setRestoreOpen(true);
  };

  const handleRestoreConfirm = () => {
    if (!pendingRestoreId) return;
    setRestoredIds((prev) => (prev.includes(pendingRestoreId) ? prev : [...prev, pendingRestoreId]));
    setPendingRestoreId(null);
    setRestoreOpen(false);
  };

  return (
    <div className="min-h-screen bg-surface-page">
      <TopBar />
      <div className="max-w-[1350px] mx-auto px-4 sm:px-6 lg:px-8 pb-8 lg:pb-12 pt-5 lg:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-heading-md sm:text-heading-lg font-bold text-ink-900  dark:text-[#E7EAEE] font-satoshi">Analytics</h1>
            <p className="text-body-sm text-ink-400 mt-0.5">Platform performance &amp; design insights</p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full border border-white/60 dark:border-border-default w-fit bg-glass-72 backdrop-blur-lg shadow-glow-indigo-pop"
>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              aria-pressed={activeTab === 'overview'}
              className={`px-4 sm:px-5 min-h-touch rounded-full text-body-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-gradient-indigo text-white dark:text-black shadow-glow-indigo-tab'
                  : 'text-ink-500'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              aria-pressed={activeTab === 'archive'}
              className={`px-4 sm:px-5 min-h-touch rounded-full text-body-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'archive'
                  ? 'bg-gradient-indigo text-white dark:text-black shadow-glow-indigo-tab'
                  : 'text-ink-500'
              }`}
            >
              Archive
              <span className={`px-1.5 py-0.5 rounded-full text-caption-xs font-semibold ${
                activeTab === 'archive'
                  ? 'bg-white/25 text-white'
                  : 'bg-tint-indigo-strong text-indigo-accent'
              }`}>
                {archiveCount}
              </span>
            </button>
          </div>
        </div>

        {activeTab === 'overview' ? (
          <>
            <AnalyticsKPISection />
            <AnalyticsCharts />
            <AnalyticsFunnel />
            <AnalyticsProductMix />
            <AnalyticsHistoryReport />
          </>
        ) : (
          <AnalyticsArchiveTab restoredIds={restoredIds} onRestoreClick={handleRestoreClick} />
        )}
      </div>

      <RestoreItemModal
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onConfirm={handleRestoreConfirm}
      />
    </div>
  );
}