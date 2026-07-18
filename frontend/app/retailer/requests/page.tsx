'use client';

import { placeholderImage } from '@/lib/placeholders';
import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchDesigns, fetchDesignByIdOrCode, type DesignApiItem } from '@/redux/slices/retailer/designsSlice';
import { fetchVariantsByDesignId, fetchVariantById, resetVariantsState, resetSingleVariantState } from '@/redux/slices/retailer/designVariantSlice';
import { completeDesign } from '@/redux/slices/retailer/designCompleteSlice';
import { downloadDesignRender } from '@/redux/slices/retailer/designDownloadRenderSlice';
import { archiveDesign } from '@/redux/slices/retailer/designArchiveSlice';
import { fetchDesignVariantManufacturerShares } from '@/redux/slices/retailer/designVariantManufacturerSharesSlice';
import { useSearchParams, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import RequestListPanel from '@/components/workspace/RequestListPanel';
import RequestContextBar from '@/components/workspace/RequestContextBar';
import WorkspaceTabs, { type WorkspaceTab } from '@/components/workspace/WorkspaceTabs';
import RenderCard, { cleanupActiveDesignSseConnections } from '@/components/workspace/RenderCard';
import ActionBar from '@/components/workspace/ActionBar';
import DraftHistory from '@/components/workspace/DraftHistory';
import CustomerApprovalPanel from '@/components/workspace/CustomerApprovalPanel';
import ManufacturerHandoffPanel from '@/components/workspace/ManufacturerHandoffPanel';
import RefinePromptModal from '@/components/workspace/RefinePromptModal';
import PromptSection from '@/components/workspace/PromptSection';
import DetailSheetModal from '@/components/workspace/DetailSheetModal';
import DetailSheetForm from '@/components/workspace/DetailSheetForm';
import ShareCustomerModal from '@/components/workspace/ShareCustomerModal';

import { Draft, RequestData } from '@/lib/requestsData';
import { getCacheBustedUrl } from '@/src/utils/image';
import { MANUFACTURERS } from '@/lib/manufacturersData';
import { getJSON, setJSON, STORAGE_KEYS } from '@/lib/storage';
import type { ArchivedRequest, ArchivedVersion } from '@/lib/types/archive';
import { toast } from 'react-toastify';
const formatApiDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return dateStr;
  const [, year, monthStr, dayStr, hourStr, minStr] = match;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(monthStr, 10) - 1;
  const month = months[monthIdx] || monthStr;
  const day = parseInt(dayStr, 10);
  const hour24 = parseInt(hourStr, 10);
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${month} ${day}, ${hour12}:${minStr} ${ampm}`;
};

const extraDraftImages = [
  placeholderImage({ query: 'jewelry design', width: 200, height: 200, seq: 'extra_d1', orientation: 'squarish' }),
  placeholderImage({ query: 'jewelry design', width: 200, height: 200, seq: 'extra_d2', orientation: 'squarish' }),
  placeholderImage({ query: 'jewelry design', width: 200, height: 200, seq: 'extra_d3', orientation: 'squarish' }),
];

const getMetalValue = (parsedObj: any, metalPayload: string): any => {
  if (!parsedObj || typeof parsedObj !== 'object') return null;
  const keysToTry: string[] = [];
  const norm = metalPayload.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm === 'gold') {
    keysToTry.push('gold', 'yellow', 'yg', 'yellow_gold');
  } else if (norm === 'silver') {
    keysToTry.push('silver', 'white', 'wg', 'white_gold');
  } else if (norm === 'rose_gold') {
    keysToTry.push('rose_gold', 'rosegold', 'rose', 'rg');
  } else {
    keysToTry.push(metalPayload);
  }
  for (const key of keysToTry) {
    if (parsedObj[key] !== undefined && parsedObj[key] !== null) {
      return parsedObj[key];
    }
  }
  return null;
};

const getMetalImage = (parsedObj: any, metalPayload: string): string | null => {
  const val = getMetalValue(parsedObj, metalPayload);
  if (!val) return null;
  if (typeof val === 'string' && val.length > 0) return val;
  if (typeof val === 'object') {
    return val.mainImage || val.url || val.image_url || val.image || null;
  }
  return null;
};

const normalizeApiStatus = (status?: string): RequestData['status'] => {
  return (status || 'DRAFT').trim().toUpperCase() as RequestData['status'];
};

function RequestsWorkspaceContent() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [requestSearch, setRequestSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const lastFetchedPageRef = useRef(1);
  const lastFetchedParamsRef = useRef<{ search: string; status: string } | null>(null);
  const lastFetchedVariantIdRef = useRef<string | number | null>(null);
  const lastFetchedActiveTabRef = useRef<WorkspaceTab | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Design');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(requestSearch.trim());
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [requestSearch]);

  const [requestStatus, setRequestStatus] = useState<'All' | 'GENERATING' | 'GENERATED' | 'SHARED' | 'APPROVED' | 'SENT_TO_MANUFACTURER' | 'COMPLETED'>('All');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [selectedVariantIdOverride, setSelectedVariantIdOverride] = useState<string | number | null>(null);
  const [activeMetal, setActiveMetal] = useState('yellow');
  const [activeAngleId, setActiveAngleId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'workspace'>('workspace');
  const [archiveConfirm, setArchiveConfirm] = useState<{ type: 'request' | 'version'; draft?: Draft } | null>(null);
  const [showRefine, setShowRefine] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showDetailSheetForm, setShowDetailSheetForm] = useState(false);
  const [showShareCustomer, setShowShareCustomer] = useState(false);
  const [sentManufacturerIds, setSentManufacturerIds] = useState<string[]>([]);
  const hasRefetchedForUrlIdRef = useRef<string | null>(null);
  const hasCheckedInitialUrlIdRef = useRef(false);
  const activeRequestIdRef = useRef<string | null>(activeRequestId);
  const activeApiItemIdRef = useRef<number | null>(null);

  useEffect(() => {
    activeRequestIdRef.current = activeRequestId;
  }, [activeRequestId]);

  const { items: apiItems, loading: apiLoading, singleLoading, total, hasMore } = useAppSelector((s) => s.retailerDesigns);
  const { variants: variantHistoryRaw, variantsLoading: variantHistoryLoading, singleVariant } = useAppSelector((s) => s.retailerDesignVariant);
  const { loading: completeLoading } = useAppSelector((s) => s.retailerDesignComplete);
  const { loading: refineLoading } = useAppSelector((s) => s.retailerDesignVariantRefine);
  const { loading: downloadLoading } = useAppSelector((s) => s.retailerDesignDownloadRender);
  // True while the workspace image (base render, refinement, metal colour or angle view) is
  // still generating — reported up from RenderCard. Used to disable Download/Share.
  const [renderBusy, setRenderBusy] = useState(false);
  const generatedImages = useMemo(
    () => ({} as Record<string, string>),
    [apiItems]
  );

  const mapApiToRequest = (it: DesignApiItem): RequestData => {
    const created = it.created_at ? new Date(it.created_at) : null;
    const dateStr = created && !isNaN(created.getTime()) ? created.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) : '';
    const overrideImage =
      generatedImages[it.design_code] || generatedImages[String(it.id)] || null;
    const variantImage = it.variants?.[0]?.base_design_image_url || it.variants?.[0]?.base_image_url || it.variants?.[0]?.image_url || it.variants?.[0]?.image;

    const statusVal = (it.status || '').trim().toUpperCase();
    let finalStatus = normalizeApiStatus(it.status);

    // Derive more advanced status from variants if available
    if (it.variants && it.variants.length > 0) {
      const variantStatuses = it.variants.map((v: any) => (v.status || '').trim().toUpperCase());

      const hasCompleted = variantStatuses.some(s => s === 'COMPLETED' || s === 'MANUFACTURER_APPROVED');
      const hasSentToMfg = variantStatuses.some(s => s === 'SENT_TO_MANUFACTURER' || s === 'QUOTES_REQUESTED' || s === 'QUOTE_RECEIVED');
      const hasApproved = variantStatuses.some(s => s === 'APPROVED');
      const hasShared = variantStatuses.some(s => s === 'SHARED' || s === 'SENT_TO_CUSTOMER');

      if (hasCompleted) {
        finalStatus = 'COMPLETED';
      } else if (hasSentToMfg) {
        finalStatus = 'SENT_TO_MANUFACTURER';
      } else if (hasApproved) {
        finalStatus = 'APPROVED';
      } else if (hasShared && finalStatus !== 'APPROVED' && finalStatus !== 'SENT_TO_MANUFACTURER' && finalStatus !== 'COMPLETED') {
        finalStatus = 'SHARED';
      }
    }

    const designCodeOrId = it.design_code || String(it.id);
    if (typeof window !== 'undefined') {
      try {
        const isFailed = localStorage.getItem(`design_failed_${designCodeOrId}`) === 'true' ||
          localStorage.getItem(`design_failed_${it.id}`) === 'true' ||
          sessionStorage.getItem(`design_failed_${designCodeOrId}`) === 'true' ||
          sessionStorage.getItem(`design_failed_${it.id}`) === 'true';
        if (isFailed && (finalStatus === 'GENERATING' || finalStatus === 'PENDING' || finalStatus === 'PROCESSING')) {
          finalStatus = 'FAILED';
        }

        const isRefinementGenerating = localStorage.getItem(`refinement_generating_${designCodeOrId}`) === 'true' ||
          localStorage.getItem(`refinement_generating_${it.id}`) === 'true' ||
          sessionStorage.getItem(`refinement_generating_${designCodeOrId}`) === 'true' ||
          sessionStorage.getItem(`refinement_generating_${it.id}`) === 'true';
        if (isRefinementGenerating) {
          if (finalStatus !== 'COMPLETED' && finalStatus !== 'FAILED') {
            finalStatus = 'GENERATING';
          }
        }
      } catch (e) { }
    }

    const isGenerating = finalStatus === 'GENERATING' || finalStatus === 'PENDING' || finalStatus === 'PROCESSING';

    const apiImage = isGenerating ? null : (variantImage || overrideImage || it.input_image_url || it.input_image_urls?.[0] || null);
    const cacheBustedImage = apiImage ? getCacheBustedUrl(apiImage, it.updated_at) : null;
    return {
      id: designCodeOrId,
      type: it.jewellery_type || 'Custom',
      status: finalStatus,
      date: dateStr,
      listImage: cacheBustedImage,
      mainImage: cacheBustedImage,
      prompt: it.user_prompt || '',
      angles: [],
      drafts: [],
      customer: { name: it.shared_customer?.customer_name || '—', role: '', email: '', phone: '', location: '', avatar: placeholderImage({ query: 'person avatar', width: 80, height: 80, seq: `cust-${it.id}` }) },
      manufacturer: { name: '—', specialty: '', location: '', delivery: '', verified: false },
      specs: [],
      updatedAt: it.updated_at,
    } as RequestData;
  };

  useEffect(() => {
    return () => {
      cleanupActiveDesignSseConnections();
    };
  }, []);

  useEffect(() => {
    const currentParams = {
      search: debouncedSearch,
      status: requestStatus,
    };
    const hasTabChanged = lastFetchedActiveTabRef.current !== activeTab;
    const paramsChanged = !lastFetchedParamsRef.current ||
      lastFetchedParamsRef.current.search !== currentParams.search ||
      lastFetchedParamsRef.current.status !== currentParams.status;

    if (!hasTabChanged && !paramsChanged) {
      return;
    }

    const statusChanged = lastFetchedParamsRef.current && lastFetchedParamsRef.current.status !== requestStatus;
    if (statusChanged) {
      isStatusChangingRef.current = true;
      setActiveRequestId(null);
      router.replace('/retailer/requests');
    }

    lastFetchedParamsRef.current = currentParams;
    lastFetchedActiveTabRef.current = activeTab;

    const limit = 16;
    setPage(1);
    lastFetchedPageRef.current = 1;
    const selectedDesignId = statusChanged ? undefined : (activeRequestIdRef.current || undefined);
    const promise = dispatch(fetchDesigns({ limit, page: 1, search: debouncedSearch.trim() || undefined, status: requestStatus === 'All' ? undefined : requestStatus, selectedDesignId }));

    promise.finally(() => {
      setIsBootstrapping(false);
    });

    if (statusChanged) {
      const queriedStatus = requestStatus;
      promise.unwrap().then((res) => {
        if (lastFetchedParamsRef.current && lastFetchedParamsRef.current.status !== queriedStatus) {
          return;
        }
        if (lastManualSelectionRef.current) {
          return;
        }

        const items = res.items || [];
        const mapped = items
          .slice()
          .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .map((it: any) => mapApiToRequest(it));

        const finalMapped = queriedStatus === 'All'
          ? mapped
          : mapped.filter((r) => r.status === queriedStatus);

        if (finalMapped.length > 0) {
          const firstId = finalMapped[0].id;
          setActiveRequestId(firstId);
          setActiveTab('Design');
          router.replace(`/retailer/requests?id=${firstId}`);
        } else {
          setActiveRequestId(null);
        }
      }).catch((err) => {
        console.error('Failed to fetch designs on status change', err);
      });
    }

    if (!statusChanged && activeRequestIdRef.current) {
      dispatch(fetchDesignByIdOrCode({ idOrCode: activeRequestIdRef.current }));
      if (activeApiItemIdRef.current) {
        dispatch(fetchVariantsByDesignId({ designId: activeApiItemIdRef.current }));
      }
    }
  }, [dispatch, debouncedSearch, requestStatus, activeTab, router]);

  const handleLoadMore = () => {
    if (apiLoading || apiItems.length >= total) return;
    const nextPage = page + 1;
    if (lastFetchedPageRef.current === nextPage) return;
    lastFetchedPageRef.current = nextPage;
    setPage(nextPage);
    dispatch(fetchDesigns({
      limit: 16,
      page: nextPage,
      search: debouncedSearch.trim() || undefined,
      status: requestStatus === 'All' ? undefined : requestStatus,
      append: true,
      selectedDesignId: activeRequestIdRef.current || undefined,
    }));
  };

  const [localRequests, setLocalRequests] = useState<RequestData[]>([]);
  const [unfilteredApiItems, setUnfilteredApiItems] = useState<any[]>([]);
  const lastStatusRef = useRef(requestStatus);

  useEffect(() => {
    if (!requestSearch.trim() || lastStatusRef.current !== requestStatus) {
      if (!requestSearch.trim()) {
        setUnfilteredApiItems(apiItems);
      }
      lastStatusRef.current = requestStatus;
    }
  }, [apiItems, requestSearch, requestStatus]);

  useEffect(() => {
    const query = requestSearch.trim().toLowerCase();
    let displayItems: any[] = [];

    if (query) {
      const filtered = [...(apiItems || []), ...(unfilteredApiItems || [])].filter((item: any) => {
        const name = (item.name || '').toLowerCase();
        const code = (item.design_code || '').toLowerCase();
        const type = (item.jewellery_type || '').toLowerCase();
        const customer = (item.shared_customer?.customer_name || '').toLowerCase();
        const prompt = (item.user_prompt || '').toLowerCase();
        const matchesVariantId = item.variants?.some((v: any) =>
          String(v.id) === query ||
          String(v.id).includes(query) ||
          (v.variant_name && v.variant_name.toLowerCase().includes(query))
        );
        return name.includes(query) || code.includes(query) || type.includes(query) || customer.includes(query) || prompt.includes(query) || matchesVariantId;
      });

      // Deduplicate by ID
      const seen = new Set();
      displayItems = filtered.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    } else {
      displayItems = [...(apiItems || [])];
    }

    if (displayItems && displayItems.length > 0) {
      const mapped = displayItems
        .slice()
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .map((it: any) => mapApiToRequest(it));

      const finalMapped = requestStatus === 'All'
        ? mapped
        : mapped.filter((r) => r.status === requestStatus);

      setLocalRequests(finalMapped);
    } else {
      setLocalRequests([]);
    }
  }, [apiItems, unfilteredApiItems, requestSearch, requestStatus]);

  useEffect(() => {
    if (apiItems.length > 0) {
      setIsBootstrapping(false);
    }
  }, [apiItems.length]);

  // Fetch single design details if a design ID from the URL is not found in the local cached list
  // GUARD: Only fetch ONCE per URL id to prevent infinite loop (apiItems changing re-triggers this effect)
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (!idFromUrl || apiLoading || isBootstrapping) return;

    // If we already attempted a fetch for this exact URL id, stop — avoids infinite loop
    if (hasRefetchedForUrlIdRef.current === idFromUrl) return;

    const exists = apiItems.some((it) =>
      String(it.id) === idFromUrl ||
      (it.design_code && idFromUrl && it.design_code.toLowerCase() === idFromUrl.toLowerCase())
    );
    if (!exists) {
      console.log('[API Debug] URL Design ID not found in cache, fetching single design details:', idFromUrl);
      hasRefetchedForUrlIdRef.current = idFromUrl; // mark BEFORE dispatch so the next render doesn't re-enter
      dispatch(fetchDesignByIdOrCode({ idOrCode: idFromUrl }));
    }
  }, [searchParams, apiItems, apiLoading, isBootstrapping, dispatch]);



  const lastSyncedIdRef = useRef<string | null>(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null
  );
  const lastManualSelectionRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const isStatusChangingRef = useRef(false);

  // Sync URL id -> activeRequestId, and default to first API item when none provided
  useEffect(() => {
    const idFromUrl = searchParams.get('id');

    if (isStatusChangingRef.current) {
      if (idFromUrl === activeRequestId) {
        isStatusChangingRef.current = false;
      }
      return;
    }

    // If the user made a manual selection, and the URL has not caught up yet, do NOT sync!
    if (lastManualSelectionRef.current && idFromUrl !== lastManualSelectionRef.current) {
      return;
    }

    // If the URL has caught up to the manual selection, clear it
    if (lastManualSelectionRef.current && idFromUrl === lastManualSelectionRef.current) {
      lastManualSelectionRef.current = null;
    }

    // Scenario 1: The ID in the URL is present, and we need to sync/select it
    if (idFromUrl) {
      const matchedApiItem = apiItems.find((it) => String(it.id) === idFromUrl || it.design_code === idFromUrl);
      const targetId = matchedApiItem ? (matchedApiItem.design_code || String(matchedApiItem.id)) : idFromUrl;

      if (activeRequestId !== targetId) {
        setActiveRequestId(targetId);
        setSelectedVariantIdOverride(null);
        isInitializedRef.current = true;
        lastSyncedIdRef.current = idFromUrl;
        return;
      }
    }

    // Scenario 2: No ID in URL, and we haven't initialized the active selection yet
    if (!idFromUrl && localRequests.length > 0 && !isInitializedRef.current) {
      setActiveRequestId(localRequests[0].id);
      setSelectedVariantIdOverride(null);
      isInitializedRef.current = true;
      lastSyncedIdRef.current = localRequests[0].id;
    }
  }, [searchParams, localRequests, activeRequestId, apiItems]);

  const activeApiItem = useMemo(() => {
    if (!activeRequestId) return null;
    const reqIdLower = String(activeRequestId).toLowerCase();
    return apiItems.find((it) =>
      (it.design_code && it.design_code.toLowerCase() === reqIdLower) ||
      String(it.id) === reqIdLower
    ) ?? null;
  }, [apiItems, activeRequestId]);

  const activeDesignId = useMemo(() => {
    return activeApiItem?.id ?? null;
  }, [activeApiItem]);

  useEffect(() => {
    activeApiItemIdRef.current = activeApiItem?.id ?? null;
  }, [activeApiItem?.id]);

  useEffect(() => {
    if (refreshTick > 0) {
      hasRefetchedForUrlIdRef.current = null;
      const currentLimit = page * 16;
      dispatch(fetchDesigns({ limit: currentLimit, page: 1, search: debouncedSearch.trim() || undefined, status: requestStatus === 'All' ? undefined : requestStatus, selectedDesignId: activeRequestIdRef.current || undefined }));
      if (activeRequestIdRef.current) {
        dispatch(fetchDesignByIdOrCode({ idOrCode: activeRequestIdRef.current }));
        if (activeDesignId) {
          dispatch(fetchVariantsByDesignId({ designId: activeDesignId }));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  // Variants from Redux can briefly belong to the PREVIOUSLY selected design during a
  // switch. Expose them to the UI only once they match the active design, so stale
  // drafts/images/prompt from the prior request can never render.
  const variantHistory = useMemo(() => {
    if (variantHistoryRaw && variantHistoryRaw.length > 0 && activeDesignId && String(variantHistoryRaw[0]?.design_id) === String(activeDesignId)) {
      return variantHistoryRaw;
    }
    if (activeApiItem?.variants && activeApiItem.variants.length > 0 && activeDesignId && String(activeApiItem.id) === String(activeDesignId)) {
      return activeApiItem.variants;
    }
    return [] as any[];
  }, [variantHistoryRaw, activeDesignId, activeApiItem]);

  const hasVariantsLoaded = useMemo(() => {
    return Boolean(variantHistory && variantHistory.length > 0);
  }, [variantHistory]);

  const activeVariantId = useMemo(() => {
    if (selectedVariantIdOverride) {
      console.log('[API Debug] activeVariantId resolved from override:', selectedVariantIdOverride);
      return selectedVariantIdOverride;
    }

    const query = debouncedSearch.trim();
    if (query && !isNaN(Number(query))) {
      const numericQuery = Number(query);
      if ((variantHistory ?? []).some((v: any) => String(v.id) === query)) {
        console.log('[API Debug] activeVariantId resolved from search query:', numericQuery);
        return numericQuery;
      }
    }

    // Check if there is a refinement variant ID stored in localStorage or sessionStorage to restore on refresh/load
    if (typeof window !== 'undefined' && activeDesignId) {
      try {
        const storedVariantId = localStorage.getItem(`refinement_variant_id_${activeDesignId}`) ||
          sessionStorage.getItem(`refinement_variant_id_${activeDesignId}`);
        if (storedVariantId) {
          const numId = Number(storedVariantId);
          if (!isNaN(numId) && (variantHistory ?? []).some((v: any) => String(v.id) === String(numId))) {
            console.log('[API Debug] activeVariantId resolved from stored refinement variant ID:', numId);
            return numId;
          }
        }
      } catch (e) { }
    }
    // Prioritize any generating variant in the history list (usually the latest one at index 0)
    const generatingVariant = (variantHistory ?? []).find((v: any) => {
      const statusVal = (v.status || '').trim().toUpperCase();
      return statusVal === 'GENERATING' || statusVal === 'PENDING' || statusVal === 'PROCESSING';
    });
    if (generatingVariant) {
      console.log('[API Debug] activeVariantId selected generating variant:', generatingVariant.id);
      return generatingVariant.id;
    }
    // Next, check if there is a variant that has already been shared, approved, completed, or sent to manufacturer
    const sortedVariantsNewestFirst = [...(variantHistory ?? [])].sort((a: any, b: any) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.id || 0) - Number(a.id || 0);
    });
    const sharedOrApprovedVariant = sortedVariantsNewestFirst.find((v: any) => {
      const s = (v.status || '').trim().toUpperCase();
      return s === 'SHARED' || s === 'APPROVED' || s === 'COMPLETED' || s === 'SENT_TO_MANUFACTURER' || s === 'SENT_TO_CUSTOMER';
    });
    if (sharedOrApprovedVariant) {
      console.log('[API Debug] activeVariantId resolved from shared/approved status:', sharedOrApprovedVariant.id);
      return sharedOrApprovedVariant.id;
    }
    // Default to the newest variant chronologically
    const newestVariant = (variantHistory && variantHistory.length > 0)
      ? [...variantHistory].sort((a: any, b: any) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return Number(b.id || 0) - Number(a.id || 0);
      })[0]
      : null;
    console.log('[API Debug] variantHistory is:', variantHistory, 'Selected newest variant is:', newestVariant);
    const resultId = newestVariant?.id ?? null;
    console.log('[API Debug] activeVariantId computed to:', resultId);
    return resultId;
  }, [variantHistory, selectedVariantIdOverride, activeDesignId, debouncedSearch]);

  useEffect(() => {
    // Clear the previous request's variant data on EVERY switch (deep-link, list tap, or
    // right after generating a NEW render) so the workspace never shows the prior design's
    // image in place of the generating loader. Mirrors handleSelectRequest's reset.
    dispatch(resetVariantsState());
    dispatch(resetSingleVariantState());
    setActiveMetal('yellow');
    setSelectedVariantIdOverride(null);
    setActiveAngleId(null);
  }, [activeRequestId]);

  useEffect(() => {
    setActiveAngleId(null);
  }, [activeVariantId, activeMetal]);

  // Backfill missing images using variantHistory so that the list always shows an image 
  // even if the user closed the window before the original SSE generation event arrived.
  useEffect(() => {
    if (!activeApiItem?.id || !variantHistory || variantHistory.length === 0) return;
    const selectedVariant = variantHistory?.[0] ?? null;

    // Safety Guard: Only proceed if variantHistory belongs to the currently active design!
    if (selectedVariant && String(selectedVariant.design_id) !== String(activeApiItem.id)) {
      return;
    }

    const image = selectedVariant?.base_design_image_url || selectedVariant?.image_url || selectedVariant?.url || selectedVariant?.mainImage || selectedVariant?.image || selectedVariant?.base_design_image_url;

    if (image) {
      const designCode = activeApiItem.design_code;
      const designIdStr = String(activeApiItem.id);

      setLocalRequests(prev => {
        let changed = false;
        const next = prev.map(req => {
          if (req.id === designIdStr || req.id === designCode) {
            if (req.listImage !== image) {
              changed = true;
              return {
                ...req,
                listImage: image,
                mainImage: image,
              };
            }
          }
          return req;
        });
        return changed ? next : prev;
      });
    }
  }, [variantHistory, activeApiItem]);

  const activeVariantAngles = useMemo(() => {
    const selectedVariant = (variantHistory ?? []).find((variant: any) => String(variant.id) === String(activeVariantId)) ?? variantHistory?.[0] ?? null;
    let parsedAnglesJson: any = null;
    try {
      if (selectedVariant?.angles_json) {
        if (typeof selectedVariant.angles_json === 'string') {
          parsedAnglesJson = JSON.parse(selectedVariant.angles_json);
        } else {
          parsedAnglesJson = selectedVariant.angles_json;
        }
      }
    } catch (e) {
      console.error('Error parsing angles_json in page.tsx:', e);
    }

    const metalMap: Record<string, string> = {
      yellow: 'gold',
      white: 'silver',
      rosegold: 'rose_gold',
    };
    const activeMetalPayload = metalMap[activeMetal] || 'gold';
    const metalAngles = parsedAnglesJson?.[activeMetalPayload] ?? null;
    if (!metalAngles) return [];

    return [
      { id: 'side', label: 'Side View', image: metalAngles.side_view || metalAngles.side || '' },
      { id: 'top', label: 'Top View', image: metalAngles.top_view || metalAngles.top || '' },
      { id: 'three-quarter', label: 'Three Quarter View', image: metalAngles.three_quarter_view || metalAngles.three_quarter || '' },
      { id: 'back', label: 'Back View', image: metalAngles.back_view || metalAngles.back || '' },
      { id: 'worn', label: 'Worn View', image: metalAngles.worn_view || metalAngles.worn || '' },
    ].filter(a => a.image && typeof a.image === 'string' && a.image.length > 0);
  }, [variantHistory, activeVariantId, activeMetal]);



  useEffect(() => {
    // Wipe out variants from the previous request immediately on switch to prevent image mismatch blinking!
    dispatch(resetVariantsState());
    dispatch(resetSingleVariantState());
    if (activeApiItem?.id) {
      console.log('[API Debug] Dispatching variants list API for design:', activeApiItem.id);
      dispatch(fetchVariantsByDesignId({ designId: activeApiItem.id }));
    }
  }, [dispatch, activeApiItem?.id]);



  const activeRequest = useMemo(() => {
    if (activeApiItem) {
      return mapApiToRequest(activeApiItem);
    }
    if (!activeRequestId) return localRequests[0] ?? ({} as RequestData);
    const reqIdLower = String(activeRequestId).toLowerCase();
    return localRequests.find((r) => r.id && String(r.id).toLowerCase() === reqIdLower) ?? ({} as RequestData);
  }, [localRequests, activeRequestId, activeApiItem]);
  const isCompleted = useMemo(() => {
    if (!activeRequest?.status) return false;
    const s = activeRequest.status.trim().toUpperCase();
    return s !== 'GENERATED' && s !== 'REFINEMENT_REQUESTED';
  }, [activeRequest?.status]);

  const isGenerating = useMemo(() => {
    let storedRefinementGenerating = false;
    let storedRefinementVariantId: number | null = null;
    if (typeof window !== 'undefined') {
      try {
        const designCodeOrId = activeRequest?.id || '';
        storedRefinementGenerating =
          (activeDesignId ? localStorage.getItem(`refinement_generating_${activeDesignId}`) === 'true' : false) ||
          (activeDesignId ? sessionStorage.getItem(`refinement_generating_${activeDesignId}`) === 'true' : false) ||
          (designCodeOrId ? localStorage.getItem(`refinement_generating_${designCodeOrId}`) === 'true' : false) ||
          (designCodeOrId ? sessionStorage.getItem(`refinement_generating_${designCodeOrId}`) === 'true' : false);

        const storedId =
          (activeDesignId ? (localStorage.getItem(`refinement_variant_id_${activeDesignId}`) || sessionStorage.getItem(`refinement_variant_id_${activeDesignId}`)) : null) ||
          (designCodeOrId ? (localStorage.getItem(`refinement_variant_id_${designCodeOrId}`) || sessionStorage.getItem(`refinement_variant_id_${designCodeOrId}`)) : null);
        if (storedId) storedRefinementVariantId = Number(storedId);
      } catch (e) { }
    }

    const reqStatus = (activeRequest?.status || '').trim().toUpperCase();
    const isRequestGenerating = reqStatus === 'GENERATING' || reqStatus === 'PENDING' || reqStatus === 'PROCESSING';

    if (storedRefinementGenerating) {
      const isCurrentlyActiveRefinement = !activeVariantId || !storedRefinementVariantId || String(activeVariantId) === String(storedRefinementVariantId);
      if (isCurrentlyActiveRefinement) {
        const hasSelectedVariantInHistory = activeVariantId ? (variantHistory ?? []).some((v: any) => String(v.id) === String(activeVariantId)) : false;
        const selectedVariant = hasSelectedVariantInHistory
          ? (variantHistory ?? []).find((v: any) => String(v.id) === String(activeVariantId))
          : null;
        if (selectedVariant) {
          const hasImage = Boolean(
            selectedVariant.base_design_image_url ||
            selectedVariant.base_image_url ||
            selectedVariant.image_url ||
            selectedVariant.url ||
            selectedVariant.mainImage ||
            selectedVariant.image
          );
          if (hasImage) return false;
        }
        return true;
      }
    }

    const hasSelectedVariantInHistory = activeVariantId ? (variantHistory ?? []).some((v: any) => String(v.id) === String(activeVariantId)) : false;
    const selectedVariant = hasSelectedVariantInHistory
      ? (variantHistory ?? []).find((v: any) => String(v.id) === String(activeVariantId))
      : (activeVariantId ? null : (variantHistory?.[0] ?? null));

    if (selectedVariant) {
      const vStatus = (selectedVariant.status || '').trim().toUpperCase();
      const isVariantGenerating = vStatus === 'GENERATING' || vStatus === 'PENDING' || vStatus === 'PROCESSING';

      const hasImage = Boolean(
        selectedVariant.base_design_image_url ||
        selectedVariant.base_image_url ||
        selectedVariant.image_url ||
        selectedVariant.url ||
        selectedVariant.mainImage ||
        selectedVariant.image
      );

      if (isVariantGenerating && !hasImage) return true;

      const isLatestVariant = variantHistory && variantHistory.length > 0 && String(selectedVariant.id) === String(variantHistory[0].id);
      if (isRequestGenerating && isLatestVariant && !hasImage) {
        return true;
      }
      return false;
    }
    return isRequestGenerating;
  }, [activeRequest?.status, variantHistory, activeVariantId, activeDesignId, activeRequest?.id]);

  useEffect(() => {
    if (activeVariantId && lastFetchedVariantIdRef.current !== activeVariantId) {
      console.log('[API Debug] Dispatching single variant detail API for ID:', activeVariantId);
      lastFetchedVariantIdRef.current = activeVariantId;
      dispatch(fetchVariantById({ variantId: activeVariantId }));
    }
  }, [dispatch, activeVariantId]);

  const displayPrompt = useMemo(() => {
    if (isGenerating) {
      const parentVariant = variantHistory?.[1];
      return parentVariant?.prompt_used || activeApiItem?.user_prompt || activeRequest.prompt;
    }
    const selectedVariant = (variantHistory ?? []).find((v: any) => String(v.id) === String(activeVariantId)) ?? variantHistory?.[0] ?? null;
    return selectedVariant?.prompt_used || activeRequest.prompt;
  }, [isGenerating, variantHistory, activeVariantId, activeApiItem?.user_prompt, activeRequest.prompt]);

  const activeDrafts = useMemo(() => {
    let storedRefinementGenerating = false;
    let storedRefinementVariantId: number | null = null;
    if (typeof window !== 'undefined' && activeDesignId) {
      try {
        storedRefinementGenerating = localStorage.getItem(`refinement_generating_${activeDesignId}`) === 'true' ||
          sessionStorage.getItem(`refinement_generating_${activeDesignId}`) === 'true';
        const storedId = localStorage.getItem(`refinement_variant_id_${activeDesignId}`) ||
          sessionStorage.getItem(`refinement_variant_id_${activeDesignId}`);
        if (storedId) storedRefinementVariantId = Number(storedId);
      } catch (e) { }
    }

    // Sort variants oldest first chronologically for the Draft History slider
    const sortedVariants = [...(variantHistory ?? [])].sort((a: any, b: any) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return Number(a.id || 0) - Number(b.id || 0);
    });

    const apiDrafts = sortedVariants.map((variant: any, index: number) => {
      const goldImage = variant.base_design_image_url || variant.base_image_url || variant.image_url || variant.image || '';
      let displayDraftImage = goldImage;

      const isCurrent = activeVariantId !== null && String(variant.id) === String(activeVariantId);

      if (isCurrent) {
        const activeMetalPayload = activeMetal === 'white' ? 'silver' : (activeMetal === 'rosegold' ? 'rose_gold' : 'gold');
        let parsedMetals: any = null;
        try {
          if (variant.metal_variations_json) {
            if (typeof variant.metal_variations_json === 'string') {
              parsedMetals = JSON.parse(variant.metal_variations_json);
            } else {
              parsedMetals = variant.metal_variations_json;
            }
          }
        } catch (e) { }

        const metalImg = getMetalImage(parsedMetals, activeMetalPayload);

        if (metalImg) {
          displayDraftImage = metalImg;
        }
      }

      const vStatus = (variant.status || '').trim().toUpperCase();
      const isVariantGenerating = vStatus === 'GENERATING' || vStatus === 'PENDING' || vStatus === 'PROCESSING';
      const isStoredRefinement = !!(storedRefinementGenerating && storedRefinementVariantId && String(variant.id) === String(storedRefinementVariantId));
      const isDraftGenerating = isVariantGenerating || isStoredRefinement;

      const variantUpdatedAt = variant.updated_at || variant.created_at;

      return {
        version: variant.variant_name || `V${variant.version_number ?? index + 1}`,
        label: variant.variant_name ? `Variant ${variant.variant_name}` : `Variant ${index + 1}`,
        image: getCacheBustedUrl(displayDraftImage, variantUpdatedAt),
        base_design_image_url: getCacheBustedUrl(goldImage, variantUpdatedAt),
        variantId: variant.id,
        isGenerating: isDraftGenerating,
        timestamp: formatApiDate(variant.created_at),
        isCurrent,
      };
    });

    const reqStatus = (activeRequest?.status || '').trim().toUpperCase();
    const isRequestGenerating = reqStatus === 'GENERATING' || reqStatus === 'PENDING' || reqStatus === 'PROCESSING';

    if (apiDrafts.length === 0 && isRequestGenerating) {
      apiDrafts.push({
        version: 'v0',
        label: 'Variant v0',
        image: '',
        base_design_image_url: '',
        variantId: undefined,
        isGenerating: true,
        timestamp: formatApiDate(
          new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(new Date()).replace(' ', 'T')
        ),
        isCurrent: true,
      });
    }

    const isRefinementInFlight = refineLoading || (isRequestGenerating && apiDrafts.length > 0 && !apiDrafts.some((d: any) => d.isGenerating));
    if (isRefinementInFlight) {
      const nextVersionNumber = apiDrafts.length + 1;
      apiDrafts.push({
        version: `V${nextVersionNumber}`,
        label: `Variant ${nextVersionNumber}`,
        image: '',
        base_design_image_url: '',
        variantId: undefined,
        isGenerating: true,
        timestamp: formatApiDate(
          new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(new Date()).replace(' ', 'T')
        ),
        isCurrent: false,
      });
    }

    return apiDrafts;
  }, [variantHistory, selectedVariantIdOverride, activeMetal, activeRequest.status, activeDesignId, refineLoading, activeVariantId, activeRequest?.status]);

  const hasActiveRequest = Boolean(activeRequestId || searchParams.get('id') || activeRequest?.id);

  if (isBootstrapping && localRequests.length === 0) {
    return (
      <div className="min-h-screen bg-surface-page">
        <TopBar />
        <div className="max-w-[1350px] mx-auto px-3 sm:px-4 md:px-6 pb-5 sm:pb-6 lg:pb-8 pt-3 sm:pt-4 lg:pt-5">
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* Left Panel Skeleton */}
            <div className="rounded-sheet p-4 bg-white dark:bg-surface-100 border border-transparent dark:border-border-default shadow-card h-[calc(100dvh-104px)] lg:h-[calc(100vh-120px)] flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] dark:border-border-default">
                <div className="h-5 w-24 bg-gray-200 dark:bg-[#2C3545] rounded-[6px] animate-pulse" />
                <div className="h-5 w-5 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
              </div>
              <div className="h-9 w-full bg-[#F3F4F6] dark:bg-[#1E2530] rounded-[10px] animate-pulse" />
              <div className="flex gap-2 pb-2 overflow-x-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 w-14 bg-gray-200 dark:bg-[#2C3545] rounded-full flex-shrink-0 animate-pulse" />
                ))}
              </div>
              <div className="flex flex-col gap-3 overflow-hidden flex-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-[14px] bg-[#FAFAF8] dark:bg-[#1A1F28] border border-transparent">
                    <div className="w-10 h-10 rounded-[10px] bg-gray-200 dark:bg-[#2C3545] flex-shrink-0 animate-pulse" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-3 w-16 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                      <div className="h-2.5 w-12 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                      <div className="flex justify-between items-center mt-1">
                        <div className="h-4 w-10 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
                        <div className="h-2 w-8 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel Skeleton */}
            <div className="rounded-sheet p-5 bg-white dark:bg-surface-100 border border-transparent dark:border-border-default shadow-card h-[calc(100dvh-104px)] lg:h-[calc(100vh-120px)] flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] dark:border-border-default">
                <div className="flex flex-col gap-2">
                  <div className="h-5 w-28 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                  <div className="h-3.5 w-36 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                </div>
                <div className="h-8 w-32 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
              </div>
              <div className="flex gap-4 pb-2 border-b border-[#F3F4F6] dark:border-border-default">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-6 w-16 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                ))}
              </div>
              <div className="flex-1 flex gap-5 overflow-hidden">
                <div className="flex-1 flex flex-col gap-4">
                  {/* Large main image card */}
                  <div className="flex-1 rounded-[18px] bg-gray-200 dark:bg-[#1E2530] animate-pulse border border-black/[0.04]" />
                  {/* Action Bar */}
                  <div className="flex gap-3 justify-center py-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-9 w-24 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
                    ))}
                  </div>
                  {/* Prompt Box Section */}
                  <div className="p-4 rounded-[18px] bg-[#FAFAF8] dark:bg-[#1A1F28] border border-black/[0.04] flex flex-col gap-2">
                    <div className="h-3 w-36 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                    <div className="h-2.5 w-full bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                    <div className="h-2.5 w-3/4 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                  </div>
                </div>
                {/* Right angle tiles column */}
                <div className="w-[136px] flex flex-col gap-3 flex-shrink-0 max-sm:hidden">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex-1 rounded-[14px] bg-gray-200 dark:bg-[#1E2530] animate-pulse border border-black/[0.04]" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }



  const handleSelectRequest = (id: string) => {
    lastManualSelectionRef.current = id;
    if (id === activeRequestId) {
      // Silence refresh the current active design and variant details in the background
      dispatch(fetchDesignByIdOrCode({ idOrCode: id })).then((resAction) => {
        if (fetchDesignByIdOrCode.fulfilled.match(resAction)) {
          const design = resAction.payload;
          if (design?.id) {
            dispatch(fetchVariantsByDesignId({ designId: design.id })).then((variantsAction) => {
              if (fetchVariantsByDesignId.fulfilled.match(variantsAction)) {
                if (activeVariantId) {
                  dispatch(fetchVariantById({ variantId: activeVariantId }));
                }
              }
            });
          }
        }
      });
      setMobileView('workspace');
    } else {
      // Clear the previous request's variant data synchronously so the workspace
      // never renders the prior design's image/drafts during the switch.
      dispatch(resetVariantsState());
      dispatch(resetSingleVariantState());
      setActiveRequestId(id);
      setSelectedVariantIdOverride(null);
      setActiveTab('Design');
      setMobileView('workspace');
      router.replace(`/retailer/requests?id=${id}`);
    }
  };

  const handleRefineSubmit = (prompt: string, newVariantId?: string | number) => {
    if (newVariantId) {
      setSelectedVariantIdOverride(newVariantId);
    }
    if (typeof window !== 'undefined' && activeRequest.id) {
      try {
        localStorage.removeItem(`design_failed_${activeRequest.id}`);
        sessionStorage.removeItem(`design_failed_${activeRequest.id}`);
        if (activeDesignId) {
          localStorage.removeItem(`design_failed_${activeDesignId}`);
          sessionStorage.removeItem(`design_failed_${activeDesignId}`);
        }
      } catch (e) { }
    }
    setLocalRequests((prev) =>
      prev.map((r) =>
        r.id === activeRequest.id
          ? {
            ...r,
            status: 'GENERATING',
            prompt,
          }
          : r
      )
    );
  };

  const handleSwitchVersion = (version: string) => {
    const matched = (variantHistory ?? []).find(
      (v: any, index: number) => v.variant_name === version || `V${v.version_number ?? index + 1}` === version
    );

    if (matched?.id) {
      setSelectedVariantIdOverride(matched.id);
    }

    setLocalRequests((prev) => prev.map((r) => (r.id === activeRequest.id ? { ...r, drafts: (r.drafts || []).map((d) => ({ ...d, isCurrent: d.version === version })) } : r)));
  };

  const handleRenderingComplete = (completedDesignId?: string) => {
    const targetId = completedDesignId || activeRequest.id;
    const match = apiItems.find((it) =>
      String(it.id) === String(targetId) ||
      (it.design_code && targetId && it.design_code.toLowerCase() === targetId.toLowerCase())
    );
    const resolvedCode = match?.design_code || targetId;
    const resolvedId = match ? String(match.id) : targetId;

    setLocalRequests((prev) =>
      prev.map((r) =>
        r.id === resolvedCode || String(r.id) === resolvedId ? { ...r, status: 'GENERATED' } : r
      )
    );
    setRefreshTick((t) => t + 1);

    const designIdToFetch = match?.id ? String(match.id) : targetId;
    if (designIdToFetch && String(designIdToFetch) === String(activeDesignId)) {
      dispatch(fetchVariantsByDesignId({ designId: designIdToFetch }));
    }
  };

  const handleRenderingFailed = (errorMsg?: string, completedDesignId?: string) => {
    const targetId = completedDesignId || activeRequest.id;
    const match = apiItems.find((it) =>
      String(it.id) === String(targetId) ||
      (it.design_code && targetId && it.design_code.toLowerCase() === targetId.toLowerCase())
    );
    const resolvedCode = match?.design_code || targetId;
    const resolvedId = match ? String(match.id) : targetId;

    if (typeof window !== 'undefined') {
      try {
        if (resolvedCode) {
          localStorage.setItem(`design_failed_${resolvedCode}`, 'true');
          sessionStorage.setItem(`design_failed_${resolvedCode}`, 'true');
        }
        if (resolvedId) {
          localStorage.setItem(`design_failed_${resolvedId}`, 'true');
          sessionStorage.setItem(`design_failed_${resolvedId}`, 'true');
        }
      } catch (e) { }
    }
    setLocalRequests((prev) =>
      prev.map((r) =>
        r.id === resolvedCode || String(r.id) === resolvedId ? { ...r, status: 'FAILED' } : r
      )
    );
    setRefreshTick((t) => t + 1);
  };

  const handleAnglesLoaded = (angles: RequestData['angles']) => {
    if (!activeRequest?.id) return;
    setLocalRequests((prev) =>
      prev.map((r) => (r.id === activeRequest.id ? { ...r, angles } : r))
    );
  };

  const handleMarkComplete = async () => {
    const designId = activeApiItem?.id;
    if (!designId) {
      toast.error('Missing design id for completion.');
      return;
    }

    const resultAction = await dispatch(completeDesign({ designId }));
    if (completeDesign.fulfilled.match(resultAction)) {
      setLocalRequests((prev) =>
        prev.map((r) => (r.id === activeRequest.id ? { ...r, status: 'COMPLETED' } : r))
      );
      setRefreshTick((t) => t + 1);
      // Re-fetch variants so workspace reflects the updated state
      dispatch(resetVariantsState());
      dispatch(resetSingleVariantState());
      lastFetchedVariantIdRef.current = null;
      try {
        const freshVariants = await dispatch(fetchVariantsByDesignId({ designId })).unwrap();
        const newestVariant = freshVariants.length > 0
          ? [...freshVariants].sort((a: any, b: any) => {
            const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return tB - tA;
          })[0]
          : null;
        if (newestVariant?.id) {
          lastFetchedVariantIdRef.current = newestVariant.id;
          dispatch(fetchVariantById({ variantId: newestVariant.id }));
        }
      } catch (e) {
        console.log('[API Debug] fetchVariantsByDesignId failed inside handleMarkComplete (probably 0 variants left):', e);
      }
    } else {
      const errorMsg = resultAction.payload || 'Failed to mark design complete.';
      toast.error(`${errorMsg}`);
    }
  };

  const handleArchiveRequest = () => {
    setArchiveConfirm({ type: 'request' });
  };

  const executeArchiveRequest = async () => {
    if (!activeRequest || !activeRequest.id) return;
    const designId = activeApiItem?.id;
    if (!designId) {
      toast.error('Design id missing. Unable to archive this request.');
      setArchiveConfirm(null);
      return;
    }
    const resultAction = await dispatch(archiveDesign({ designId }));
    if (!archiveDesign.fulfilled.match(resultAction)) {
      const errorMsg = resultAction.payload || 'Failed to archive design.';
      toast.error(String(errorMsg));
      setArchiveConfirm(null);
      return;
    }
    setPage(1);
    dispatch(fetchDesigns({
      limit: 16,
      page: 1,
      search: debouncedSearch.trim() || undefined,
      status: requestStatus === 'All' ? undefined : requestStatus,
      selectedDesignId: activeRequestIdRef.current || undefined,
    }));
    const entry: ArchivedRequest = {
      id: activeRequest.id,
      type: activeRequest.type,
      customer: activeRequest.customer?.name || '',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      reason: 'Manually archived',
    };
    const existing = getJSON<ArchivedRequest[]>(STORAGE_KEYS.ARCHIVED_REQUESTS, []);
    if (!existing.find((r) => r.id === entry.id)) {
      setJSON(STORAGE_KEYS.ARCHIVED_REQUESTS, [entry, ...existing]);
    }
    setLocalRequests((prev) => prev.map((r) => (r.id === activeRequest.id ? { ...r, status: 'COMPLETED' } : r)));
    setRefreshTick((t) => t + 1);
    toast.success('Design archived successfully.');
    setArchiveConfirm(null);
    // Re-fetch variants list + single variant detail after archive
    dispatch(resetVariantsState());
    dispatch(resetSingleVariantState());
    lastFetchedVariantIdRef.current = null;
    try {
      const freshVariants = await dispatch(fetchVariantsByDesignId({ designId })).unwrap();
      const newestVariant = freshVariants.length > 0
        ? [...freshVariants].sort((a: any, b: any) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tB - tA;
        })[0]
        : null;
      if (newestVariant?.id) {
        lastFetchedVariantIdRef.current = newestVariant.id;
        dispatch(fetchVariantById({ variantId: newestVariant.id }));
      }
    } catch (e) {
      console.log('[API Debug] fetchVariantsByDesignId failed inside executeArchiveRequest:', e);
    }
  };

  const handleArchiveVersion = (draft: Draft) => {
    if (!draft || !activeRequest) return;
    const entry: ArchivedVersion = {
      id: `${activeRequest.id}-${draft.version}`,
      label: `${activeRequest.type} ${draft.version}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      image: draft.image,
    };
    const existing = getJSON<ArchivedVersion[]>(STORAGE_KEYS.ARCHIVED_VERSIONS, []);
    if (!existing.find((v) => v.id === entry.id)) {
      setJSON(STORAGE_KEYS.ARCHIVED_VERSIONS, [entry, ...existing]);
    }
    setRefreshTick((t) => t + 1);
  };

  const handleDeleteVersion = async (draft: Draft) => {
    if (!activeDesignId) {
      toast.error('Missing design id for refresh.');
      return;
    }
    try {
      dispatch(resetVariantsState());
      dispatch(resetSingleVariantState());
      lastFetchedVariantIdRef.current = null;
      setSelectedVariantIdOverride(null);
      setRefreshTick((t) => t + 1);

      // Fetch fresh variants list using unwrap
      let freshVariants: any[] = [];
      try {
        freshVariants = await dispatch(fetchVariantsByDesignId({ designId: activeDesignId })).unwrap();
      } catch (e) {
        console.log('[API Debug] fetchVariantsByDesignId failed inside handleDeleteVersion (probably 0 variants left):', e);
      }
      toast.success('Version deleted');

      const newestVariant = freshVariants.length > 0
        ? [...freshVariants].sort((a: any, b: any) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tB - tA;
        })[0]
        : null;

      if (newestVariant?.id) {
        lastFetchedVariantIdRef.current = newestVariant.id;
        setSelectedVariantIdOverride(newestVariant.id);
        dispatch(fetchVariantById({ variantId: newestVariant.id }));
      }
    } catch (err) {
      console.error('[Requests Page] refresh variants after delete failed', err);
      toast.error('Failed to refresh variants.');
    }
  };

  const handleRequestRemoved = async (removedId: string) => {
    // 1. Find next remaining request in list
    const remaining = localRequests.filter(r => r.id !== removedId);
    const nextRequest = remaining[0] ?? null;

    if (nextRequest) {
      // Switch selection to next request
      handleSelectRequest(nextRequest.id);

      const match = apiItems.find((it) => it.design_code === nextRequest.id || String(it.id) === nextRequest.id);
      const nextDesignId = match?.id;

      if (nextDesignId) {
        // Reset states to prevent stales/loaders sticking
        dispatch(resetVariantsState());
        dispatch(resetSingleVariantState());
        lastFetchedVariantIdRef.current = null;

        // Fetch variants list
        try {
          const freshVariants = await dispatch(fetchVariantsByDesignId({ designId: nextDesignId })).unwrap();
          if (freshVariants.length > 0) {
            const newestVariant = [...freshVariants].sort((a: any, b: any) => {
              const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return tB - tA;
            })[0];
            if (newestVariant?.id) {
              lastFetchedVariantIdRef.current = newestVariant.id;
              dispatch(fetchVariantById({ variantId: newestVariant.id }));
            }
          }
        } catch (e) {
          console.log('[API Debug] fetchVariantsByDesignId failed inside handleRequestRemoved (probably 0 variants left):', e);
        }
      }
    } else {
      // List is empty now
      setActiveRequestId(null);
      setSelectedVariantIdOverride(null);
      dispatch(resetVariantsState());
      dispatch(resetSingleVariantState());
      lastFetchedVariantIdRef.current = null;
      router.replace('/retailer/requests');
    }
  };

  return (
    <div className="min-h-screen bg-surface-page">
      <TopBar />

      {showDetailSheet && (
        <DetailSheetModal request={activeRequest} onClose={() => setShowDetailSheet(false)} />
      )}

      {showDetailSheetForm && (
        <DetailSheetForm
          request={{ ...activeRequest, prompt: displayPrompt }}
          variantId={activeVariantId}
          activeMetal={activeMetal}
          onClose={() => setShowDetailSheetForm(false)}
          onSubmit={(data, manufacturerIds) => {
            setShowDetailSheetForm(false);
            setSentManufacturerIds(manufacturerIds);
            const selectedMfg = MANUFACTURERS.find((m) => m.id === manufacturerIds[0]);
            setLocalRequests((prev) => prev.map((r) => (r.id === activeRequest.id ? { ...r, status: 'SENT_TO_MANUFACTURER', manufacturer: { ...r.manufacturer, name: selectedMfg?.name || r.manufacturer?.name || 'Selected Manufacturer' } } : r)));
            setRefreshTick((t) => t + 1);
            if (activeVariantId) {
              dispatch(fetchDesignVariantManufacturerShares({ variantId: activeVariantId, forceRefresh: true }));
            }
          }}
          onSaveDraft={() => { /* no-op */ }}
        />
      )}

      {showShareCustomer && (
        <ShareCustomerModal request={activeRequest} variantId={activeVariantId} activeMetal={activeMetal} onClose={() => setShowShareCustomer(false)} onStatusChange={() => setRefreshTick(t => t + 1)} />
      )}

      {archiveConfirm && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-overlay-30" onClick={() => setArchiveConfirm(null)}>
          <div className="rounded-modal p-5 sm:p-6 w-[calc(100vw-2rem)] max-w-[360px] bg-white dark:bg-surface-100 border border-transparent dark:border-border-default shadow-modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 bg-tint-warning">
                <i className="ri-archive-line text-ui-md text-warning" />
              </div>
              <div>
                <h3 className="text-ui font-semibold text-ink font-satoshi">
                  Archive this request?
                </h3>
                <p className="text-label-md text-ink-400 mt-1">
                  Request {activeRequest?.id} will be moved to the Analytics archive.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setArchiveConfirm(null)} className="px-4 py-2 rounded-card text-label-md font-medium text-ink-500 dark:text-ink-600 hover:bg-surface-200 dark:hover:bg-surface-150 transition-colors cursor-pointer border border-transparent dark:border-border-default">Cancel</button>
              <button onClick={executeArchiveRequest} className="px-4 py-2 rounded-card text-label-md font-medium text-white transition-all duration-150 cursor-pointer hover:opacity-90 bg-warning shadow-glow-warning-deep">Archive</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1350px] mx-auto px-3 sm:px-4 md:px-6 pb-5 sm:pb-6 lg:pb-8 pt-3 sm:pt-4 lg:pt-5">
        <div className="flex gap-3 sm:gap-4 lg:gap-5">
          <div className={`${['rounded-sheet p-3 sm:p-4 flex flex-col transition-all duration-500', mobileView === 'list' ? 'flex' : 'hidden', 'lg:flex flex-shrink-0', listCollapsed ? 'lg:w-[56px] lg:items-center' : 'lg:w-[300px]', 'w-full'].join(' ')} bg-white dark:bg-surface-100 border border-transparent dark:border-border-default shadow-card h-[calc(100dvh-104px)] lg:h-[calc(100vh-120px)]`}>
            <div className={`flex items-center justify-between mb-3 ${listCollapsed ? 'lg:w-full lg:flex-col lg:gap-2' : ''}`}>
              {!listCollapsed && <h3 className="text-body-md font-semibold dark:text-[#E7EAEE] text-ink font-satoshi">All Requests</h3>}
              <button type="button" onClick={() => setListCollapsed((s) => !s)} aria-label={listCollapsed ? 'Expand list' : 'Collapse list'} className="hidden lg:flex touch-target rounded-card hover:bg-black/[0.04] transition-colors flex-shrink-0">
                <i className={`${listCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'} text-heading-xs text-ink-400`} />
              </button>
            </div>
            {!listCollapsed && (
              <RequestListPanel
                activeId={activeRequest?.id ?? ''}
                onSelect={handleSelectRequest}
                requestsFromParent={localRequests}
                loadingFromParent={apiLoading}
                search={requestSearch}
                onSearchChange={setRequestSearch}
                status={requestStatus}
                onStatusChange={setRequestStatus}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                onDeleteSuccess={handleRequestRemoved}
                onArchiveSuccess={handleRequestRemoved}
              />
            )}
          </div>

          <div className={`${['rounded-sheet flex flex-col flex-1 min-w-0', mobileView === 'workspace' ? 'flex' : 'hidden', 'lg:flex'].join(' ')} bg-white dark:bg-surface-100 border border-transparent dark:border-border-default shadow-card h-[calc(100dvh-104px)] lg:h-[calc(100vh-120px)] overflow-hidden justify-center`}>
            {!hasActiveRequest ? (
              <div className="flex flex-col items-center justify-center p-6 text-center h-full">
                <div className="w-16 h-16 rounded-full bg-blue-50/80 dark:bg-blue-500/10 flex items-center justify-center mb-4">
                  <i className="ri-layout-grid-line text-[28px] text-blue-500" />
                </div>
                <h3 className="text-body-md font-semibold text-[#1A1A1A] dark:text-ink mb-1.5 font-satoshi">No request selected</h3>
                <p className="text-label-md text-[#9CA3AF] dark:text-ink-500 max-w-[280px] mx-auto leading-relaxed">
                  Select a request from the sidebar panel or create a new Jewelry design to see the workspace details.
                </p>
              </div>
            ) : (!activeApiItem || singleLoading || (variantHistoryLoading && !isGenerating && !hasVariantsLoaded)) ? (
              <div className="p-5 bg-white dark:bg-surface-100 flex flex-col gap-4 overflow-hidden h-full w-full">
                <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] dark:border-border-default">
                  <div className="flex flex-col gap-2">
                    <div className="h-5 w-28 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                    <div className="h-3.5 w-36 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-32 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
                </div>
                <div className="flex gap-4 pb-2 border-b border-[#F3F4F6] dark:border-border-default">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-6 w-16 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                  ))}
                </div>
                <div className="flex-1 flex gap-5 overflow-hidden">
                  <div className="flex-1 flex flex-col gap-4">
                    {/* Large main image card */}
                    <div className="flex-1 rounded-[18px] bg-gray-200 dark:bg-[#1E2530] animate-pulse border border-black/[0.04]" />
                    {/* Action Bar */}
                    <div className="flex gap-3 justify-center py-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-9 w-24 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
                      ))}
                    </div>
                    {/* Prompt Box Section */}
                    <div className="p-4 rounded-[18px] bg-[#FAFAF8] dark:bg-[#1A1F28] border border-black/[0.04] flex flex-col gap-2">
                      <div className="h-3 w-36 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                      <div className="h-2.5 w-full bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                      <div className="h-2.5 w-3/4 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                    </div>
                  </div>
                  {/* Right angle tiles column */}
                  <div className="w-[136px] flex flex-col gap-3 flex-shrink-0 max-sm:hidden">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex-1 rounded-[14px] bg-gray-200 dark:bg-[#1E2530] animate-pulse border border-black/[0.04]" />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <button type="button" onClick={() => setMobileView('list')} className="lg:hidden flex items-center gap-2 px-4 pt-3 pb-2 text-xs sm:text-sm font-medium text-ink-500 hover:text-ink min-h-touch text-left">
                  <i className="ri-arrow-left-line text-[14px] sm:text-heading-xs" /> All Requests
                </button>

                <div className="px-4 sm:px-5 md:px-6 pt-4 lg:pt-6 flex-shrink-0">
                  <RequestContextBar
                    request={activeRequest}
                    onStatusChange={handleMarkComplete}
                    isMarkingComplete={completeLoading}
                  />
                  <WorkspaceTabs active={activeTab} onChange={setActiveTab} />
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-5 md:px-6 pb-5 sm:pb-6">
                  {activeTab === 'Design' && (
                    <div className="flex flex-col gap-0">
                      <RenderCard
                        request={{ ...activeRequest, drafts: activeDrafts }}
                        onRenderingComplete={handleRenderingComplete}
                        onRenderingFailed={handleRenderingFailed}
                        onAnglesLoaded={handleAnglesLoaded}
                        variantId={activeVariantId}
                        designId={activeDesignId}
                        initialAngles={activeVariantAngles}
                        activeMetal={activeMetal}
                        setActiveMetal={setActiveMetal}
                        onAngleChange={setActiveAngleId}
                        onBusyChange={setRenderBusy}
                      />
                      <ActionBar
                        onRefineDesign={() => setShowRefine((s) => !s)}
                        onDownload={async () => {
                          if (!activeVariantId) {
                            toast.error('Missing variant id for download.');
                            return;
                          }
                          const metalMap: Record<string, string> = {
                            yellow: 'gold',
                            white: 'silver',
                            rosegold: 'rose_gold',
                          };
                          const activeMetalPayload = metalMap[activeMetal] || 'gold';
                          await dispatch(
                            downloadDesignRender({
                              variant_id: activeVariantId,
                              metal_variation_names: [activeMetalPayload],
                              angle: activeAngleId || 'null',
                            })
                          );
                        }}
                        onShareWithCustomer={() => setShowShareCustomer(true)}
                        onShareWithManufacturer={() => setShowDetailSheetForm(true)}
                        disableRefine={isCompleted || isGenerating}
                        disableDownload={activeDrafts.length === 0 || !activeVariantId || isGenerating || renderBusy}
                        disableShare={activeDrafts.length === 0 || !activeVariantId || isGenerating || renderBusy}
                        isDownloading={downloadLoading}
                      />
                      <PromptSection
                        request={{ ...activeRequest, prompt: displayPrompt }}
                        attachedImages={(() => {
                          const urls: string[] = [];

                          // Find the selected/active variant
                          const activeSelectedVariant = (variantHistory ?? []).find(
                            (v: any) => String(v.id) === String(activeVariantId)
                          ) ?? variantHistory?.[0] ?? null;

                          // Find the oldest/base variant by sorting by timestamp/id (oldest first)
                          const oldestVariant = (variantHistory && variantHistory.length > 0)
                            ? [...variantHistory].sort((a: any, b: any) => {
                              const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                              const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                              if (timeA !== timeB) return timeA - timeB;
                              return Number(a.id || 0) - Number(b.id || 0);
                            })[0]
                            : null;

                          // If the selected variant is the base variant (or history is empty/unavailable),
                          // show original design-level input images.
                          const isBaseVariant = !activeSelectedVariant || (oldestVariant && String(activeSelectedVariant.id) === String(oldestVariant.id));

                          if (isBaseVariant) {
                            if (activeApiItem?.input_image_url) {
                              urls.push(activeApiItem.input_image_url);
                            }
                            if (activeApiItem?.input_image_urls && Array.isArray(activeApiItem.input_image_urls)) {
                              activeApiItem.input_image_urls.forEach((url: string) => {
                                if (url && !urls.includes(url)) {
                                  urls.push(url);
                                }
                              });
                            }
                            // Fallback directly to matching inside apiItems using activeRequest.id
                            if (urls.length === 0 && activeRequest?.id) {
                              const fallbackApiItem = apiItems.find(
                                (it) => it.design_code === activeRequest.id || String(it.id) === activeRequest.id
                              );
                              if (fallbackApiItem?.input_image_url) {
                                urls.push(fallbackApiItem.input_image_url);
                              }
                              if (fallbackApiItem?.input_image_urls && Array.isArray(fallbackApiItem.input_image_urls)) {
                                fallbackApiItem.input_image_urls.forEach((url: string) => {
                                  if (url && !urls.includes(url)) {
                                    urls.push(url);
                                  }
                                });
                              }
                            }
                          } else {
                            // View refined variant -> Show only images uploaded during that refinement action.
                            // The backend stores reference images in `reference_images_json` (array of URLs).
                            const refImagesJson = (activeSelectedVariant as any)?.reference_images_json;
                            if (Array.isArray(refImagesJson)) {
                              refImagesJson.forEach((url: string) => {
                                if (url && !urls.includes(url)) {
                                  urls.push(url);
                                }
                              });
                            }
                            // Fallback to singleVariant reference_images_json if it matches the active variant ID
                            if (urls.length === 0 && singleVariant && String(singleVariant.id) === String(activeVariantId)) {
                              const svRefImagesJson = (singleVariant as any)?.reference_images_json;
                              if (Array.isArray(svRefImagesJson)) {
                                svRefImagesJson.forEach((url: string) => {
                                  if (url && !urls.includes(url)) {
                                    urls.push(url);
                                  }
                                });
                              }
                            }
                          }

                          return urls.length > 0 ? urls : undefined;
                        })()}
                      />
                      {showRefine && (
                        <RefinePromptModal
                          originalPrompt={displayPrompt}
                          designId={activeDesignId}
                          parentVariantId={activeVariantId}
                          baseDesignImageUrl={(activeDrafts.find(d => d.isCurrent) || activeDrafts[0])?.base_design_image_url || null}
                          onClose={() => setShowRefine(false)}
                          onSubmit={handleRefineSubmit}
                          isLocked={isCompleted}
                        />
                      )}
                      <DraftHistory drafts={activeDrafts} loading={variantHistoryLoading} onSwitchVersion={handleSwitchVersion} onArchiveVersion={handleArchiveVersion} onDeleteVersion={handleDeleteVersion} designId={activeDesignId} />
                    </div>
                  )}

                  {activeTab === 'Customer' && <CustomerApprovalPanel request={activeRequest} variantId={activeVariantId} activeMetal={activeMetal} onGoToDesign={() => setActiveTab('Design')} onStatusChange={() => setRefreshTick(t => t + 1)} />}

                  {activeTab === 'Manufacturer' && (
                    <ManufacturerHandoffPanel request={activeRequest} variantId={activeVariantId} onGoToDesign={() => setActiveTab('Design')} onStatusChange={() => setRefreshTick(t => t + 1)} onGenerateDetailSheet={() => setShowDetailSheetForm(true)} sentManufacturerIds={sentManufacturerIds} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RequestsWorkspace() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-page">
        <TopBar />
        <div className="max-w-[1350px] mx-auto px-3 sm:px-4 md:px-6 pb-5 sm:pb-6 lg:pb-8 pt-3 sm:pt-4 lg:pt-5">
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* Left Panel Skeleton */}
            <div className="rounded-sheet p-4 bg-white dark:bg-surface-100 border border-transparent dark:border-border-default shadow-card h-[calc(100dvh-104px)] lg:h-[calc(100vh-120px)] flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] dark:border-border-default">
                <div className="h-5 w-24 bg-gray-200 dark:bg-[#2C3545] rounded-[6px] animate-pulse" />
                <div className="h-5 w-5 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
              </div>
              <div className="h-9 w-full bg-[#F3F4F6] dark:bg-[#1E2530] rounded-[10px] animate-pulse" />
              <div className="flex gap-2 pb-2 overflow-x-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 w-14 bg-gray-200 dark:bg-[#2C3545] rounded-full flex-shrink-0 animate-pulse" />
                ))}
              </div>
              <div className="flex flex-col gap-3 overflow-hidden flex-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-[14px] bg-[#FAFAF8] dark:bg-[#1A1F28] border border-transparent">
                    <div className="w-10 h-10 rounded-[10px] bg-gray-200 dark:bg-[#2C3545] flex-shrink-0 animate-pulse" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-3 w-16 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                      <div className="h-2.5 w-12 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                      <div className="flex justify-between items-center mt-1">
                        <div className="h-4 w-10 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
                        <div className="h-2 w-8 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel Skeleton */}
            <div className="rounded-sheet p-5 bg-white dark:bg-surface-100 border border-transparent dark:border-border-default shadow-card h-[calc(100dvh-104px)] lg:h-[calc(100vh-120px)] flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] dark:border-border-default">
                <div className="flex flex-col gap-2">
                  <div className="h-5 w-28 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                  <div className="h-3.5 w-36 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                </div>
                <div className="h-8 w-32 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
              </div>
              <div className="flex gap-4 pb-2 border-b border-[#F3F4F6] dark:border-border-default">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-6 w-16 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                ))}
              </div>
              <div className="flex-1 flex gap-5 overflow-hidden">
                <div className="flex-1 flex flex-col gap-4">
                  {/* Large main image card */}
                  <div className="flex-1 rounded-[18px] bg-gray-200 dark:bg-[#1E2530] animate-pulse border border-black/[0.04]" />
                  {/* Action Bar */}
                  <div className="flex gap-3 justify-center py-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-9 w-24 bg-gray-200 dark:bg-[#2C3545] rounded-full animate-pulse" />
                    ))}
                  </div>
                  {/* Prompt Box Section */}
                  <div className="p-4 rounded-[18px] bg-[#FAFAF8] dark:bg-[#1A1F28] border border-black/[0.04] flex flex-col gap-2">
                    <div className="h-3 w-36 bg-gray-200 dark:bg-[#2C3545] rounded animate-pulse" />
                    <div className="h-2.5 w-full bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                    <div className="h-2.5 w-3/4 bg-gray-100 dark:bg-[#232B38] rounded animate-pulse" />
                  </div>
                </div>
                {/* Right angle tiles column */}
                <div className="w-[136px] flex flex-col gap-3 flex-shrink-0 max-sm:hidden">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex-1 rounded-[14px] bg-gray-200 dark:bg-[#1E2530] animate-pulse border border-black/[0.04]" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <RequestsWorkspaceContent />
    </Suspense>
  );
}
