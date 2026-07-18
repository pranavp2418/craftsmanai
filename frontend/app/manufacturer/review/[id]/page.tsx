'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchManufacturerPublicAccess,
  submitManufacturerQuote,
  type ManufacturerPublicAccessResponse,
  type ManufacturerPublicVariant,
} from '@/redux/slices/manufacturer/manufacturerSlice';
import ProductionHeader from './components/ProductionHeader';
import DesignImages from './components/DesignImages';
import OrderProgress from './components/OrderProgress';
import ProductionSpecifications from './components/ProductionSpecifications';
import QuoteForm from './components/QuoteForm';
import AnimatedLoader from '@/src/components/AnimatedLoader';

const formatDate = (iso: string | undefined) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const formatDateTime = (iso: string | undefined) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const normalizeToken = (tokenParam: string | string[] | undefined): string => {
  if (!tokenParam) return '';
  return Array.isArray(tokenParam) ? tokenParam[0] ?? '' : tokenParam;
};

const toNumber = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const MAX_PRODUCTION_NOTES_CHARS = 500;

const countCharacters = (value: string): number => value.length;

const limitCharacters = (value: string, maxChars: number): string => {
  return value.slice(0, maxChars);
};

const isLikelyImageUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^(https?:\/\/|\/|data:image\/)/i.test(trimmed);
};

const extractAngleImages = (source: unknown): string[] => {
  return flattenImages(source).slice(0, 3);
};

const flattenImages = (source: unknown): string[] => {
  if (!source) return [];
  if (typeof source === 'string') {
    if (isLikelyImageUrl(source)) return [source];
    try {
      const parsed = JSON.parse(source);
      return flattenImages(parsed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(source)) return source.flatMap((item) => flattenImages(item));
  if (typeof source === 'object') return Object.values(source as Record<string, unknown>).flatMap((item) => flattenImages(item));
  return [];
};

const pickSelectedVariant = (variants?: ManufacturerPublicVariant[]): ManufacturerPublicVariant | undefined => {
  if (!variants?.length) return undefined;
  return variants[0];
};

const getImageFileName = (url?: string | null): string | null => {
  if (!url) return null;

  const noQuery = url.split('?')[0] ?? url;
  const name = noQuery.split('/').pop();
  return name || 'Image File';
};

const deserializeMetadata = (notesStr: string) => {
  const defaultMeta: Record<string, string> = {
    metalWeight: '',
    hallmarkRequired: '',
    rhodiumFinish: '',
    stoneShape: '',
    stoneColor: '',
    stoneClarity: '',
    stoneCertificate: '',
    stoneSizeUnit: 'mm',
    chainLength: '',
    braceletLength: '',
    bangleSize: '',
    pendantBailWidth: '',
  };

  if (!notesStr) return { cleanNotes: '', metadata: defaultMeta };

  const separator = '--- METADATA ---';
  const parts = notesStr.split(separator);
  const cleanNotes = parts[0].trim();

  if (parts.length < 2) {
    return { cleanNotes, metadata: defaultMeta };
  }

  const metaBlock = parts[1];
  const lines = metaBlock.split('\n');
  const metadata = { ...defaultMeta };

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case 'Metal Weight':
        metadata.metalWeight = value;
        break;
      // case 'Hallmark Required':
      //   metadata.hallmarkRequired = value === 'Yes' || value === 'true' ? 'Yes' : '';
      //   break;
      // case 'Rhodium Finish':
      //   metadata.rhodiumFinish = value === 'Yes' || value === 'true' ? 'Yes' : '';
      //   break;
      case 'Stone Shape':
        metadata.stoneShape = value;
        break;
      case 'Stone Color':
        metadata.stoneColor = value;
        break;
      case 'Stone Clarity':
        metadata.stoneClarity = value;
        break;
      case 'Stone Certificate':
        metadata.stoneCertificate = value;
        break;
      case 'Stone Size Unit':
        metadata.stoneSizeUnit = value;
        break;
      case 'Chain Length':
        metadata.chainLength = value;
        break;
      case 'Bracelet Length':
        metadata.braceletLength = value;
        break;
      case 'Bangle Size':
        metadata.bangleSize = value;
        break;
      case 'Pendant Bail Width':
        metadata.pendantBailWidth = value;
        break;
    }
  }

  return { cleanNotes, metadata };
};

const mapProductionSheet = (sheet: Record<string, unknown>) => {
  const rawNotes = typeof sheet.manufacturing_notes === 'string' ? sheet.manufacturing_notes : '';
  const { cleanNotes, metadata } = deserializeMetadata(rawNotes);

  const metalDetails = (sheet.metal_details as Record<string, unknown> | undefined) ?? {};
  const cleanMetalDetails: Record<string, unknown> = { ...metalDetails };
  
  if (!cleanMetalDetails.metal_weight && metadata.metalWeight) {
    cleanMetalDetails.metal_weight = metadata.metalWeight;
  }

  if (cleanMetalDetails.weight && !cleanMetalDetails.metal_weight) {
    cleanMetalDetails.metal_weight = cleanMetalDetails.weight;
  }

  const stoneType = sheet.stone_type;
  const stoneCount = sheet.stone_count;
  const stoneSize = sheet.stone_size;
  const settingType = sheet.setting_type;

  const centerStone: Record<string, unknown> = {};
  if (stoneType) centerStone.type = stoneType;
  if (stoneCount !== null && stoneCount !== undefined) centerStone.count = stoneCount;

  
  const stoneSizeUnit = (sheet.stone_size_unit as string) || metadata.stoneSizeUnit || 'mm';
  if (stoneSize) {
    const sizeStr = String(stoneSize);
    if (!sizeStr.endsWith('mm') && !sizeStr.endsWith('ct')) {
      centerStone.size = `${sizeStr}${stoneSizeUnit}`;
    } else {
      centerStone.size = sizeStr;
    }
  }
  if (settingType) centerStone.setting = settingType;

  const stoneShape = (sheet.stone_shape as string) || metadata.stoneShape;
  const stoneColor = (sheet.stone_color as string) || metadata.stoneColor;
  const stoneClarity = (sheet.stone_clarity as string) || metadata.stoneClarity;
  const stoneCertificate = (sheet.stone_certificate as string) || metadata.stoneCertificate;

  if (stoneShape) centerStone.shape = stoneShape;
  if (stoneColor) centerStone.color = stoneColor;
  if (stoneClarity) centerStone.clarity = stoneClarity;
  if (stoneCertificate) centerStone.certificate = stoneCertificate;

  const dimension = (sheet.dimension as Record<string, unknown> | undefined) ?? {};
  const cleanDimension: Record<string, unknown> = { ...dimension };
  if (!cleanDimension.chain_length && metadata.chainLength) {
    cleanDimension.chain_length = metadata.chainLength;
  }
  if (!cleanDimension.bracelet_length && metadata.braceletLength) {
    cleanDimension.bracelet_length = metadata.braceletLength;
  }
  if (!cleanDimension.bangle_size && metadata.bangleSize) {
    cleanDimension.bangle_size = metadata.bangleSize;
  }
  if (!cleanDimension.pendant_bail_width && metadata.pendantBailWidth) {
    cleanDimension.pendant_bail_width = metadata.pendantBailWidth;
  }

  const manufacturingImage = typeof sheet.manufacturing_image === 'string' ? sheet.manufacturing_image : null;

  return {
    materialDetails: Object.keys(cleanMetalDetails).length > 0 ? cleanMetalDetails : undefined,
    stoneDetails: {
      center_stone: Object.keys(centerStone).length > 0 ? centerStone : undefined,
    },
    dimensions: Object.keys(cleanDimension).length > 0 ? cleanDimension : undefined,
    specificationDetails: undefined,
    specialInstructions: cleanNotes || null,
    fileUrl: manufacturingImage,
    fileName: getImageFileName(manufacturingImage),
  };
};

const mapReviewData = (accessData: ManufacturerPublicAccessResponse | null) => {
  const selectedVariant = pickSelectedVariant(accessData?.variants);
  const productionSheet = ((accessData as any)?.production_sheet ?? {}) as Record<string, unknown>;
  const baseDesignImage = selectedVariant?.base_design_image_url ?? accessData?.design?.input_image_url ?? null;
  const angleImages = extractAngleImages(selectedVariant?.angles_json);
  const productionSheetData = mapProductionSheet(productionSheet);
  const shareStatus = String(accessData?.share_status ?? '').toLowerCase();
  const hasShareStatus = Boolean(shareStatus);

  const isPending = shareStatus.includes('pending');
  const isQuoted = shareStatus.includes('quoted');
  const isUnderReview =
    shareStatus.includes('review') ||
    shareStatus.includes('under');
  const jobReceivedAt = selectedVariant?.created_at ?? '';

  const jobReceived = hasShareStatus
    ? isPending || isQuoted || isUnderReview
    : accessData?.order_progress?.job_received ?? Boolean(accessData?.design);
  const quoteSubmitted = hasShareStatus
    ? isQuoted || isUnderReview
    : accessData?.order_progress?.quote_submitted ?? false;
  const underReview = hasShareStatus
    ? isUnderReview
    : accessData?.order_progress?.under_review ?? false;
  const productionStarted = accessData?.order_progress?.production_started ?? false;

  return {
    title: accessData?.request_title ?? accessData?.design?.name ?? '',
    requestSku: accessData?.request_sku ?? accessData?.design?.design_code ?? '',
    companyName: accessData?.company_name ?? accessData?.design?.jewellery_type ?? '',
    lastUpdated: accessData?.last_updated_at
      ?? selectedVariant?.created_at
      ?? '',
    isNew: !(accessData?.order_progress?.quote_submitted ?? false),
    requestId: accessData?.request_id ?? String(accessData?.design?.design_id ?? ''),
    manufacturerId: accessData?.manufacturer_id ?? '',
    renderId: accessData?.render_id ?? String(selectedVariant?.id ?? ''),
    primaryImage: baseDesignImage ?? '',
    angleImages,
    productionSheetData,
    jobReceivedAt,
    orderProgress: {
      job_received: jobReceived,
      quote_submitted: quoteSubmitted,
      under_review: underReview || productionStarted,
      production_started: productionStarted,
    },
  };
};

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`rounded-card bg-gray-200 animate-pulse ${className}`} />;
}

function ProductionHeaderSkeleton() {
  return (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="space-y-2.5 flex-1">
          <SkeletonLine className="h-7 sm:h-8 md:h-9 w-3/4" />
          <SkeletonLine className="h-4 w-1/3" />
          <SkeletonLine className="h-4 w-1/2" />
          <SkeletonLine className="h-4 w-2/5" />
        </div>
        <SkeletonLine className="h-8 w-14 rounded-full shrink-0" />
      </div>
    </div>
  );
}

function DesignImagesSkeleton() {
  return (
    <div className="bg-white p-3.5 sm:p-4 md:p-4.5 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] h-full">
      <SkeletonLine className="h-6 w-36 mb-3 sm:mb-4" />
      <div className="flex gap-4 max-sm:flex-col w-full sm:pr-4">
        <SkeletonLine className="relative overflow-hidden rounded-[18px] sm:flex-shrink-0 w-full sm:w-[calc(100%-136px)] aspect-square sm:[aspect-ratio:16/9]" />
        <div className="flex flex-row sm:flex-col w-full sm:w-[136px] gap-3 flex-shrink-0">
          <SkeletonLine className="relative rounded-[14px] overflow-hidden flex-1 min-h-[80px]" />
          <SkeletonLine className="relative rounded-[14px] overflow-hidden flex-1 min-h-[80px]" />
          <SkeletonLine className="relative rounded-[14px] overflow-hidden flex-1 min-h-[80px]" />
          <SkeletonLine className="relative rounded-[14px] overflow-hidden flex-1 min-h-[80px]" />
        </div>
      </div>
    </div>
  );
}

function OrderProgressSkeleton() {
  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] w-full lg:h-full">
      <SkeletonLine className="h-5 w-32 mb-4 sm:mb-5 md:mb-6" />
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 sm:gap-4">
            <SkeletonLine className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 pt-1">
              <SkeletonLine className="h-4 w-28" />
              <SkeletonLine className="h-3 w-36" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductionSpecificationsSkeleton() {
  return (
    <div className="lg:col-span-2 bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
      <SkeletonLine className="h-5 w-56 mb-4 sm:mb-5 md:mb-6" />
      <div className="space-y-3 sm:space-y-3.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex justify-between items-start gap-4 py-1.5 sm:py-2 border-b border-gray-100 last:border-0">
            <SkeletonLine className="h-3.5 w-24" />
            <SkeletonLine className="h-3.5 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomRightSkeleton() {
  return (
    <div className="lg:col-span-2 bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
      <SkeletonLine className="h-5 w-32 mb-4 sm:mb-5" />
      <div className="space-y-3 sm:space-y-4">
        <SkeletonLine className="h-4 w-3/4" />
        <SkeletonLine className="h-4 w-11/12" />
        <SkeletonLine className="h-4 w-5/6" />
        <SkeletonLine className="h-4 w-2/3" />
      </div>
    </div>
  );
}

const cleanMetadataText = (text: string | null | undefined): string | null => {
  if (!text) return null;
  const separator = '--- METADATA ---';
  return text.split(separator)[0].trim();
};

export default function ManufacturerReviewPage() {
  const [loaderLoading, setLoaderLoading] = useState(true);
  const dispatch = useAppDispatch();
  const params = useParams();
  const token = normalizeToken(params?.id as string | string[] | undefined);
  const { data: accessData, loading, error, quoteStatus, quoteError } = useAppSelector((state) => state.manufacturerAccess);
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  useEffect(() => {
    // Hide loader after 5 seconds
    const timer = setTimeout(() => {
      setLoaderLoading(false);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!token) return;
    dispatch(fetchManufacturerPublicAccess({ token }));
  }, [dispatch, token]);

  const mapped = useMemo(() => (accessData ? mapReviewData(accessData) : null), [accessData]);
  const productionSheet = useMemo(
    () => ((accessData as any)?.production_sheet ?? {}) as Record<string, unknown>,
    [accessData]
  );

  const rawSpecialInstructions =
    mapped?.productionSheetData.specialInstructions ||
    (accessData?.share_comment ?? null) ||
    (typeof productionSheet.additional_notes === 'string' ? productionSheet.additional_notes : null);

  const specialInstructions = cleanMetadataText(rawSpecialInstructions);

  // const fileUrl =
  //   mapped?.productionSheetData.fileUrl ||
  //   (isLikelyImageUrl((productionSheet as any)?.image_url) ? (productionSheet as any).image_url : null) ||
  //   (isLikelyImageUrl((productionSheet as any)?.reference_image_url) ? (productionSheet as any).reference_image_url : null) ||
  //   (accessData?.design?.input_image_url ?? null);

  const fileUrl = accessData?.production_sheet?.manufacturing_image ?? null;

  // const fileName = mapped?.productionSheetData.fileName || getImageFileName(fileUrl);
  const fileName =
    getImageFileName(
      // @ts-ignore
      accessData?.production_sheet?.manufacturing_image ?? fileUrl
    ) ?? null;


  const images = mapped?.angleImages ?? [];
  const quoteSubmitted = mapped?.orderProgress.quote_submitted ?? quoteStatus === 'succeeded';
  const underReview = (mapped?.orderProgress.under_review ?? false) || (mapped?.orderProgress.production_started ?? false);
  const brandPrimaryColor = accessData?.brand_primary_color ?? '#3B82F6';
  const showPoweredBy = Boolean(accessData?.powered_by ?? accessData?.powered_by_craftsman_ai);
  const hasLoadError = Boolean(error) && !accessData;
  const showSkeletons =
    Boolean(token) &&
    !hasLoadError &&
    (!accessData || loading);
  const handleRetry = () => {
    if (!token) return;
    dispatch(fetchManufacturerPublicAccess({ token }));
  };

  const orderProgress = [
    {
      step: 'Job Received',
      completed: mapped?.orderProgress.job_received ?? false,
      current: !(mapped?.orderProgress.job_received ?? false),
      date: formatDateTime(mapped?.jobReceivedAt || undefined),
    },
    {
      step: 'Quote Submitted',
      completed: quoteSubmitted,
      current: (mapped?.orderProgress.job_received ?? false) && !quoteSubmitted,
    },
    {
      step: 'Under Review',
      completed: underReview,
      current: quoteSubmitted && !underReview,
    },
  ];

  const handleQuoteSubmit = async (quoteData: any) => {
    const shareToken = accessData?.public_token || token;
    if (!shareToken) {
      toast.error('Missing share token.');
      return false;
    }

    const timeValue = toNumber(quoteData?.estimatedTime);
    const costPrice = toNumber(quoteData?.manufacturingCost);
    if (!timeValue || !costPrice) {
      toast.error('Please add valid cost and delivery time.');
      return false;
    }

    const comments = String(quoteData?.comments ?? '').trim();
    // if (!comments) {
    //   toast.error('Please add production notes.');
    //   return false;
    // }
    if (countCharacters(comments) > MAX_PRODUCTION_NOTES_CHARS) {
      toast.error('Production notes must be 500 characters or fewer.');
      return false;
    }

    const timeUnit = String(quoteData?.timeUnit ?? 'Days').toLowerCase();
    const deliveryTimeDays =
      timeUnit.startsWith('week') ? Math.round(timeValue * 7) :
        timeUnit.startsWith('month') ? Math.round(timeValue * 30) :
          Math.round(timeValue);

    try {
      await dispatch(
        submitManufacturerQuote({
          share_token: shareToken,
          cost_price: costPrice,
          delivery_time_days: deliveryTimeDays,
          notes: limitCharacters(comments, MAX_PRODUCTION_NOTES_CHARS),
        })
      ).unwrap();

      return true;
    } catch (err: any) {
      toast.error(err || 'Failed to submit quote.');
      return false;
    }
  };

  const handleCancel = () => {
    setShowQuoteForm(false);
  };

  const refetchAfterSubmit = () => {
    setShowQuoteForm(false);
    handleRetry()
  }

  if (loaderLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#faf6f3]">
        <AnimatedLoader width={420} height={250} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat overflow-hidden overflow-y-auto"
      style={{
        // backgroundImage: 'url(/banner.png)',
        backgroundColor: '#EBF3FE'
      }}
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-200 fixed top-0 z-50 w-full">
        <div className="px-3 sm:px-4 md:px-6 lg:px-10 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Left - Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-full w-auto border border-transparent border-r-gray-300 pr-2 sm:pr-3">
                <img
                  src={accessData?.brand_logo_url ? accessData.brand_logo_url : `/logo_new.png`}
                  alt="Craftsman.ai"
                  className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
                />
              </div>
              <h1 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900">
                {showQuoteForm ? 'Quote' : 'Request'}
              </h1>
            </div>


          </div>
        </div>
      </header>

      {/* Conditional Content */}
      {hasLoadError ? (
        <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pb-2 md:pb-8 mt-16">
          <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
            <div className="w-full max-w-lg bg-white rounded-2xl md:rounded-[28px] shadow-[0px_16px_48px_rgba(0,0,0,0.12)] p-6 sm:p-8 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                Something went wrong
              </h2>
              <p className="mt-3 text-sm sm:text-base text-gray-600">
                We could not load this request right now.
              </p>
              <p className="mt-2 text-xs sm:text-sm text-red-600 break-words">
                {error}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-white font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: brandPrimaryColor }}
              >
                <RefreshCcw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        </main>
      ) : showQuoteForm ? (
        <QuoteForm
          productImage={mapped?.primaryImage ?? ''}
          title={mapped?.title ?? ''}
          requestSku={mapped?.requestSku ?? ''}
          companyName={mapped?.companyName ?? ''}
          lastUpdated={mapped?.lastUpdated ? formatDate(mapped.lastUpdated) : ''}
          isNew={mapped?.isNew ?? false}
          requestId={mapped?.requestId ?? ''}
          manufacturerId={mapped?.manufacturerId ?? ''}
          renderId={mapped?.renderId ?? ''}
          brandPrimaryColor={brandPrimaryColor}
          onCancel={handleCancel}
          onSubmit={handleQuoteSubmit}
          refetchAfterSubmit={refetchAfterSubmit}
        />
      ) : (
        <>
          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pb-2 md:pb-8 mt-16">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">

              {/* Production Header - Full Width */}
              <div className='lg:col-span-4'>
                {showSkeletons ? (
                  <ProductionHeaderSkeleton />
                ) : !mapped ? (
                  <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
                    <p className="text-sm sm:text-base text-gray-600">
                      {error ? 'Unable to load request details.' : 'No request data available yet.'}
                    </p>
                  </div>
                ) : (
                  <ProductionHeader
                    loading={loading}
                    title={mapped.title}
                    requestSku={String(mapped.requestSku)}
                    companyName={mapped.companyName}
                    lastUpdated={mapped.lastUpdated ? formatDate(mapped.lastUpdated) : ''}
                    isNew={mapped.isNew}
                  />
                )}
              </div>

              {/* Left Column - Design Images */}
              <div className="lg:col-span-3 space-y-4 sm:space-y-5 md:space-y-6">
                {showSkeletons ? (
                  <DesignImagesSkeleton />
                ) : mapped ? (
                  <DesignImages
                    loading={loading}
                    // @ts-ignore
                    initialImage={accessData?.variants[0]?.base_design_image_url ?? null}
                    images={images}
                  />
                ) : null}
              </div>

              {/* Right Column - Order Progress */}
              <div className="lg:col-span-1">
                {showSkeletons ? (
                  <OrderProgressSkeleton />
                ) : mapped ? (
                  <OrderProgress
                    loading={loading}
                    progress={orderProgress}
                    action={
                      !showSkeletons && !quoteSubmitted ? (
                        <button
                          onClick={() => setShowQuoteForm(true)}
                          disabled={loading || quoteStatus === 'loading'}
                          className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ backgroundColor: brandPrimaryColor }}
                        >
                          Proceed Quote
                        </button>
                      ) : null
                    }
                  />
                ) : null}
              </div>

              {/* Production Specifications - Full Width (Two Cards) */}
              {showSkeletons ? (
                <>
                  <ProductionSpecificationsSkeleton />
                  <BottomRightSkeleton />
                </>
              ) : mapped ? (
                <ProductionSpecifications
                  loading={loading}
                  materialDetails={mapped.productionSheetData.materialDetails}
                  stoneDetails={mapped.productionSheetData.stoneDetails as any}
                  dimensions={mapped.productionSheetData.dimensions}
                  specificationDetails={mapped.productionSheetData.specificationDetails}
                  specialInstructions={specialInstructions}
                  brandPrimaryColor={brandPrimaryColor}
                  // @ts-ignore
                  fileUrl={fileUrl}
                  fileName={fileName}
                />
              ) : (
                null
              )}

            </div>
          </main>

          {error && <p className="px-5 md:px-32 pb-4 text-sm text-red-600">{error}</p>}
          {quoteError && <p className="px-5 md:px-32 pb-4 text-sm text-red-600">{quoteError}</p>}
        </>
      )}

      {showPoweredBy && (
        <div className="px-3 sm:px-4 md:px-6 pb-4 md:pb-6 mt-2">
          <div className="max-w-7xl mx-auto flex justify-start">
            <p className="text-[11px] sm:text-xs font-medium text-gray-500">Powered by Craftsman.AI</p>
          </div>
        </div>
      )}
    </div>
  );
}
