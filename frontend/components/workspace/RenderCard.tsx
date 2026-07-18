'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import RenderProgress from './RenderProgress';
import { AngleView, RequestData } from '@/lib/requestsData';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchVariantAngles } from '@/redux/slices/retailer/designVariantAnglesSlice';
import { fetchVariantsByDesignId, fetchVariantById } from '@/redux/slices/retailer/designVariantSlice';
import { generateVariantMetals, setMetalGeneratedData } from '@/redux/slices/retailer/designVariantMetalsSlice';
import { getAccessToken } from '@/src/utils/auth';
import axiosInstance from '@/src/utils/hooks/axios';
import { getCacheBustedUrl } from '@/src/utils/image';

const metalOptions = [
  { id: 'yellow', label: 'Yellow Gold', payloadValue: 'gold', abbr: 'YG', initial: 'Y', filterClass: 'metal-filter-yellow', bgClass: 'bg-[#D4AF37]', ringClass: 'shadow-[0_0_0_2px_white,0_0_0_3.5px_#B8960C]' },
  { id: 'white', label: 'White Gold', payloadValue: 'silver', abbr: 'SV', initial: 'W', filterClass: 'metal-filter-white', bgClass: 'bg-[#C0C0C0]', ringClass: 'shadow-[0_0_0_2px_white,0_0_0_3.5px_#A0A0A0]' },
  { id: 'rosegold', label: 'Rose Gold', payloadValue: 'rose_gold', abbr: 'RG', initial: 'R', filterClass: 'metal-filter-rose', bgClass: 'bg-[#E8A598]', ringClass: 'shadow-[0_0_0_2px_white,0_0_0_3.5px_#C97B6E]' },
];

const viewAbbr: Record<string, string> = {
  'Front View': 'FV',
  'Side View': 'SV',
  'Back View': 'BV',
  'Worn View': 'WV',
  'Top View': 'FV',
  'Detail View': 'SV',
};

interface RenderCardProps {
  request?: RequestData;
  onRenderingComplete?: (completedDesignId?: string) => void;
  onRenderingFailed?: (errorMsg?: string, completedDesignId?: string) => void;
  onAnglesLoaded?: (angles: AngleView[]) => void;
  variantId?: string | number | null;
  designId?: string | number | null;
  initialAngles?: AngleView[];
  activeMetal?: string;
  setActiveMetal?: (metal: string) => void;
  onAngleChange?: (angleId: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
}

interface ActiveConnection {
  controller: AbortController;
  sseKey: string;
  onComplete: (payload: { imageUrl?: string; returnedVariantId?: any }) => void;
  onFailure: (errorMessage: string) => void;
}

const activeDesignSseConnections: Record<string, ActiveConnection> = {};
const activeAnglesSseConnections: Record<string, {
  controller: AbortController;
  sseKey: string;
  onComplete: (payload: any) => void;
  onFailure: (errorMessage: string) => void;
}> = {};
const activeMetalsSseConnections: Record<string, {
  controller: AbortController;
  sseKey: string;
  onComplete: (payload: any) => void;
  onFailure: (errorMessage: string) => void;
}> = {};

let activeDesignIdGlobal: string | number | null = null;

export function cleanupActiveDesignSseConnections() {
  Object.keys(activeDesignSseConnections).forEach((key) => {
    try {
      activeDesignSseConnections[key].controller.abort();
    } catch (e) { }
    delete activeDesignSseConnections[key];
  });
  Object.keys(activeAnglesSseConnections).forEach((key) => {
    try {
      activeAnglesSseConnections[key].controller.abort();
    } catch (e) { }
    delete activeAnglesSseConnections[key];
  });
  Object.keys(activeMetalsSseConnections).forEach((key) => {
    try {
      activeMetalsSseConnections[key].controller.abort();
    } catch (e) { }
    delete activeMetalsSseConnections[key];
  });
}

/**
 * Image that CROSSFADES smoothly when its `src` changes (e.g. when the user clicks a
 * different metal colour). The current image stays as the bottom layer while the new one
 * fades in on top, then becomes the new base. No transition on first mount.
 */
function CrossfadeImage({
  src,
  alt,
  className,
  draggable,
  requestId,
}: {
  src?: string;
  alt?: string;
  className?: string;
  draggable?: boolean;
  requestId?: string;
}) {
  const [displayed, setDisplayed] = useState<string | undefined>(src);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [topVisible, setTopVisible] = useState(false);

  const lastRequestIdRef = useRef(requestId);
  const hasLoadedInitialVariantRef = useRef(false);

  if (lastRequestIdRef.current !== requestId) {
    lastRequestIdRef.current = requestId;
    hasLoadedInitialVariantRef.current = false;
  }

  useEffect(() => {
    if (!src) return;

    if (!hasLoadedInitialVariantRef.current) {
      hasLoadedInitialVariantRef.current = true;
      setDisplayed(src);
      setIncoming(null);
      setTopVisible(false);
      return;
    }

    // Only the cache-bust query (?cv=...) differs -> it's the SAME underlying image.
    // Keep the already-loaded image instead of reloading it, which was causing the
    // "load -> blink -> load again" flash when opening a request/design.
    const stripCv = (u?: string | null) => (u ? u.split(/[?#]/)[0] : u);
    if (src === displayed || stripCv(src) === stripCv(displayed)) {
      setIncoming(null);
      setTopVisible(false);
      return;
    }

    setIncoming(src);
    setTopVisible(false);
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setTopVisible(true))
    );
    const done = setTimeout(() => {
      setDisplayed(src);
      setIncoming(null);
      setTopVisible(false);
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [src, displayed, requestId]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {displayed && (
        <img
          src={displayed}
          alt={alt}
          className={className}
          draggable={draggable}
        />
      )}
      {incoming && (
        <img
          src={incoming}
          alt={alt}
          className={`${className ?? ''} absolute inset-0 transition-opacity duration-500 ease-in-out ${topVisible ? 'opacity-100' : 'opacity-0'}`}
          draggable={draggable}
        />
      )}
    </div>
  );
}

export default function RenderCard({ request, onRenderingComplete, onRenderingFailed, onAnglesLoaded, variantId, designId, initialAngles, activeMetal: activeMetalProp, setActiveMetal: setActiveMetalProp, onAngleChange, onBusyChange }: RenderCardProps) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    activeDesignIdGlobal = designId ?? null;
  }, [designId]);

  const reduxAccessToken = useAppSelector((s) => s.auth.accessToken);
  const [activeMetalState, setActiveMetalState] = useState('yellow');
  const activeMetal = activeMetalProp ?? activeMetalState;
  const setActiveMetal = setActiveMetalProp ?? setActiveMetalState;
  const activeMetalObj = metalOptions.find((m) => m.id === activeMetal);
  const activeMetalPayload = activeMetalObj?.payloadValue || 'gold';
  const [spinning, setSpinning] = useState(false);
  const [selectedAngleId, setSelectedAngleId] = useState<string>('best');
  const [generationError, setGenerationError] = useState<string | null>(null);
  // GLightbox will handle image lightboxing; no local lightbox state required
  const [anglesVisible, setAnglesVisible] = useState(false);
  const [anglesGenerating, setAnglesGenerating] = useState(false);
  const [generatingAnglesMetal, setGeneratingAnglesMetal] = useState<string | null>(null);

  useEffect(() => {
    if (!anglesGenerating) {
      setGeneratingAnglesMetal(null);
    }
  }, [anglesGenerating]);
  const [generatedAngles, setGeneratedAngles] = useState<string[]>([]);
  const [anglesFromApi, setAnglesFromApi] = useState<Record<string, AngleView[]>>({});
  const [sseGeneratedMainImage, setSseGeneratedMainImage] = useState<string | null>(null);
  const [sseGeneratedVariantId, setSseGeneratedVariantId] = useState<string | number | null>(null);
  const [overrideImage, setOverrideImage] = useState<string | null>(null);
  const [designSseLoading, setDesignSseLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<AbortController | null>(null);

  const { byVariantId: metalDataByVariantId, loading: metalsGlobalLoading } = useAppSelector((s) => s.retailerDesignVariantMetals);
  const [generatingMetal, setGeneratingMetal] = useState<string | null>(null);
  const [generatingMetals, setGeneratingMetals] = useState<Record<string, boolean>>({});
  const [requestedMetals, setRequestedMetals] = useState<string[]>([]);
  const metalsSseRef = useRef<AbortController | null>(null);
  const subscribingMetalsRef = useRef<Record<string, boolean>>({});
  const designSseRef = useRef<AbortController | null>(null);
  const designSseKeyRef = useRef<string | null>(null);
  const onRenderingCompleteRef = useRef(onRenderingComplete);
  const onRenderingFailedRef = useRef(onRenderingFailed);
  const fetchedDesignVariantsRef = useRef<Record<string, boolean>>({});
  const prevVariantIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    onRenderingFailedRef.current = onRenderingFailed;
  }, [onRenderingFailed]);

  const requestId = request?.id ?? 'none';
  const [prevRequestId, setPrevRequestId] = useState(requestId);
  if (requestId !== prevRequestId) {
    setPrevRequestId(requestId);
    setSseGeneratedMainImage(null);
    setSseGeneratedVariantId(null);
    setOverrideImage(null);
    setAnglesFromApi({});
    setGeneratedAngles([]);
    setRequestedMetals([]);
    setGeneratingMetals({});
    setGeneratingMetal(null);
    setSpinning(false);
    setGenerationError(null);
  }
  const { variants: variantHistory, variantsLoading: variantHistoryLoading } = useAppSelector((s) => s.retailerDesignVariant);
  const { data: createDesignData } = useAppSelector((s) => s.retailerCreateDesign);
  const createdDesignId = createDesignData?.id ?? createDesignData?.data?.id ?? null;
  const createdDesignCode = createDesignData?.design_code ?? createDesignData?.data?.design_code ?? null;
  const createdDesignName = createDesignData?.name ?? createDesignData?.data?.name ?? null;
  const { items: apiItems } = useAppSelector((s) => s.retailerDesigns);

  // Resolve real numeric design ID to prevent isVariantStale from failing due to string/code design IDs (e.g. 'SHI-002')
  let urlDesignId: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      urlDesignId = params.get('id');
    } catch (e) { }
  }

  // Attempt to resolve numeric ID by looking up the request ID or url design ID in apiItems list
  const matchedItem = apiItems?.find(
    (it) => (request?.id && (it.design_code === request.id || String(it.id) === String(request.id))) ||
      (urlDesignId && (it.design_code === urlDesignId || String(it.id) === String(urlDesignId)))
  );
  const resolvedNumericIdFromList = matchedItem?.id ?? null;

  // Verify if the created design is actually the active design before using createdDesignId as fallback candidate
  const isCreatedDesignActive = Boolean(
    createdDesignId && (
      (request?.id && (String(request.id) === String(createdDesignId) || String(request.id) === String(createdDesignCode) || String(request.id) === String(createdDesignName))) ||
      (urlDesignId && (String(urlDesignId) === String(createdDesignId) || String(urlDesignId) === String(createdDesignCode) || String(urlDesignId) === String(createdDesignName)))
    )
  );

  const candidateDesignIds = [
    designId,
    resolvedNumericIdFromList,
    urlDesignId,
    isCreatedDesignActive ? createdDesignId : null,
    request?.id
  ];
  let realDesignId: number | null = null;
  for (const cid of candidateDesignIds) {
    if (cid && !isNaN(Number(cid))) {
      realDesignId = Number(cid);
      break;
    }
  }

  const isSyncingVariants = Boolean(
    variantHistory &&
    variantHistory.length > 0 &&
    realDesignId &&
    String(variantHistory[0].design_id) !== String(realDesignId)
  );

  const currentVariantsForDesign = (variantHistory && variantHistory.length > 0 && realDesignId && String(variantHistory[0].design_id) === String(realDesignId))
    ? variantHistory
    : [];

  const hasSelectedVariantInHistory = variantId ? currentVariantsForDesign.some((v: any) => String(v.id) === String(variantId)) : false;
  const selectedVariant = hasSelectedVariantInHistory
    ? currentVariantsForDesign.find((v: any) => String(v.id) === String(variantId))
    : (variantId ? null : (currentVariantsForDesign[0] ?? null));

  const storedRefinementGenerating = (() => {
    if (typeof window === 'undefined' || !realDesignId) return false;
    try {
      return localStorage.getItem(`refinement_generating_${realDesignId}`) === 'true' ||
        sessionStorage.getItem(`refinement_generating_${realDesignId}`) === 'true';
    } catch (e) {
      return false;
    }
  })();

  const storedRefinementVariantId = (() => {
    if (typeof window === 'undefined' || !realDesignId) return null;
    try {
      const stored = localStorage.getItem(`refinement_variant_id_${realDesignId}`) ||
        sessionStorage.getItem(`refinement_variant_id_${realDesignId}`);
      return stored ? Number(stored) : null;
    } catch (e) {
      return null;
    }
  })();

  const isRefinement = Boolean(
    (selectedVariant && selectedVariant.parent_variant_id && realDesignId && String(selectedVariant.design_id) === String(realDesignId)) ||
    (currentVariantsForDesign.length > 1) ||
    (variantId && currentVariantsForDesign.length > 0 && String(variantId) !== String(currentVariantsForDesign[0].id)) ||
    storedRefinementGenerating
  );

  const candidateVariantIdsForKeys = [variantId, storedRefinementVariantId, sseGeneratedVariantId, selectedVariant?.id, currentVariantsForDesign[0]?.id];
  let resolvedVariantIdForKey: number | null = null;
  for (const cid of candidateVariantIdsForKeys) {
    if (cid && !isNaN(Number(cid))) {
      resolvedVariantIdForKey = Number(cid);
      break;
    }
  }
  const variantKey = resolvedVariantIdForKey ? String(resolvedVariantIdForKey) : null;

  const { byVariantId, loading: anglesLoading } = useAppSelector((s) => s.retailerDesignVariantAngles);
  const normalizedInitialAngles = initialAngles ?? [];
  const storedAngles = (variantKey && activeMetalPayload) ? byVariantId[variantKey]?.[activeMetalPayload] ?? [] : [];
  const currentDraft = request?.drafts?.find(d => d.isCurrent) || (request?.drafts && request.drafts.length > 0 ? request.drafts[0] : null);

  // Safely parse metal_variations_json
  let parsedMetalVariations: any = null;
  try {
    if (selectedVariant?.metal_variations_json) {
      if (typeof selectedVariant.metal_variations_json === 'string') {
        parsedMetalVariations = JSON.parse(selectedVariant.metal_variations_json);
      } else {
        parsedMetalVariations = selectedVariant.metal_variations_json;
      }
    }
  } catch (e) {
    console.error('Error parsing metal_variations_json:', e);
  }

  // The metal color of the BASE image (detected by the backend). The base swatch shows
  // the base image and never regenerates; all OTHER swatches generate on click.
  const baseMetalPayload = (() => {
    const variantObj = selectedVariant as any;
    if (variantObj?.base_metal) return variantObj.base_metal;

    // Fallback: match base_design_image_url/image_url with metal_variations_json URLs
    const baseImg = variantObj?.base_design_image_url || variantObj?.base_image_url || variantObj?.image_url || variantObj?.url || variantObj?.mainImage || variantObj?.image;
    if (baseImg && parsedMetalVariations) {
      for (const [metalKey, metalVal] of Object.entries(parsedMetalVariations)) {
        const metalUrl = typeof metalVal === 'string'
          ? metalVal
          : ((metalVal as any)?.mainImage || (metalVal as any)?.url || (metalVal as any)?.image_url);
        if (metalUrl && metalUrl === baseImg) {
          return metalKey;
        }
      }
    }
    return 'gold';
  })();

  const baseMetalId = metalOptions.find((m) => m.payloadValue === baseMetalPayload)?.id || 'yellow';
  const customMetalData = (variantKey && activeMetalPayload !== baseMetalPayload) ? metalDataByVariantId[variantKey]?.[activeMetalPayload] : null;
  const displayMainImageFromMetal = customMetalData?.mainImage;
  const displayAnglesFromMetal = customMetalData?.angles;

  const isVariantStale = selectedVariant && realDesignId && String(selectedVariant.design_id) !== String(realDesignId);

  // Safely parse angles_json
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
    console.error('Error parsing angles_json:', e);
  }

  const backendMainImage = (!isVariantStale && selectedVariant)
    ? (activeMetalPayload === baseMetalPayload
      ? (selectedVariant?.base_image_url || selectedVariant?.image_url || selectedVariant?.url || selectedVariant?.mainImage || selectedVariant?.image || (!isRefinement ? selectedVariant?.base_design_image_url : undefined))
      : (
        (parsedMetalVariations?.[activeMetalPayload] && typeof parsedMetalVariations?.[activeMetalPayload] === 'string')
          ? parsedMetalVariations[activeMetalPayload]
          : (parsedMetalVariations?.[activeMetalPayload]?.mainImage || parsedMetalVariations?.[activeMetalPayload]?.url || parsedMetalVariations?.[activeMetalPayload]?.image_url)
      ))
    : null;

  const isGenerating = (() => {
    if (isSyncingVariants) return false;
    if (sseGeneratedMainImage) return false;

    const reqStatus = (request?.status || '').trim().toUpperCase();
    const isRequestGenerating = reqStatus === 'GENERATING' || reqStatus === 'PENDING' || reqStatus === 'PROCESSING';

    if (storedRefinementGenerating) {
      const isCurrentlyActiveRefinement = !variantId || !storedRefinementVariantId || String(variantId) === String(storedRefinementVariantId);
      if (isCurrentlyActiveRefinement) {
        if (selectedVariant) {
          const vStatus = (selectedVariant.status || '').trim().toUpperCase();
          const isVariantGenerating = vStatus === 'GENERATING' || vStatus === 'PENDING' || vStatus === 'PROCESSING';
          const hasImage = Boolean(
            selectedVariant.base_image_url ||
            selectedVariant.image_url ||
            selectedVariant.url ||
            selectedVariant.mainImage ||
            selectedVariant.image ||
            sseGeneratedMainImage ||
            overrideImage ||
            backendMainImage
          );
          if (hasImage) {
            if (typeof window !== 'undefined' && realDesignId) {
              try {
                localStorage.removeItem(`refinement_generating_${realDesignId}`);
                localStorage.removeItem(`refinement_variant_id_${realDesignId}`);
                sessionStorage.removeItem(`refinement_generating_${realDesignId}`);
                sessionStorage.removeItem(`refinement_variant_id_${realDesignId}`);
              } catch (e) { }
            }
            return false;
          }
        }
        return true;
      }
    }

    if (variantHistoryLoading && !isRequestGenerating) return false;

    if (variantId && !selectedVariant) {
      // The variant is specified but not in history yet (e.g. freshly refined variant before history refetch resolves).
      // If the request is generating, this new variant is generating, and it has no image yet.
      return isRequestGenerating;
    }

    if (selectedVariant) {
      const vStatus = (selectedVariant.status || '').trim().toUpperCase();
      const isVariantGenerating = vStatus === 'GENERATING' || vStatus === 'PENDING' || vStatus === 'PROCESSING';

      const hasImage = Boolean(
        selectedVariant.base_image_url ||
        selectedVariant.image_url ||
        selectedVariant.url ||
        selectedVariant.mainImage ||
        selectedVariant.image ||
        (!isRefinement && selectedVariant.base_design_image_url) ||
        sseGeneratedMainImage ||
        overrideImage ||
        backendMainImage
      );

      if (isVariantGenerating && !hasImage) return true;

      const isLatestVariant = currentVariantsForDesign.length > 0 && String(selectedVariant.id) === String(currentVariantsForDesign[0].id);

      if (isRequestGenerating && isLatestVariant && !hasImage) {
        return true;
      }
      return false;
    }

    const hasAnyImage = Boolean(
      sseGeneratedMainImage ||
      overrideImage ||
      backendMainImage ||
      request?.mainImage
    );

    return isRequestGenerating && !hasAnyImage;
  })();
  const isCompleted = request?.status === 'Completed' || request?.status === 'COMPLETED';

  useEffect(() => {
    if (isGenerating) {
      setGenerationError(null);
    }
  }, [isGenerating]);

  const mapAnglesJson = (anglesObj: any): AngleView[] => {
    if (!anglesObj) return [];
    return [
      { id: 'side', label: 'Side View', image: anglesObj.side_view || anglesObj.side || '' },
      { id: 'top', label: 'Top View', image: anglesObj.top_view || anglesObj.top || '' },
      { id: 'three-quarter', label: 'Three Quarter View', image: anglesObj.three_quarter_view || anglesObj.three_quarter || '' },
      { id: 'back', label: 'Back View', image: anglesObj.back_view || anglesObj.back || '' },
      { id: 'worn', label: 'Worn View', image: anglesObj.worn_view || anglesObj.worn || '' },
    ].filter(a => a.image && typeof a.image === 'string' && a.image.length > 0);
  };

  const backendAngles = parsedAnglesJson?.[activeMetalPayload]
    ? mapAnglesJson(parsedAnglesJson[activeMetalPayload])
    : [];

  // Look for generated image overrides in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('generatedImages');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Check by all potential keys
          const keys = [request?.id, designId, variantId].filter(Boolean).map(String);
          for (const key of keys) {
            if (parsed[key]) {
              setOverrideImage(parsed[key]);
              break;
            }
          }
        }
      } catch (e) {
        console.error('Error reading generatedImages from localStorage:', e);
      }
    }
  }, [request?.id, designId, variantId, sseGeneratedMainImage]);

  // Only use the SSE-generated image for the variant it was actually generated for;
  // otherwise switching to another version keeps showing the last generated image.
  const sseImageForThisVariant = (sseGeneratedMainImage && (!sseGeneratedVariantId || String(sseGeneratedVariantId) === String(variantId)))
    ? sseGeneratedMainImage
    : null;
  // Prefer the per-variant image (backend / current draft) over the design-level
  // localStorage override, which is shared across every version of a design.
  const displayMainImageRaw = activeMetalPayload === baseMetalPayload
    ? (sseImageForThisVariant || backendMainImage || currentDraft?.base_design_image_url || overrideImage || request?.mainImage)
    : (displayMainImageFromMetal || backendMainImage || sseImageForThisVariant || currentDraft?.base_design_image_url || overrideImage || request?.mainImage);
  const displayMainImage = getCacheBustedUrl(displayMainImageRaw, selectedVariant?.updated_at || request?.updatedAt);

  // Report "image still generating" to the parent so Download/Share can be disabled while a
  // base render, refinement, metal colour, or angle view is still rendering (SSE-driven).
  const renderBusy = isGenerating
    || Boolean(generatingMetals[activeMetalPayload])
    || (anglesGenerating && generatingAnglesMetal === activeMetalPayload)
    || designSseLoading;
  useEffect(() => {
    onBusyChange?.(renderBusy);
  }, [renderBusy, onBusyChange]);

  // Calculate angles based strictly on the selected metal and the selected variant
  const activeAnglesFromApi = anglesFromApi[activeMetalPayload] ?? [];
  const activeStoredAngles = (variantKey && activeMetalPayload) ? byVariantId[variantKey]?.[activeMetalPayload] ?? [] : [];

  const anglesSource = backendAngles.length > 0
    ? backendAngles
    : (activeMetal === baseMetalId
      ? (activeAnglesFromApi.length > 0 ? activeAnglesFromApi : (activeStoredAngles.length > 0 ? activeStoredAngles : (normalizedInitialAngles.length > 0 ? normalizedInitialAngles : [])))
      : (displayAnglesFromMetal ?? []));

  const hasAngles = Array.isArray(anglesSource) && anglesSource.length > 0;
  const displayAngles = hasAngles
    ? anglesSource
      .filter((a) => a && a.id && a.image && a.id !== 'front')
      .map((a) => ({
        ...a,
        image: getCacheBustedUrl(a.image, selectedVariant?.updated_at || request?.updatedAt),
      }))
    : [];
  const displayAnglesRef = useRef(displayAngles);
  useEffect(() => {
    displayAnglesRef.current = displayAngles;
  }, [displayAngles]);

  useEffect(() => {
    if (selectedAngleId === 'best') {
      onAngleChange?.(null);
      return;
    }
    const found = displayAngles.find((a) => a && a.id === selectedAngleId);
    if (!found) {
      onAngleChange?.(null);
      return;
    }
    const label = (found.label || '').toLowerCase();
    let backendValue: string | null = null;
    if (label.includes('side')) backendValue = 'side_view';
    else if (label.includes('top')) backendValue = 'top_view';
    else if (label.includes('three') || label.includes('3/4') || label.includes('quarter')) backendValue = 'three_quarter_view';
    else if (label.includes('back')) backendValue = 'back_view';
    else if (label.includes('worn')) backendValue = 'worn_view';
    else if (label.includes('front')) backendValue = 'front_view';
    else backendValue = label.trim().replace(/\s+/g, '_');

    onAngleChange?.(backendValue);
  }, [selectedAngleId, displayAngles, onAngleChange]);

  const activePreviewImage = (() => {
    if (selectedAngleId === 'best') return displayMainImage;
    const found = displayAngles.find((a) => a && a.id === selectedAngleId);
    return found?.image || displayMainImage;
  })();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // Gallery images for fallback modal (main + angles)
  const galleryImages = displayMainImage
    ? [displayMainImage, ...displayAngles.map((d) => d.image)]
    : [];

  // Initialize GLightbox on client with proper React lifecycle and cleanup
  const glightboxRef = useRef<any>(null);


  useEffect(() => {
    setSelectedAngleId('best');
    baseMetalAppliedRef.current = null;
    setSseGeneratedMainImage(null);
    setOverrideImage(null);
    setAnglesFromApi({});
    setGeneratedAngles([]);
    setRequestedMetals([]);
    subscribingMetalsRef.current = {};
    setGeneratingMetals({});
    setSpinning(false);
    setGenerationError(null);
  }, [requestId]);

  // Reset SSE, overriding images, angles and active metal when the user manually switches to a pre-existing variant version in Draft History
  useEffect(() => {
    if (!variantId || !variantHistory || variantHistory.length === 0) return;

    // Sync current variant selection metadata and swatches reset on change
    if (variantId) {
      const isSwitching = prevVariantIdRef.current !== null && String(prevVariantIdRef.current) !== String(variantId);
      if (isSwitching) {
        setSseGeneratedMainImage(null);
        setOverrideImage(null);
        setAnglesFromApi({});
        setGeneratedAngles([]);
        setSelectedAngleId('best');
        setRequestedMetals([]);
        subscribingMetalsRef.current = {};
        setGeneratingMetals({});
        baseMetalAppliedRef.current = null;
      }
    }

    prevVariantIdRef.current = variantId;
  }, [variantId, variantHistory, setActiveMetal]);

  // Default-select the metal swatch that matches the base image's detected color
  // (base_metal). E.g. a silver base auto-selects the Silver (S) swatch instead of Gold.
  // Runs once per variant (ref-guarded) so it never fights the user's manual choice.
  const baseMetalAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    const bm = baseMetalPayload;
    const vKey = selectedVariant ? String((selectedVariant as any).id) : null;
    if (!bm || !vKey) return;
    const applyKey = `${vKey}:${bm}`;
    if (baseMetalAppliedRef.current === applyKey) return; // already applied this specific base_metal for this variant
    const matchedId = metalOptions.find((m) => m.payloadValue === bm)?.id;
    if (matchedId) {
      baseMetalAppliedRef.current = applyKey;
      if (matchedId !== activeMetal) setActiveMetal(matchedId);
    }
  }, [selectedVariant, activeMetal, setActiveMetal, baseMetalPayload]);



  useEffect(() => {
    onRenderingCompleteRef.current = onRenderingComplete;
  }, [onRenderingComplete]);

  useEffect(() => {
    setDesignSseLoading(false);
    setGeneratingMetal(null);
    setGeneratingMetals({});
    setGeneratingAnglesMetal(null);
    setRequestedMetals([]);
    subscribingMetalsRef.current = {};
    setAnglesVisible(hasAngles);
    setAnglesGenerating(false);
    setGeneratedAngles([]);
    setAnglesFromApi({});
    setSseGeneratedMainImage(null);
    setSseGeneratedVariantId(null);
    setOverrideImage(null);
    setGenerationError(null);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Do NOT abort background SSE connections on unmount to keep them running in background.
      // They will be cleaned up by cleanupActiveDesignSseConnections() when leaving the requests workspace.
      sseRef.current = null;
      metalsSseRef.current = null;
      subscribingMetalsRef.current = {};
      setGeneratingMetals({});
    };
  }, [requestId, variantId]);

  // Restore active angles/metal generation on mount or request/variant change
  useEffect(() => {
    if (isCompleted || variantHistoryLoading) return;

    const candidateIds = [variantId, selectedVariant?.id, variantHistory?.[0]?.id];
    let realVariantId: number | null = null;
    for (const cid of candidateIds) {
      if (cid && !isNaN(Number(cid))) {
        realVariantId = Number(cid);
        break;
      }
    }
    if (!realVariantId) return;

    const targetVariantId = String(realVariantId);
    const selectedMetalPayload = metalOptions.find((m) => m.id === activeMetal)?.payloadValue ?? 'gold';

    // 1. Check if angles are generating for this variant & metal across all metal options
    metalOptions.forEach((metalOption) => {
      const metalPayload = metalOption.payloadValue;
      const anglesKey = `angles_generating_${targetVariantId}_${metalPayload}`;

      const existingInBackend = parsedAnglesJson?.[metalPayload];
      const hasExistingBackendAngles = mapAnglesJson(existingInBackend).length > 0;

      const existingInRedux = targetVariantId ? byVariantId[targetVariantId]?.[metalPayload] : null;
      const hasExistingReduxAngles = existingInRedux && existingInRedux.length > 0;

      const anglesExist = Boolean(hasExistingBackendAngles || hasExistingReduxAngles);

      try {
        const isAnglesGeneratingInStorage = localStorage.getItem(anglesKey) === 'true' || sessionStorage.getItem(anglesKey) === 'true';
        if (isAnglesGeneratingInStorage) {
          if (anglesExist) {
            console.log(`[Angles Generation Restore] Angles already exist for variant ${targetVariantId} on metal ${metalPayload}. Clearing storage keys.`);
            localStorage.removeItem(anglesKey);
            sessionStorage.removeItem(anglesKey);
          } else if (!anglesGenerating && !sseRef.current) {
            console.log(`[Angles Generation Restore] Re-triggering angles generation for variant ${targetVariantId} on metal ${metalPayload}`);
            if (activeMetal !== metalOption.id) {
              setActiveMetal(metalOption.id);
            }
            handleGetMoreAngles(true, metalPayload);
          }
        }
      } catch (e) { }
    });

    // 2. Check if metal is generating for this variant
    const nonYellowMetals = ['silver', 'rose_gold'];
    nonYellowMetals.forEach((metalPayload) => {
      const metalKey = `metal_generating_${targetVariantId}_${metalPayload}`;
      const metalId = metalPayload === 'silver' ? 'white' : 'rosegold';

      const existingInRedux = metalDataByVariantId[targetVariantId]?.[metalPayload];
      const existingInBackend = parsedMetalVariations?.[metalPayload];
      const mainGoldImage = selectedVariant?.base_image_url || selectedVariant?.image_url || selectedVariant?.url || selectedVariant?.mainImage || selectedVariant?.image || selectedVariant?.base_design_image_url;

      const hasExistingBackendImage = existingInBackend && (
        (typeof existingInBackend === 'string' &&
          existingInBackend.length > 0 &&
          existingInBackend !== 'null' &&
          existingInBackend !== 'None' &&
          existingInBackend !== 'undefined' &&
          existingInBackend !== mainGoldImage &&
          !existingInBackend.startsWith('{') &&
          (existingInBackend.startsWith('http') || existingInBackend.startsWith('/') || existingInBackend.includes('/') || existingInBackend.includes('.'))) ||
        (typeof existingInBackend === 'object' && (
          (existingInBackend.mainImage && typeof existingInBackend.mainImage === 'string' && existingInBackend.mainImage.length > 0 && existingInBackend.mainImage !== 'null' && existingInBackend.mainImage !== mainGoldImage) ||
          (existingInBackend.url && typeof existingInBackend.url === 'string' && existingInBackend.url.length > 0 && existingInBackend.url !== 'null' && existingInBackend.url !== mainGoldImage) ||
          (existingInBackend.image_url && typeof existingInBackend.image_url === 'string' && existingInBackend.image_url.length > 0 && existingInBackend.image_url !== 'null' && existingInBackend.image_url !== mainGoldImage)
        ))
      );

      const hasMetalImg = Boolean(existingInRedux?.mainImage || hasExistingBackendImage);

      try {
        const isMetalGeneratingInStorage = localStorage.getItem(metalKey) === 'true' || sessionStorage.getItem(metalKey) === 'true';
        if (!hasMetalImg && isMetalGeneratingInStorage && !generatingMetals[metalPayload] && !metalsSseRef.current) {
          console.log(`[Metal Generation Restore] Re-triggering metal generation for variant ${targetVariantId} on metal ${metalPayload}`);
          handleMetalChange(metalId, metalPayload, true);
        } else if (hasMetalImg && isMetalGeneratingInStorage) {
          localStorage.removeItem(metalKey);
          sessionStorage.removeItem(metalKey);
        }
      } catch (e) { }
    });
  }, [requestId, variantId, selectedVariant, activeMetal, variantHistoryLoading, isCompleted, reduxAccessToken, hasAngles, metalDataByVariantId, parsedMetalVariations]);

  // Automatically trigger get more angles if main image is ready but angles are not yet generated
  // DISABLED: User requested to only trigger angles generation manually on click.
  /*
  useEffect(() => {
    if (isCompleted) return;
    // Do not auto-trigger angles generation for other metals on switch
    if (activeMetal !== baseMetalId) return;
    // If we are currently loading or generating, wait
    const anyMetalGenerating = Object.values(generatingMetals).some(Boolean);
    if (anyMetalGenerating || anglesGenerating || metalsGlobalLoading || anglesLoading || variantHistoryLoading) return;

    // Only run if the main image for the selected metal is fully generated and ready
    const isSelectedMetalReady = activeMetal === baseMetalId || Boolean(backendMainImage || displayMainImageFromMetal);
    if (!isSelectedMetalReady || !displayMainImage) return;

    // We only auto-generate angles for a metal if the variant has already had angles generated at least once (baseHasAngles is true)
    // and no angles exist for any metal yet (to prevent auto-triggering on existing generated variations).
    const goldAnglesExist = parsedAnglesJson?.gold && Object.keys(parsedAnglesJson.gold).length > 0;
    const hasStoredAnglesAny = variantKey ? Object.values(byVariantId[variantKey] ?? {}).some((arr) => arr && arr.length > 0) : false;
    const hasAnglesFromApiAny = Object.values(anglesFromApi).some((arr) => arr && arr.length > 0);

    const anyMetalHasAngles = Boolean(
      (parsedAnglesJson && Object.keys(parsedAnglesJson).some(
        (metal) => parsedAnglesJson[metal] && Object.keys(parsedAnglesJson[metal]).length > 0
      )) ||
      hasStoredAnglesAny ||
      hasAnglesFromApiAny
    );

    const baseHasAngles = (request?.angles && request.angles.length > 0) || (normalizedInitialAngles.length > 0);

    const candidateIds = [variantId, selectedVariant?.id, variantHistory?.[0]?.id];
    let realVariantId: number | null = null;
    for (const cid of candidateIds) {
      if (cid && !isNaN(Number(cid))) {
        realVariantId = Number(cid);
        break;
      }
    }

    if (baseHasAngles && !hasAngles && !anyMetalHasAngles && realVariantId) {
      handleGetMoreAngles();
    }
  }, [activeMetal, backendMainImage, displayMainImageFromMetal, displayMainImage, hasAngles, generatingMetal, anglesGenerating, metalsGlobalLoading, anglesLoading, variantHistoryLoading, storedAngles, normalizedInitialAngles, request?.angles, anglesFromApi, selectedVariant, parsedAnglesJson, isCompleted]);
  */

  const handleRefresh = () => {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 700);
  };

  // Listen for design generation or refinement SSE stream when request status is 'Generating'
  useEffect(() => {
    if (!isGenerating) return;

    if (!realDesignId) {
      console.warn("No valid numeric design ID available for SSE stream");
      return;
    }

    const channel = (resolvedVariantIdForKey && isRefinement)
      ? `variant:${resolvedVariantIdForKey}`
      : `design_${realDesignId}`;

    const sseKey = `${channel}|${String(requestId)}`;

    const connDesignId = realDesignId;

    let isFinished = false;
    let currentRetry = 0;
    const maxRetries = 5;
    let isCompletedCalled = false;

    const handleComplete = (payload: any) => {
      isFinished = true;
      const baseImageUrl = payload?.base_image_url as string | undefined;
      const imageUrl =
        baseImageUrl ||
        (payload?.image_url as string | undefined) ||
        (payload?.url as string | undefined) ||
        (payload?.mainImage as string | undefined) ||
        (payload?.image as string | undefined) ||
        (payload?.input_image_url as string | undefined) ||
        (payload?.input_image_urls?.[0] as string | undefined) ||
        (payload?.variant?.base_image_url as string | undefined) ||
        (payload?.variant?.image_url as string | undefined) ||
        (payload?.variant?.url as string | undefined) ||
        (payload?.variant?.mainImage as string | undefined) ||
        (payload?.variant?.image as string | undefined) ||
        (payload?.variants?.[0]?.image_url as string | undefined) ||
        (payload?.variants?.[0]?.url as string | undefined) ||
        (payload?.variants?.[0]?.base_design_image_url as string | undefined);

      const returnedVariantId = payload?.variant_id ?? payload?.variant?.id ?? payload?.id ?? payload?.data?.variant_id ?? payload?.data?.id ?? payload?.variants?.[0]?.id;

      if (activeDesignSseConnections[sseKey]) {
        activeDesignSseConnections[sseKey].onComplete({ imageUrl, returnedVariantId });
      }

      delete activeDesignSseConnections[sseKey];
    };

    const handleFailure = (errorMessage: string) => {
      isFinished = true;
      if (activeDesignSseConnections[sseKey]) {
        activeDesignSseConnections[sseKey].onFailure(errorMessage);
      }
      delete activeDesignSseConnections[sseKey];
    };

    // If connection already exists in background cache, update callbacks and do not reconnect
    if (activeDesignSseConnections[sseKey]) {
      console.log('[SSE Debug] SSE connection already active in background for key:', sseKey);

      activeDesignSseConnections[sseKey].onComplete = ({ imageUrl, returnedVariantId }) => {
        isFinished = true;
        const currentChannel = (resolvedVariantIdForKey && isRefinement)
          ? `variant:${resolvedVariantIdForKey}`
          : `design_${realDesignId}`;
        const currentSseKey = `${currentChannel}|${String(requestId)}`;
        const isCurrentlyActive = connDesignId && String(connDesignId) === String(activeDesignIdGlobal);

        if (currentSseKey === sseKey && isCurrentlyActive) {
          if (imageUrl) {
            setSseGeneratedMainImage(imageUrl);
          }
          if (returnedVariantId) {
            setSseGeneratedVariantId(returnedVariantId);
          }
          setDesignSseLoading(false);
        }

        if (isCurrentlyActive) {
          dispatch(fetchVariantsByDesignId({ designId: String(connDesignId) }));
          const finalVariantId = returnedVariantId || resolvedVariantIdForKey;
          if (finalVariantId) {
            console.log('[SSE Debug] Fetching single variant after SSE completion:', finalVariantId);
            dispatch(fetchVariantById({ variantId: finalVariantId }));
          }
        }
        onRenderingCompleteRef.current?.(String(connDesignId));
      };

      activeDesignSseConnections[sseKey].onFailure = (errorMessage) => {
        isFinished = true;
        const currentChannel = (resolvedVariantIdForKey && isRefinement)
          ? `variant:${resolvedVariantIdForKey}`
          : `design_${realDesignId}`;
        const currentSseKey = `${currentChannel}|${String(requestId)}`;
        const isCurrentlyActive = connDesignId && String(connDesignId) === String(activeDesignIdGlobal);

        if (currentSseKey === sseKey && isCurrentlyActive) {
          setDesignSseLoading(false);
          setGenerationError(errorMessage);
        }
        if (isCurrentlyActive) {
          toast.error(errorMessage);
        }
        onRenderingFailedRef.current?.(errorMessage, String(connDesignId));
      };

      setDesignSseLoading(true);
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    const sseUrl = `${backendUrl}/api/v2/endpoints/sse/stream/${channel}`;
    const accessToken = getAccessToken();

    if (!accessToken) {
      console.error('No access token available for design generation SSE');
      return;
    }

    setDesignSseLoading(true);

    const sseFailureHandler = (errorMessage: string) => {
      if (isCompletedCalled) return;
      isCompletedCalled = true;
      isFinished = true;

      if (designSseRef.current) {
        designSseRef.current.abort();
      }

      if (typeof window !== 'undefined') {
        const pKey = resolvedVariantIdForKey && isRefinement
          ? `render_progress_variant_${resolvedVariantIdForKey}`
          : `render_progress_design_${realDesignId}`;
        localStorage.removeItem(pKey);
      }
      if (realDesignId) {
        try {
          localStorage.removeItem(`refinement_generating_${realDesignId}`);
          localStorage.removeItem(`refinement_variant_id_${realDesignId}`);
          sessionStorage.removeItem(`refinement_generating_${realDesignId}`);
          sessionStorage.removeItem(`refinement_variant_id_${realDesignId}`);
        } catch (e) { }
      }

      handleFailure(errorMessage);
    };

    const sseCompleteHandler = async (payload?: any) => {
      if (isCompletedCalled) return;
      isCompletedCalled = true;
      isFinished = true;

      if (designSseRef.current) {
        designSseRef.current.abort();
      }

      if (typeof window !== 'undefined') {
        const pKey = resolvedVariantIdForKey && isRefinement
          ? `render_progress_variant_${resolvedVariantIdForKey}`
          : `render_progress_design_${realDesignId}`;
        localStorage.removeItem(pKey);
      }
      if (realDesignId) {
        try {
          localStorage.removeItem(`refinement_generating_${realDesignId}`);
          localStorage.removeItem(`refinement_variant_id_${realDesignId}`);
          sessionStorage.removeItem(`refinement_generating_${realDesignId}`);
          sessionStorage.removeItem(`refinement_variant_id_${realDesignId}`);
        } catch (e) { }
      }

      handleComplete(payload);
    };

    const handleSseEvent = (eventName: string, dataText: string) => {
      try {
        const parsed = JSON.parse(dataText);
        const payload = parsed?.data ?? parsed;
        const eventType = parsed?.event || eventName;

        if (
          eventType === 'design.failed' ||
          eventType === 'variant.failed' ||
          payload?.status?.toLowerCase() === 'failed'
        ) {
          const errorMsg = payload?.error || payload?.message || "Generation failed";
          sseFailureHandler(errorMsg);
          return;
        }

        const hasImageUrl = Boolean(
          payload?.base_image_url ||
          payload?.image_url ||
          payload?.url ||
          payload?.mainImage ||
          payload?.image ||
          payload?.variant?.base_image_url ||
          payload?.variant?.image_url ||
          payload?.variant?.url ||
          payload?.variant?.mainImage ||
          payload?.variant?.image ||
          payload?.variants?.[0]?.image_url ||
          payload?.variants?.[0]?.url ||
          payload?.variants?.[0]?.base_design_image_url
        );

        const isSuccess =
          eventType === 'design.generated' ||
          eventType === 'variant.generated' ||
          eventType === 'generated_metals' ||
          eventType === 'variant.metals.generated' ||
          payload?.status?.toLowerCase() === 'completed' ||
          payload?.status?.toLowerCase() === 'generated' ||
          payload?.status?.toLowerCase() === 'success' ||
          payload?.variant?.status?.toLowerCase() === 'completed' ||
          payload?.variant?.status?.toLowerCase() === 'generated' ||
          payload?.variant?.status?.toLowerCase() === 'success' ||
          hasImageUrl;

        if (isSuccess) {
          sseCompleteHandler(payload);
        }
      } catch (err) { }
    };

    const connectSse = async () => {
      if (isFinished) return;

      const controller = new AbortController();
      designSseRef.current = controller;

      activeDesignSseConnections[sseKey] = {
        controller,
        sseKey,
        onComplete: ({ imageUrl, returnedVariantId }) => {
          const currentChannel = (resolvedVariantIdForKey && isRefinement)
            ? `variant:${resolvedVariantIdForKey}`
            : `design_${realDesignId}`;
          const currentSseKey = `${currentChannel}|${String(requestId)}`;
          const isCurrentlyActive = connDesignId && String(connDesignId) === String(activeDesignIdGlobal);

          if (currentSseKey === sseKey && isCurrentlyActive) {
            if (imageUrl) {
              setSseGeneratedMainImage(imageUrl);
            }
            if (returnedVariantId) {
              setSseGeneratedVariantId(returnedVariantId);
            }
            setDesignSseLoading(false);
          }

          if (isCurrentlyActive) {
            dispatch(fetchVariantsByDesignId({ designId: String(connDesignId) }));
            const finalVariantId = returnedVariantId || resolvedVariantIdForKey;
            if (finalVariantId) {
              console.log('[SSE Debug] Fetching single variant after SSE completion:', finalVariantId);
              dispatch(fetchVariantById({ variantId: finalVariantId }));
            }
          }
          onRenderingCompleteRef.current?.(String(connDesignId));
        },
        onFailure: (errorMessage) => {
          const currentChannel = (resolvedVariantIdForKey && isRefinement)
            ? `variant:${resolvedVariantIdForKey}`
            : `design_${realDesignId}`;
          const currentSseKey = `${currentChannel}|${String(requestId)}`;
          const isCurrentlyActive = connDesignId && String(connDesignId) === String(activeDesignIdGlobal);

          if (currentSseKey === sseKey && isCurrentlyActive) {
            setDesignSseLoading(false);
            setGenerationError(errorMessage);
          }
          if (isCurrentlyActive) {
            toast.error(errorMessage);
          }
          onRenderingFailedRef.current?.(errorMessage, String(connDesignId));
        }
      };

      try {
        const response = await fetch(sseUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let currentEvent = '';
        let currentData: string[] = [];

        const flush = () => {
          if (!currentData.length) return;
          const dataText = currentData.join('\n');
          handleSseEvent(currentEvent || 'message', dataText);
          currentEvent = '';
          currentData = [];
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trimEnd();
            if (!trimmed) {
              flush();
              continue;
            }
            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.slice(6).trim();
              continue;
            }
            if (trimmed.startsWith('data:')) {
              currentData.push(trimmed.slice(5).trim());
            }
          }
        }

        // If the stream closed cleanly but we aren't done and not aborted, auto-reconnect!
        if (!isFinished && !controller.signal.aborted) {
          if (currentRetry < maxRetries) {
            currentRetry++;
            console.log(`[Design SSE Debug] SSE stream closed cleanly. Reconnecting (attempt ${currentRetry}/${maxRetries})...`);
            setTimeout(connectSse, 1500);
          } else {
            console.warn('[Design SSE Debug] Max SSE retries reached. Assuming generation complete fallback.');
            sseFailureHandler('Design generation failed. Please try again.');
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('abort') || controller.signal.aborted) {
          return;
        }
        console.error('Design generation SSE stream failed:', err);

        if (!isFinished && !controller.signal.aborted && currentRetry < maxRetries) {
          currentRetry++;
          console.log(`[Design SSE Debug] SSE error caught. Reconnecting (attempt ${currentRetry}/${maxRetries})...`);
          setTimeout(connectSse, 2000);
        } else {
          if (!controller.signal.aborted) {
            sseFailureHandler('Design generation failed. Please try again.');
          }
        }
      }
    };

    connectSse();

    return () => {
      setDesignSseLoading(false);
    };
  }, [isGenerating, realDesignId, variantId, resolvedVariantIdForKey, requestId, reduxAccessToken, isRefinement, dispatch]);

  // Keep the latest isGenerating in a ref so the reconcile/poll effect below can read it WITHOUT
  // listing it as a dependency. fetchVariantsByDesignId briefly flips isGenerating (via
  // isSyncingVariants), so depending on isGenerating would re-mount the effect on every fetch and
  // fire an immediate re-fetch — the old "variants API called in a loop" bug. Writing a ref during
  // render is the React-sanctioned way to expose the latest value to a stable effect.
  const isGeneratingRef = useRef(isGenerating);
  isGeneratingRef.current = isGenerating;

  // Reconcile the render from the database so a finished render never stays stuck on the
  // "Generating" card. SSE completion events are fire-and-forget with no replay, so if the event
  // is missed (the stream dropped/reconnected during the render, or the user was away/logged-out)
  // the card would otherwise hang until a manual refresh. We re-fetch the variants (the SAME call
  // the SSE completion handler makes):
  //   - immediately on mount (covers a render that finished while away),
  //   - whenever the tab/window regains focus or visibility,
  //   - and via a gentle, bounded safety-net poll (every 15s) WHILE generating, which stops the
  //     instant the image arrives (isGenerating flips false → poll no-ops) or after a hard cap.
  // Effect deps are STABLE (realDesignId only) so it never re-mounts mid-render → no request loop.
  // Data-only: it does not change the UI — once the variant has an image, the existing logic shows it.
  useEffect(() => {
    if (!realDesignId) return;

    const reconcile = () => {
      dispatch(fetchVariantsByDesignId({ designId: String(realDesignId) }));
    };
    const reconcileIfGenerating = () => {
      if (isGeneratingRef.current) reconcile();
    };

    reconcileIfGenerating();

    const onFocus = () => reconcileIfGenerating();
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') reconcileIfGenerating();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    let polls = 0;
    const MAX_POLLS = 40; // 40 * 15s = ~10 min hard stop
    const intervalId = setInterval(() => {
      if (!isGeneratingRef.current) return; // idle (no fetch) when not generating
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(intervalId);
        return;
      }
      reconcile();
    }, 15000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(intervalId);
    };
  }, [realDesignId, dispatch]);

  const animateAngles = (angles: AngleView[]) => {
    const filtered = angles.filter((a) => a.id !== 'front');
    let idx = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    intervalRef.current = setInterval(() => {
      if (idx < filtered.length) {
        const currentIdx = idx;
        setGeneratedAngles((prev) => [...prev, filtered[currentIdx].id]);
        idx++;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setAnglesGenerating(false);
      }
    }, 900);
  };

  const handleMetalChange = async (metalId: string, metalPayloadValue: string, isRestore?: boolean | any) => {
    const isRestoreActual = isRestore === true;
    console.log('[Metal Change Debug] clicked:', { metalId, metalPayloadValue, isRestoreActual });
    setActiveMetal(metalId);
    setSelectedAngleId('best');

    if (metalId === baseMetalId) {
      console.log('[Metal Change Debug] Base metal clicked, exiting (base image, no regen).');
      return;
    }

    if (generatingMetals[metalPayloadValue] || subscribingMetalsRef.current[metalPayloadValue]) {
      console.log('[Metal Change Debug] Metal variation is already generating and SSE is open. Skipping duplicate call.');
      return;
    }

    subscribingMetalsRef.current[metalPayloadValue] = true;
    setGeneratingMetals(prev => ({ ...prev, [metalPayloadValue]: true }));

    const candidateIds = [variantId, sseGeneratedVariantId, selectedVariant?.id, variantHistory?.[0]?.id];
    let realVariantId: number | null = null;
    for (const cid of candidateIds) {
      if (cid && !isNaN(Number(cid))) {
        realVariantId = Number(cid);
        break;
      }
    }

    console.log('[Metal Change Debug] realVariantId resolved to:', realVariantId);

    if (!realVariantId) {
      console.warn('No valid numeric variant ID available for metal change');
      subscribingMetalsRef.current[metalPayloadValue] = false;
      setGeneratingMetals(prev => {
        const next = { ...prev };
        delete next[metalPayloadValue];
        return next;
      });
      return;
    }

    const targetVariantId = String(realVariantId);
    const sseKey = `metals:${targetVariantId}|${metalPayloadValue}|${requestId}`;

    const connTargetVariantId = targetVariantId;
    const connDesignId = realDesignId;
    const connMetal = metalPayloadValue;

    const onSseComplete = (payloadData: any) => {
      const mainImage = payloadData?.mainImage || payloadData?.url || payloadData?.image_url || payloadData?.image;
      const angleData = payloadData?.angles || payloadData?.generated_angles;
      const parsedAngles = Array.isArray(angleData) ? angleData.map((item: any, i: number) => ({
        id: String(item?.id ?? `angle-${i}`),
        label: item?.label ?? `View ${i + 1}`,
        image: item?.image ?? item?.url ?? ''
      })) : undefined;

      const isCurrentlyActive = connDesignId && String(connDesignId) === String(activeDesignIdGlobal);

      if (isCurrentlyActive) {
        if (mainImage || parsedAngles) {
          dispatch(setMetalGeneratedData({
            variantId: connTargetVariantId,
            metal: connMetal,
            data: { mainImage, angles: parsedAngles }
          }));
        }

        // Always refetch design history to sync variants list from the database variant API on completion
        if (connDesignId) {
          dispatch(fetchVariantsByDesignId({ designId: String(connDesignId) }));
        }

        // Smoothly display the newly generated metal variation by clearing the default gold image placeholder
        setSseGeneratedMainImage(null);
        setOverrideImage(null);
        setGeneratingMetal(null);
        setGeneratingMetals(prev => {
          const next = { ...prev };
          delete next[connMetal];
          return next;
        });
      }
      try {
        localStorage.removeItem(`metal_generating_${connTargetVariantId}_${connMetal}`);
        sessionStorage.removeItem(`metal_generating_${connTargetVariantId}_${connMetal}`);
      } catch (err) { }
    };

    const onSseFailure = (errorMessage: string) => {
      const isCurrentlyActive = connDesignId && String(connDesignId) === String(activeDesignIdGlobal);

      if (isCurrentlyActive) {
        setGeneratingMetal(null);
        setGeneratingMetals(prev => {
          const next = { ...prev };
          delete next[connMetal];
          return next;
        });
        toast.error(`Metal variation generation failed: ${errorMessage}`);
      }
      subscribingMetalsRef.current[connMetal] = false;
      setRequestedMetals(prev => prev.filter(m => m !== connMetal));
      try {
        localStorage.removeItem(`metal_generating_${connTargetVariantId}_${connMetal}`);
        sessionStorage.removeItem(`metal_generating_${connTargetVariantId}_${connMetal}`);
      } catch (err) { }
    };

    if (activeMetalsSseConnections[sseKey]) {
      console.log('[Metals SSE Debug] SSE connection already active in background for key:', sseKey);
      activeMetalsSseConnections[sseKey].onComplete = onSseComplete;
      activeMetalsSseConnections[sseKey].onFailure = onSseFailure;
      setGeneratingMetal(metalPayloadValue);
      setGeneratingMetals(prev => ({ ...prev, [metalPayloadValue]: true }));
      subscribingMetalsRef.current[metalPayloadValue] = true;
      return;
    }

    try {
      localStorage.setItem(`metal_generating_${targetVariantId}_${metalPayloadValue}`, 'true');
      sessionStorage.setItem(`metal_generating_${targetVariantId}_${metalPayloadValue}`, 'true');
    } catch (e) { }

    const mainGoldImage = selectedVariant?.base_image_url || selectedVariant?.image_url || selectedVariant?.url || selectedVariant?.mainImage || selectedVariant?.image || selectedVariant?.base_design_image_url;

    // Check if we already have it generated in Redux metalDataByVariantId or in selectedVariant
    const existingInRedux = metalDataByVariantId[targetVariantId]?.[metalPayloadValue];
    const existingInBackend = parsedMetalVariations?.[metalPayloadValue];

    const hasExistingBackendImage = existingInBackend && (
      (typeof existingInBackend === 'string' &&
        existingInBackend.length > 0 &&
        existingInBackend !== 'null' &&
        existingInBackend !== 'None' &&
        existingInBackend !== 'undefined' &&
        existingInBackend !== mainGoldImage &&
        !existingInBackend.startsWith('{') &&
        (existingInBackend.startsWith('http') || existingInBackend.startsWith('/') || existingInBackend.includes('/') || existingInBackend.includes('.'))) ||
      (typeof existingInBackend === 'object' && (
        (existingInBackend.mainImage && typeof existingInBackend.mainImage === 'string' && existingInBackend.mainImage.length > 0 && existingInBackend.mainImage !== 'null' && existingInBackend.mainImage !== mainGoldImage) ||
        (existingInBackend.url && typeof existingInBackend.url === 'string' && existingInBackend.url.length > 0 && existingInBackend.url !== 'null' && existingInBackend.url !== mainGoldImage) ||
        (existingInBackend.image_url && typeof existingInBackend.image_url === 'string' && existingInBackend.image_url.length > 0 && existingInBackend.image_url !== 'null' && existingInBackend.image_url !== mainGoldImage)
      ))
    );

    if (existingInRedux?.mainImage || hasExistingBackendImage) {
      console.log('[Metal Change Debug] Metal variation already exists! Skipping API generation and displaying image.');
      setSseGeneratedMainImage(null);
      setOverrideImage(null);
      subscribingMetalsRef.current[metalPayloadValue] = false;
      setGeneratingMetals(prev => {
        const next = { ...prev };
        delete next[metalPayloadValue];
        return next;
      });
      try {
        localStorage.removeItem(`metal_generating_${targetVariantId}_${metalPayloadValue}`);
        sessionStorage.removeItem(`metal_generating_${targetVariantId}_${metalPayloadValue}`);
      } catch (e) { }
      return;
    }

    const isAlreadyRequested = requestedMetals.includes(metalPayloadValue);
    if (!isAlreadyRequested && !isRestoreActual) {
      try {
        console.log('[Metal Change Debug] Proceeding to dispatch generateVariantMetals thunk with variantId:', targetVariantId);
        // Call the thunk to trigger backend generation
        const resultAction = await dispatch(generateVariantMetals({ variantId: targetVariantId, metals: [metalPayloadValue] }));
        if (generateVariantMetals.rejected.match(resultAction)) {
          const errorMsg = (resultAction.payload as string) || 'Metal variation generation failed.';
          toast.error(errorMsg);
          // Clean up states and return so SSE doesn't run!
          subscribingMetalsRef.current[metalPayloadValue] = false;
          setGeneratingMetals(prev => {
            const next = { ...prev };
            delete next[metalPayloadValue];
            return next;
          });
          try {
            localStorage.removeItem(`metal_generating_${targetVariantId}_${metalPayloadValue}`);
            sessionStorage.removeItem(`metal_generating_${targetVariantId}_${metalPayloadValue}`);
          } catch (e) { }
          return;
        }
        setRequestedMetals(prev => [...prev, metalPayloadValue]);
      } catch (err: any) {
        toast.error(err?.message || 'Metal variation generation failed.');
        subscribingMetalsRef.current[metalPayloadValue] = false;
        setGeneratingMetals(prev => {
          const next = { ...prev };
          delete next[metalPayloadValue];
          return next;
        });
        try {
          localStorage.removeItem(`metal_generating_${targetVariantId}_${metalPayloadValue}`);
          sessionStorage.removeItem(`metal_generating_${targetVariantId}_${metalPayloadValue}`);
        } catch (e) { }
        return;
      }
    }

    setGeneratingMetal(metalPayloadValue);

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    const channel = `metal_variants:${targetVariantId}`;
    const sseUrl = `${backendUrl}/api/v2/endpoints/sse/stream/${channel}`;
    const accessToken = getAccessToken();

    if (!accessToken) {
      console.error('No access token available for SSE stream');
      setGeneratingMetal(null);
      subscribingMetalsRef.current[metalPayloadValue] = false;
      setGeneratingMetals(prev => {
        const next = { ...prev };
        delete next[metalPayloadValue];
        return next;
      });
      return;
    }

    const controller = new AbortController();
    metalsSseRef.current = controller;

    activeMetalsSseConnections[sseKey] = {
      controller,
      sseKey,
      onComplete: onSseComplete,
      onFailure: onSseFailure,
    };

    let isFinished = false;

    const handleComplete = async (e: any) => {
      let isDone = false;
      let payloadData: any = {};
      try {
        const data = typeof e === 'string' ? JSON.parse(e) : e;
        const status = (data?.status || '').toLowerCase();

        if (
          status === 'all metal variants generated!' ||
          status === 'completed' ||
          status === 'generated' ||
          status === 'success' ||
          Boolean(data?.mainImage || data?.url || data?.image_url || data?.angles || data?.generated_angles) ||
          data?.event === 'generated_metals' ||
          data?.type === 'generated_metals' ||
          data?.event === 'variant.metals.generated' ||
          data?.type === 'variant.metals.generated'
        ) {
          isDone = true;
          payloadData = data.data || data;
        }
      } catch (err) { }

      if (!isDone) return;
      if (activeMetalsSseConnections[sseKey]?.controller !== controller) return; // Prevent duplicate execution

      isFinished = true;
      controller.abort();
      if (metalsSseRef.current === controller) metalsSseRef.current = null;

      if (activeMetalsSseConnections[sseKey]) {
        activeMetalsSseConnections[sseKey].onComplete(payloadData);
      }
      delete activeMetalsSseConnections[sseKey];
    };

    const handleFailure = (errorMessage: string) => {
      if (activeMetalsSseConnections[sseKey]?.controller !== controller) return;

      isFinished = true;
      controller.abort();
      if (metalsSseRef.current === controller) metalsSseRef.current = null;

      if (activeMetalsSseConnections[sseKey]) {
        activeMetalsSseConnections[sseKey].onFailure(errorMessage);
      }
      delete activeMetalsSseConnections[sseKey];
    };

    const maxRetries = 5;
    let currentRetry = 0;

    const connectSse = async () => {
      if (controller.signal.aborted || isFinished) return;

      try {
        const response = await fetch(sseUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let currentEvent = '';
        let currentData: string[] = [];

        const flush = () => {
          if (!currentData.length) return;
          const dataText = currentData.join('\n');

          let eventPayload = dataText;
          try {
            const parsed = JSON.parse(dataText);
            eventPayload = parsed?.data ?? parsed;
            const eventType = parsed?.event || currentEvent;
            const eventPayloadObject = eventPayload && typeof eventPayload === 'object' ? eventPayload as { status?: string; error?: unknown; message?: unknown } : null;

            const isSuccess =
              eventType === 'generated_metals' ||
              eventType === 'variant.metals.generated' ||
              eventType === 'message' ||
              !eventType ||
              (eventPayloadObject && (
                eventPayloadObject.status?.toLowerCase() === 'completed' ||
                eventPayloadObject.status?.toLowerCase() === 'generated' ||
                eventPayloadObject.status?.toLowerCase() === 'success' ||
                Boolean((eventPayloadObject as any).mainImage || (eventPayloadObject as any).url || (eventPayloadObject as any).image_url)
              ));

            if (isSuccess || eventType === 'variant.metals.failed' || eventPayloadObject?.status?.toLowerCase() === 'failed') {
              if (eventType === 'variant.metals.failed' || eventPayloadObject?.status?.toLowerCase() === 'failed') {
                const errorMsg = String(eventPayloadObject?.error || eventPayloadObject?.message || "Metal variation generation failed");
                handleFailure(errorMsg);
                return;
              }
              if (eventType === 'generated_metals' || eventType === 'variant.metals.generated') {
                handleComplete({ type: 'generated_metals', data: eventPayload });
              } else {
                handleComplete(eventPayload);
              }
            }
          } catch (err) {
            handleComplete(eventPayload);
          }

          currentEvent = '';
          currentData = [];
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trimEnd();
            if (!trimmed) {
              flush();
              continue;
            }
            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.slice(6).trim();
              continue;
            }
            if (trimmed.startsWith('data:')) {
              currentData.push(trimmed.slice(5).trim());
            }
          }
        }

        // If the stream closed cleanly but we aren't done and not aborted, auto-reconnect!
        if (!isFinished && !controller.signal.aborted) {
          if (currentRetry < maxRetries) {
            currentRetry++;
            console.log(`[Metal Change Debug] SSE stream closed cleanly. Reconnecting (attempt ${currentRetry}/${maxRetries})...`);
            setTimeout(connectSse, 1500);
          } else {
            console.warn('[Metal Change Debug] Max SSE retries reached. Assuming generation complete fallback.');
            handleComplete({ type: 'generated_metals' });
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('abort') || controller.signal.aborted) {
          if (metalsSseRef.current === controller) {
            subscribingMetalsRef.current[metalPayloadValue] = false;
            setGeneratingMetals(prev => {
              const next = { ...prev };
              delete next[metalPayloadValue];
              return next;
            });
          }
          return;
        }

        console.error('Metals SSE stream failed:', err);

        if (!isFinished && !controller.signal.aborted && currentRetry < maxRetries) {
          currentRetry++;
          console.log(`[Metal Change Debug] SSE error caught. Reconnecting (attempt ${currentRetry}/${maxRetries})...`);
          setTimeout(connectSse, 2000);
        } else {
          const errorMsg = err.message || 'Metals stream failed';
          handleFailure(errorMsg);
        }
      }
    };

    connectSse();
  };

  const handleGetMoreAngles = async (isRestore?: boolean | any, overrideMetalPayload?: string) => {
    const isRestoreActual = isRestore === true;
    if (isCompleted) return;

    const selectedMetalPayload = overrideMetalPayload ?? metalOptions.find((m) => m.id === activeMetal)?.payloadValue ?? 'gold';

    const candidateIds = [variantId, sseGeneratedVariantId, selectedVariant?.id, variantHistory?.[0]?.id];
    let realVariantId: number | null = null;
    for (const cid of candidateIds) {
      if (cid && !isNaN(Number(cid))) {
        realVariantId = Number(cid);
        break;
      }
    }

    if (!realVariantId) {
      console.warn('No valid numeric variant ID available for angles generation');
      setAnglesGenerating(false);
      return;
    }

    const targetVariantId = String(realVariantId);
    const sseKey = `angles:${targetVariantId}|${selectedMetalPayload}|${requestId}`;

    const connTargetVariantId = targetVariantId;
    const connDesignId = realDesignId;
    const connMetal = selectedMetalPayload;

    let isFinished = false;
    let currentRetry = 0;
    const maxRetries = 5;

    const onSseComplete = async (e: any) => {
      isFinished = true;
      const isCurrentlyActive = connDesignId && String(connDesignId) === String(activeDesignIdGlobal);

      // Call the specific variant API to update backend logic directly after generating angles
      try {
        const variantRes = await axiosInstance.get(`/api/v2/design-variant/variants/${connTargetVariantId}`);
        const dataAngles = variantRes.data?.angles || variantRes.data?.generated_angles;

        if (isCurrentlyActive) {
          // Immediately hit variant history API to sync the newly generated angles to the parent views globally using the design ID
          if (connDesignId) {
            dispatch(fetchVariantsByDesignId({ designId: String(connDesignId) }));
          }

          // Update sseGeneratedMainImage with the newly returned image from the backend, or clear it to let backendMainImage take over
          const newMainImage = variantRes.data?.base_image_url || variantRes.data?.image_url || variantRes.data?.url || variantRes.data?.mainImage;
          if (newMainImage) {
            setSseGeneratedMainImage(newMainImage);
          } else {
            setSseGeneratedMainImage(null);
          }

          if (dataAngles && Array.isArray(dataAngles)) {
            const parsedAngles = dataAngles.map((item: any, i: number) => ({
              id: String(item?.id ?? `angle-${i}`),
              label: item?.label ?? `View ${i + 1}`,
              image: item?.image ?? item?.url ?? ''
            })).filter(a => a.image);

            setAnglesFromApi(prev => ({ ...prev, [connMetal]: parsedAngles }));
            onAnglesLoaded?.(parsedAngles);
            animateAngles(parsedAngles);
          } else {
            setAnglesGenerating(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch specific variant after angles generation:', err);
        if (isCurrentlyActive) {
          setAnglesGenerating(false);
        }
      }
      try {
        localStorage.removeItem(`angles_generating_${connTargetVariantId}_${connMetal}`);
        sessionStorage.removeItem(`angles_generating_${connTargetVariantId}_${connMetal}`);
      } catch (err) { }
    };

    const onSseFailure = (errorMessage: string) => {
      isFinished = true;
      const isCurrentlyActive = connDesignId && String(connDesignId) === String(activeDesignIdGlobal);

      if (isCurrentlyActive) {
        setAnglesGenerating(false);
        toast.error(`Angles generation failed: ${errorMessage}`);
      }
      try {
        localStorage.removeItem(`angles_generating_${connTargetVariantId}_${connMetal}`);
        sessionStorage.removeItem(`angles_generating_${connTargetVariantId}_${connMetal}`);
      } catch (err) { }
    };

    if (activeAnglesSseConnections[sseKey]) {
      console.log('[Angles SSE Debug] SSE connection already active in background for key:', sseKey);
      activeAnglesSseConnections[sseKey].onComplete = onSseComplete;
      activeAnglesSseConnections[sseKey].onFailure = onSseFailure;
      setGeneratingAnglesMetal(selectedMetalPayload);
      setAnglesGenerating(true);
      setAnglesVisible(true);
      return;
    }

    setGeneratingAnglesMetal(selectedMetalPayload);
    setAnglesGenerating(true);
    setAnglesVisible(true);

    try {
      localStorage.setItem(`angles_generating_${targetVariantId}_${selectedMetalPayload}`, 'true');
      sessionStorage.setItem(`angles_generating_${targetVariantId}_${selectedMetalPayload}`, 'true');
    } catch (e) { }

    // Trigger the actual API request to begin server generation only if it is NOT a restore
    if (!isRestoreActual) {
      try {
        const resultAction = await dispatch(fetchVariantAngles({ variantId: targetVariantId, metals: [selectedMetalPayload] }));
        if (fetchVariantAngles.rejected.match(resultAction)) {
          const errorMsg = (resultAction.payload as string) || 'Angles generation failed.';
          toast.error(errorMsg);
          setAnglesGenerating(false);
          try {
            localStorage.removeItem(`angles_generating_${targetVariantId}_${selectedMetalPayload}`);
            sessionStorage.removeItem(`angles_generating_${targetVariantId}_${selectedMetalPayload}`);
          } catch (e) { }
          return;
        }
      } catch (err: any) {
        toast.error(err?.message || 'Angles generation failed.');
        setAnglesGenerating(false);
        try {
          localStorage.removeItem(`angles_generating_${targetVariantId}_${selectedMetalPayload}`);
          sessionStorage.removeItem(`angles_generating_${targetVariantId}_${selectedMetalPayload}`);
        } catch (e) { }
        return;
      }
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    const channel = `variant_angles:${targetVariantId}`;
    const sseUrl = `${backendUrl}/api/v2/endpoints/sse/stream/${channel}`;
    const accessToken = getAccessToken();

    if (!accessToken) {
      console.error('No access token available for SSE stream');
      setAnglesGenerating(false);
      try {
        localStorage.removeItem(`angles_generating_${targetVariantId}_${selectedMetalPayload}`);
        sessionStorage.removeItem(`angles_generating_${targetVariantId}_${selectedMetalPayload}`);
      } catch (e) { }
      return;
    }

    const connectSse = async () => {
      if (isFinished) return;

      const controller = new AbortController();
      sseRef.current = controller;

      activeAnglesSseConnections[sseKey] = {
        controller,
        sseKey,
        onComplete: onSseComplete,
        onFailure: onSseFailure,
      };

      const handleComplete = async (e: any, eventType?: string) => {
        let isDone = false;
        try {
          const data = typeof e === 'string' ? JSON.parse(e) : e;
          if (data && (data.status === 'All angles done' || data.status === 'GENERATED' || eventType === 'variant.angles.generated')) {
            isDone = true;
          }
        } catch (err) { }

        if (typeof e === 'object' && (e?.type === 'variant.angles.generated' || eventType === 'variant.angles.generated')) {
          isDone = true;
        }

        if (!isDone) return;
        if (activeAnglesSseConnections[sseKey]?.controller !== controller) return; // Prevent duplicate execution

        isFinished = true;
        controller.abort();
        if (sseRef.current === controller) sseRef.current = null;

        if (activeAnglesSseConnections[sseKey]) {
          activeAnglesSseConnections[sseKey].onComplete(e);
        }
        delete activeAnglesSseConnections[sseKey];
      };

      const handleFailure = (errorMessage: string) => {
        if (activeAnglesSseConnections[sseKey]?.controller !== controller) return;

        isFinished = true;
        controller.abort();
        if (sseRef.current === controller) sseRef.current = null;

        if (activeAnglesSseConnections[sseKey]) {
          activeAnglesSseConnections[sseKey].onFailure(errorMessage);
        }
        delete activeAnglesSseConnections[sseKey];
      };

      try {
        const response = await fetch(sseUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let currentEvent = '';
        let currentData: string[] = [];

        const flush = () => {
          if (!currentData.length) return;
          const dataText = currentData.join('\n');

          let eventPayload = dataText;
          try {
            const parsed = JSON.parse(dataText);
            eventPayload = parsed?.data ?? parsed;
            const eventType = parsed?.event || currentEvent;
            const eventPayloadObject = eventPayload && typeof eventPayload === 'object' ? eventPayload as { status?: string; error?: unknown; message?: unknown } : null;

            if (eventType === 'variant.angles.generated' || eventType === 'message' || eventType === 'variant.angles.failed' || eventPayloadObject?.status?.toLowerCase() === 'failed') {
              if (eventType === 'variant.angles.failed' || eventPayloadObject?.status?.toLowerCase() === 'failed') {
                const errorMsg = String(eventPayloadObject?.error || eventPayloadObject?.message || "Angles generation failed");
                handleFailure(errorMsg);
                return;
              }
              handleComplete(eventPayload, eventType);
            }
          } catch (err) {
            handleComplete(eventPayload, currentEvent);
          }

          currentEvent = '';
          currentData = [];
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trimEnd();
            if (!trimmed) {
              flush();
              continue;
            }
            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.slice(6).trim();
              continue;
            }
            if (trimmed.startsWith('data:')) {
              currentData.push(trimmed.slice(5).trim());
            }
          }
        }

        // If the stream closed cleanly but we aren't done and not aborted, auto-reconnect!
        if (!isFinished && !controller.signal.aborted) {
          if (currentRetry < maxRetries) {
            currentRetry++;
            console.log(`[Angles Generation Debug] SSE stream closed cleanly. Reconnecting (attempt ${currentRetry}/${maxRetries})...`);
            setTimeout(connectSse, 1500);
          } else {
            console.warn('[Angles Generation Debug] Max SSE retries reached. Assuming generation complete fallback.');
            handleComplete({ type: 'variant.angles.generated' }, 'variant.angles.generated');
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('abort') || controller.signal.aborted) {
          if (sseRef.current === controller) {
            setAnglesGenerating(false);
          }
          return;
        }

        console.error('Angles SSE stream failed:', err);

        if (!isFinished && !controller.signal.aborted && currentRetry < maxRetries) {
          currentRetry++;
          console.log(`[Angles Generation Debug] SSE error caught. Reconnecting (attempt ${currentRetry}/${maxRetries})...`);
          setTimeout(connectSse, 2000);
        } else {
          const errorMsg = err.message || 'Angles stream failed';
          handleFailure(errorMsg);
        }
      }
    };

    connectSse();
  };

  const handleDownload = (image: string, angleLabel: string) => {
    const metalObj = metalOptions.find((m) => m.id === activeMetal);
    const metalAbbr = metalObj?.abbr ?? 'YG';
    const viewCode = viewAbbr[angleLabel] ?? 'FV';
    const filename = `${requestId}-${(request?.type ?? 'unknown')}-${viewCode}-${metalAbbr}.jpg`;

    fetch(image)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        const a = document.createElement('a');
        a.href = image;
        a.download = filename;
        a.target = '_blank';
        a.click();
      });
  };

  const isCurrentMetalGenerating = Boolean(generatingMetals[activeMetalPayload]);
  const isThisMetalGeneratingAngles = generatingAnglesMetal === activeMetalPayload;
  const showAngleLoader = anglesGenerating && isThisMetalGeneratingAngles;
  const disableMoreAngles = isCompleted || anglesLoading || anglesGenerating;
  const hasMainImageForMetal = Boolean(backendMainImage || displayMainImageFromMetal);
  const applyFilterClass = (activeMetalObj?.id !== baseMetalId && !hasMainImageForMetal) ? activeMetalObj?.filterClass ?? '' : '';

  // Initialize GLightbox on client with proper React lifecycle and cleanup
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (typeof window === 'undefined') return;
      try {
        const GLightbox = (await import('glightbox')).default;
        await import('glightbox/dist/css/glightbox.css');
        if (!mounted) return;
        // destroy previous instance if any
        if (glightboxRef.current && typeof glightboxRef.current.destroy === 'function') {
          try { glightboxRef.current.destroy(); } catch (e) { /* ignore */ }
        }
        // initialize GLightbox with explicit elements so it doesn't depend on anchors
        const items = galleryImages.map((href) => ({ href, type: 'image' }));
        const instance = GLightbox({ elements: items, openEffect: 'fade', closeEffect: 'fade' } as any);
        glightboxRef.current = instance;
        (instance as any).on('slide_changed', ({ prev, current }: any) => {
          const slideIndex = current?.slideIndex;
          if (typeof slideIndex === 'number') {
            if (slideIndex === 0) {
              setSelectedAngleId('best');
            } else {
              const latestAngles = displayAnglesRef.current;
              const angle = latestAngles && latestAngles[slideIndex - 1];
              if (angle && angle.id) {
                setSelectedAngleId(angle.id);
              }
            }
          }
        });
        // debug log to confirm init
        // eslint-disable-next-line no-console
        console.log('GLightbox initialized for', `request-${requestId}`, items.length);
      } catch (e) {
        // don't break the app if GLightbox isn't installed yet
        // eslint-disable-next-line no-console
        console.warn('GLightbox init failed', e);
      }
    })();

    return () => {
      mounted = false;
      if (glightboxRef.current && typeof glightboxRef.current.destroy === 'function') {
        try { glightboxRef.current.destroy(); } catch (e) { /* ignore */ }
        glightboxRef.current = null;
      }
    };
  }, [requestId, galleryImages.join('|')]);

  if (generationError) {
    return (
      <div className="rounded-[24px] mb-4 flex-shrink-0 flex flex-col items-center justify-center bg-[#FEF2F2] dark:bg-red-950/20 border border-[#FECACA] dark:border-red-500/30 p-6 min-h-[220px] text-center shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)]">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-3">
          <i className="ri-error-warning-line text-[20px] text-red-600 dark:text-red-400" />
        </div>
        <h4 className="text-[14px] font-bold text-red-700 dark:text-red-400 mb-1.5 font-satoshi">
          Generation Failed
        </h4>
        <p className="text-[12.5px] text-red-600 dark:text-red-400 max-w-[340px] font-inter leading-relaxed">
          {generationError}
        </p>
      </div>
    );
  }

  if (!request || (!displayMainImage && !isGenerating)) {
    return (
      <div className="rounded-[24px] mb-4 flex-shrink-0 flex items-center justify-center bg-[#FAFAF8] dark:bg-surface-150 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-border-default min-h-[200px]">
        <span className="text-[13px] text-[#9CA3AF] dark:text-[#A1A8B3]">No render available</span>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-[24px] mb-4 flex-shrink-0 bg-[#FAFAF8] dark:bg-surface-150 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-border-default">
        {!isGenerating && (
          <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 flex items-center justify-between gap-3">
            <h3 className="text-[13px] sm:text-[14px] font-semibold text-[#1A1A1A] dark:text-ink font-satoshi">
              {selectedAngleId === 'best' ? 'Best View' : (displayAngles.find((a) => a && a.id === selectedAngleId)?.label || 'Best View')}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] sm:text-[11.5px] font-medium text-[#9CA3AF] dark:text-[#A1A8B3]">Metal</span>
              <div className="flex items-center gap-2">
                {metalOptions.map((metal) => {
                  const isThisMetalGenerating = Boolean(generatingMetals[metal.payloadValue]);
                  return (
                    <button
                      key={metal.id}
                      onClick={() => handleMetalChange(metal.id, metal.payloadValue)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-200 cursor-pointer hover:scale-110 text-white relative ${metal.bgClass} ${activeMetal === metal.id ? metal.ringClass : 'shadow-[0_1px_3px_rgba(0,0,0,0.15)]'}`}
                      title={metal.label}
                    >
                      {isThisMetalGenerating ? (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/25">
                          <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      ) : (
                        metal.initial
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="p-2">
            <RenderProgress progressKey={resolvedVariantIdForKey && isRefinement ? `variant_${resolvedVariantIdForKey}` : `design_${realDesignId}`} />
          </div>
        )}

        {!isGenerating && (
          <div className="px-4 sm:px-6 pb-5">
            <div className="flex gap-4 transition-all duration-500 max-sm:flex-col w-full">
              {/* Main preview */}
              {variantHistoryLoading && !displayMainImage ? (
                <div className={`relative overflow-hidden rounded-[18px] sm:flex-shrink-0 w-full ${(showAngleLoader || displayAngles.length > 0) ? 'sm:w-[calc(100%-148px)]' : 'sm:w-full'} aspect-square sm:[aspect-ratio:16/9] bg-gray-200 dark:bg-[#1E2530] animate-pulse border border-black/[0.04] dark:border-border-default`} />
              ) : (
                <div className={`relative overflow-hidden rounded-[18px] sm:flex-shrink-0 w-full ${(showAngleLoader || displayAngles.length > 0) ? 'sm:w-[calc(100%-148px)]' : 'sm:w-full'} transition-all duration-500 aspect-square sm:[aspect-ratio:16/9]`}>
                  <button
                    type="button"
                    className="glightbox block w-full h-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      // try GLightbox programmatic open, otherwise fallback to React modal
                      const idx = selectedAngleId === 'best'
                        ? 0
                        : 1 + displayAngles.findIndex((da) => da && da.id === selectedAngleId);
                      const resolvedIdx = idx >= 0 ? idx : 0;
                      try {
                        if (glightboxRef.current && typeof glightboxRef.current.openAt === 'function') {
                          glightboxRef.current.openAt(resolvedIdx);
                          return;
                        }
                        if (glightboxRef.current && typeof glightboxRef.current.open === 'function') {
                          glightboxRef.current.open();
                          return;
                        }
                      } catch (err) {
                        // ignore and fallback
                      }
                      setModalIndex(resolvedIdx);
                      setModalOpen(true);
                    }}
                  >
                    <CrossfadeImage
                      key={requestId}
                      src={activePreviewImage}
                      alt={`${request.type} Render`}
                      className={`w-full h-full object-contain object-center ${applyFilterClass}`}
                      draggable={false}
                      requestId={requestId}
                    />
                  </button>
                  {/* <div className="absolute inset-0 bg-black/0 hover:bg-black/[0.04] transition-colors duration-200" /> */}
                  {/* <button
                    onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 dark:bg-surface-100/80 backdrop-blur-sm shadow-sm border border-black/[0.04] dark:border-border-default hover:bg-white dark:hover:bg-surface-150 transition-colors cursor-pointer"
                  >
                    <i className={`ri-refresh-line text-[13px] text-[#6B7280] dark:text-ink transition-transform ${spinning ? 'animate-spin' : ''}`} />
                  </button> */}

                  {isCurrentMetalGenerating && !hasMainImageForMetal && (
                    <div className="absolute inset-0 bg-black/25 dark:bg-black/40 backdrop-blur-[6px] flex flex-col items-center justify-center gap-3 transition-opacity duration-300">
                      {/* Premium pulsing glowing ring and spinner */}
                      <div className="relative w-14 h-14 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-white/20 dark:border-white/10 animate-pulse" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '0.8s' }} />
                        <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                          <i className="ri-magic-line text-lg text-white font-normal" />
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 px-4 text-center">
                        <span className="text-[13px] font-semibold text-white font-satoshi tracking-wide uppercase drop-shadow-sm">
                          Generating {activeMetalObj?.label || 'Metal'}...
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0.2s' }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0.3s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Angle tiles column */}
              {(showAngleLoader || displayAngles.length > 0) && (
                <div className="flex flex-row sm:flex-col w-full sm:w-[136px] gap-3 flex-shrink-0">
                  {showAngleLoader ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={`shimmer-${i}`}
                        className="relative rounded-[14px] overflow-hidden flex-1 border border-black/[0.04] dark:border-white/[0.08] aspect-square sm:aspect-auto sm:min-h-[80px] bg-[#E5E7EB] dark:bg-[#1E2530] animate-pulse"
                      >
                        <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 bg-gradient-to-t from-black/10 to-transparent">
                          <div className="h-2.5 w-12 bg-gray-300 dark:bg-[#2C3545] rounded"></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      {/* Best View Thumbnail */}
                      <div
                        onClick={() => setSelectedAngleId('best')}
                        className={`relative rounded-[14px] overflow-hidden flex-1 cursor-pointer group transition-all duration-500 border-2 aspect-square sm:aspect-auto sm:min-h-[80px] ${selectedAngleId === 'best'
                          ? 'border-blue-500 shadow-[0px_4px_16px_rgba(59,130,246,0.25)]'
                          : 'border-black/[0.04] dark:border-border-default'
                          }`}
                      >
                        <img
                          src={displayMainImage}
                          alt="Best View"
                          className={`w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-400 ${applyFilterClass}`}
                          draggable={false}
                        />
                        <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 bg-gradient-to-t from-black/35 to-transparent">
                          <span className="text-[9px] sm:text-[10px] font-semibold text-white block">Best View</span>
                        </div>
                      </div>

                      {/* Other Angle Views */}
                      {displayAngles.map((angle) => {
                        const isReady = Boolean(angle.image);
                        return (
                          <div
                            key={angle.id}
                            onClick={() => isReady && setSelectedAngleId(angle.id)}
                            className={`relative rounded-[14px] overflow-hidden flex-1 cursor-pointer group transition-all duration-500 border-2 aspect-square sm:aspect-auto sm:min-h-[80px] ${selectedAngleId === angle.id
                              ? 'border-blue-500 shadow-[0px_4px_16px_rgba(59,130,246,0.25)]'
                              : 'border-black/[0.04] dark:border-border-default'
                              } ${isReady ? 'opacity-100 translate-x-0' : 'opacity-60 translate-x-[6px]'}`}
                          >
                            {isReady ? (
                              <>
                                <img
                                  src={angle.image}
                                  alt={angle.label}
                                  className={`w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-400 ${applyFilterClass}`}
                                  draggable={false}
                                />
                                <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 bg-gradient-to-t from-black/35 to-transparent">
                                  <span className="text-[9px] sm:text-[10px] font-semibold text-white block">{angle.label}</span>
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#F3F4F6] dark:bg-surface-100">
                                <div className="w-4 h-4 border-2 border-[#D1D5DB] dark:border-border-default border-t-[#9CA3AF] rounded-full animate-spin" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Get More Angles CTA */}
            {!hasAngles && !showAngleLoader && (
              <div className="mt-3 flex justify-center">
                <button
                  onClick={handleGetMoreAngles}
                  disabled={disableMoreAngles}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[12.5px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap hover:opacity-90 active:scale-[0.98] bg-blue-500/10 text-blue-500 border border-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-layout-grid-line text-[13px]" />
                  </span>
                  {isCompleted ? 'Completed' : (anglesLoading ? 'Loading Angles...' : 'Get More Angles')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GLightbox initialized in a React useEffect above */}
      {/* Fallback React modal when GLightbox isn't available or fails */}
      {modalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 max-w-[90%] max-h-[90%]">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute -top-6 -right-6 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow"
              aria-label="Close preview"
            >
              <span className="ri-close-line text-lg" />
            </button>
            <div className="relative flex items-center justify-center bg-white p-4 rounded">
              <button
                onClick={() => setModalIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length)}
                className="absolute left-[-36px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow"
                aria-label="Previous"
              >
                <span className="ri-arrow-left-s-line text-lg" />
              </button>
              <img src={galleryImages[modalIndex]} alt="Preview" className="max-w-[80vw] max-h-[80vh] object-contain" />
              <button
                onClick={() => setModalIndex((i) => (i + 1) % galleryImages.length)}
                className="absolute right-[-36px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow"
                aria-label="Next"
              >
                <span className="ri-arrow-right-s-line text-lg" />
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
          .metal-filter-yellow { filter: sepia(35%) saturate(125%) hue-rotate(5deg) brightness(102%); }
          .metal-filter-white { filter: grayscale(25%) brightness(108%) contrast(105%); }
          .metal-filter-rose { filter: sepia(25%) saturate(115%) hue-rotate(-12deg) brightness(104%); }
        `}</style>
    </>
  );
}