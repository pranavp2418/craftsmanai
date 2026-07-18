'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import PromptBox from '@/components/dashboard/PromptBox';
import RequestHeader from '@/components/dashboard/RequestHeader';
import DesignGrid from '@/components/dashboard/DesignGrid';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchDesigns } from '@/redux/slices/retailer/designsSlice';

export default function Dashboard() {
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const lastFetchedPageRef = useRef(1);
  const lastFetchedParamsRef = useRef<{ search: string } | null>(null);
  const dispatch = useAppDispatch();
  const { items, loading, error, total, hasMore } = useAppSelector((state) => state.retailerDesigns);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  useEffect(() => {
    const currentParams = { search: debouncedSearch };
    if (
      lastFetchedParamsRef.current &&
      lastFetchedParamsRef.current.search === currentParams.search
    ) {
      return;
    }
    lastFetchedParamsRef.current = currentParams;

    setPage(1);
    lastFetchedPageRef.current = 1;
    dispatch(fetchDesigns({
      limit: 16,
      page: 1,
      search: debouncedSearch.trim() || undefined,
    }));
  }, [dispatch, debouncedSearch]);

  const handleLoadMore = () => {
    if (loading || items.length >= total) return;
    const nextPage = page + 1;
    if (lastFetchedPageRef.current === nextPage) return;
    lastFetchedPageRef.current = nextPage;
    setPage(nextPage);
    dispatch(fetchDesigns({
      limit: 16,
      page: nextPage,
      search: debouncedSearch.trim() || undefined,
      append: true,
    }));
  };

  const [unfilteredItems, setUnfilteredItems] = useState<any[]>([]);

  useEffect(() => {
    if (!search.trim()) {
      setUnfilteredItems(items);
    }
  }, [items, search]);

  const filteredDesigns = useMemo(() => {
    if (!items) return [];
    const query = search.trim().toLowerCase();
    if (!query) return items;

    const clientFiltered = (unfilteredItems || []).filter((item) => {
      const name = (item.name || '').toLowerCase();
      const code = (item.design_code || '').toLowerCase();
      const type = (item.jewellery_type || '').toLowerCase();
      const customer = (item.shared_customer?.customer_name || '').toLowerCase();
      return name.includes(query) || code.includes(query) || type.includes(query) || customer.includes(query);
    });

    const combined = [...items];
    clientFiltered.forEach((item) => {
      if (!combined.some((c) => c.id === item.id)) {
        combined.push(item);
      }
    });

    return combined;
  }, [items, unfilteredItems, search]);

  return (
    <div className="min-h-screen bg-surface-page dark:bg-surface-page text-ink dark:text-ink">
      <TopBar />
      {/* Mobile: 16px gutters / Tablet: 24px / Desktop: 32px. */}
      <div className="max-w-[1350px] mx-auto px-4 sm:px-6 lg:px-8 pb-6 lg:pb-8 pt-3">
        <PromptBox />
        <RequestHeader 
          collapsed={!catalogOpen} 
          onToggle={() => setCatalogOpen((prev) => !prev)} 
          search={search}
          onSearchChange={setSearch}
        />
        {catalogOpen && (
          <DesignGrid 
            designs={filteredDesigns} 
            loading={loading} 
            error={error} 
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
          />
        )}
      </div>
    </div>
  );
}
