'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  approveCustomerDesign,
  fetchCustomerPublicAccess,
  requestCustomerRefinement,
  type CustomerAccessResponse,
  type CustomerAccessVariant,
} from '@/redux/slices/customer/customerSlice';
import ProductionHeader from './components/ProductionHeader';
import DesignImages from './components/DesignImages';
import Specifications from './components/Specifications';
import OrderDetails from './components/OrderDetails';
import OrderProgress from './components/OrderProgress';
import AnimatedLoader from '@/src/components/AnimatedLoader';

const CUSTOMER_REVIEW_DATA = {
  renders: ['/images/req125.jpg', '/images/req126.jpg', '/images/req127.jpg'],
  order_details: {
    order_status: 'Review ready',
    order_id: '#ORD-2024-002',
    request_sku: '#ORD-2024-002',
    order_date: '2024-01-15T00:00:00.000Z',
    retailer_name: 'Elegant Jewels',
    manufacturer_name: 'Premium Crafts Ltd.',
  },
  specification: {
    Metal: '14K Yellow Gold',
    'Main Stone': 'Freshwater Pearls (8mm)',
    Clarity: 'AAA Grade',
    Color: 'White with Pink Overtones',
    Setting: 'Drop Style',
    Finish: 'High Polish',
  },
};

function normalizeToken(tokenParam: string | string[] | undefined): string {
  if (!tokenParam) return '';
  return Array.isArray(tokenParam) ? tokenParam[0] ?? '' : tokenParam;
}

function ensureHash(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  const str = String(value);
  return str.startsWith('#') ? str : `#${str}`;
}

function extractImages(source: unknown): string[] {
  if (!source) return [];
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractImages(parsed);
      } catch (e) { }
    }
    return source ? [source] : [];
  }
  if (Array.isArray(source)) return source.flatMap((item) => extractImages(item));
  if (typeof source === 'object') {
    return Object.values(source as Record<string, unknown>).flatMap((item) => extractImages(item));
  }
  return [];
}

function extractAngleImages(source: unknown): string[] {
  const angles = extractImages(source);
  return angles.slice(0, 3);
}

function getVariantImages(variant: CustomerAccessVariant): string[] {
  const images: string[] = [];
  images.push(...extractAngleImages(variant.angles_json));
  return images.filter(Boolean).slice(0, 3);
}

function mapStatus(access: CustomerAccessResponse | null): string | undefined {
  if (!access) return undefined;
  const raw = `${access.share_status ?? ''} ${access.design?.status ?? ''}`.trim().toLowerCase();

  if (raw.includes('production') || raw.includes('completed') || raw.includes('approved') || raw.includes('accepted') || raw.includes('accepted')) {
    return 'In Production';
  }
  if (raw.includes('await') || raw.includes('pending') || raw.includes('approval')) {
    return 'Awaiting Approval';
  }
  if (raw.includes('review') || raw.includes('draft')) {
    return 'Design review';
  }



  return access.require_approval ? 'Awaiting Approval' : 'Design review';
}

function mapCustomerAccessToView(access: CustomerAccessResponse | null) {
  // if (!access) return CUSTOMER_REVIEW_DATA;
  if (!access) return null;

  const variants = access.variants ?? [];
  const selectedVariant = variants[0];
  const images = selectedVariant ? Array.from(new Set(getVariantImages(selectedVariant))) : [];

  const designCode = access.design?.design_code;
  const designId = access.design?.design_id;
  const orderId = ensureHash(designCode || (designId ? `DES-${designId}` : undefined));
  const requestSku = ensureHash(designCode || designId || undefined);
  const createdAt = selectedVariant?.created_at ?? variants[0]?.created_at ?? new Date().toISOString();

  return {
    renders: images.length ? images : null,
    order_details: {
      order_status: mapStatus(access) ?? null,
      order_id: orderId,
      request_sku: requestSku,
      order_date: createdAt,
      retailer_name: access.design?.created_by || 'N/A',
      manufacturer_name: access.approved_manufacturer?.name || 'N/A',
    },
    specification: {
      'Design Name': access.design?.name ?? '-',
      'Design Code': access.design?.design_code ?? '-',
      'Jewelery Type': access.design?.jewellery_type ?? '-',
      'User Prompt': access.design?.user_prompt ?? '-',
    },
  };
}

function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm">
      <div className="h-5 w-40 rounded-card skeleton-shimmer mb-4" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-3 w-full rounded-card skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

function ProductionHeaderSkeleton() {
  return (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="space-y-2.5">
          <div className="h-6 w-48 rounded-card skeleton-shimmer" />
          <div className="h-3 w-36 rounded-card skeleton-shimmer" />
          <div className="h-3 w-56 rounded-card skeleton-shimmer" />
          <div className="h-3 w-44 rounded-card skeleton-shimmer" />
        </div>
        <div className="h-8 w-32 rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`rounded-card skeleton-shimmer ${className}`} />;
}

function DesignImagesSkeleton() {
  return (
    <div className="bg-white p-3 sm:p-4 md:p-4.5 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] h-full overflow-hidden">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <SkeletonLine className="h-5 w-32" />
        <SkeletonLine className="h-8 w-24 rounded-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px] gap-2.5 sm:gap-3 w-full min-w-0 p-3 sm:p-4 bg-[#fafaf8] rounded-xl shadow-md overflow-hidden">
        <div className="relative overflow-hidden rounded-[18px] min-w-0 p-2 sm:p-2.5">
          <SkeletonLine className="aspect-square w-full rounded-[18px]" />
          <SkeletonLine className="absolute top-4 right-4 h-8 w-8 rounded-full" />
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-1 gap-2.5 sm:gap-3 min-w-0 h-full">
          <SkeletonLine className="aspect-square w-full rounded-[14px]" />
          <SkeletonLine className="aspect-square w-full rounded-[14px]" />
          <SkeletonLine className="aspect-square w-full rounded-[14px]" />
          <SkeletonLine className="aspect-square w-full rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}

function SpecificationsSkeleton() {
  return (
    <div className="h-full bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm">
      <SkeletonLine className="h-5 w-32 mb-4" />

      <div className="space-y-3 sm:space-y-3.5 mb-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex justify-between items-center gap-4 py-1.5 sm:py-2 border-b border-gray-100 last:border-0">
            <SkeletonLine className="h-3.5 w-24" />
            <SkeletonLine className="h-3.5 w-28 ml-auto" />
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-[#F9FAFB] p-3 sm:p-4 space-y-3">
        <SkeletonLine className="h-4 w-28" />
        <div className="space-y-2">
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-11/12" />
          <SkeletonLine className="h-3 w-5/6" />
        </div>
      </div>
    </div>
  );
}

function OrderDetailsSkeleton() {
  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm w-full lg:h-full lg:overflow-auto">
      <SkeletonLine className="h-5 w-36 mb-4 md:mb-5" />

      <div className="space-y-4 sm:space-y-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-1">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="h-4 w-full max-w-[220px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderProgressSkeleton() {
  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm w-full h-full">
      <SkeletonLine className="h-5 w-36 mb-5" />

      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 sm:gap-4">
            <SkeletonLine className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <SkeletonLine className="h-4 w-24" />
              {index === 1 && <SkeletonLine className="h-3 w-32" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomRightSkeleton() {
  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm w-full h-full">
      <SkeletonLine className="h-5 w-28 mb-4" />

      <div className="rounded-xl bg-[#F9FAFB] p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SkeletonLine className="h-3.5 w-24" />
          <SkeletonLine className="h-3.5 w-16" />
        </div>
        <SkeletonLine className="h-px w-full" />
        <SkeletonLine className="h-3.5 w-3/4" />
        <SkeletonLine className="h-3.5 w-5/6" />
        <SkeletonLine className="h-3.5 w-2/3" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <SkeletonLine className="h-10 flex-1 rounded-full" />
        <SkeletonLine className="h-10 w-14 rounded-full" />
      </div>
    </div>
  );
}

export default function CustomerReviewPage() {
  const [loaderLoading, setLoaderLoading] = useState(true);
  const dispatch = useAppDispatch();
  const params = useParams();
  const token = normalizeToken(params?.id as string | string[] | undefined);
  const { data: accessData, loading, error, approveStatus, refinementStatus, refinementError } = useAppSelector((state) => state.customerAccess);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const prevApproveStatus = useRef(approveStatus);
  const prevRefinementStatus = useRef(refinementStatus);

  useEffect(() => {
    // Hide loader after 5 seconds
    const timer = setTimeout(() => {
      setLoaderLoading(false);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!token) return;
    dispatch(fetchCustomerPublicAccess({ token }));
  }, [dispatch, token]);

  useEffect(() => {
    if (approveStatus === 'succeeded' && prevApproveStatus.current !== 'succeeded') {
      if (token) dispatch(fetchCustomerPublicAccess({ token }));
    }
    prevApproveStatus.current = approveStatus;
  }, [approveStatus, dispatch, token]);

  useEffect(() => {
    if (refinementStatus === 'succeeded' && prevRefinementStatus.current !== 'succeeded') {
      setShowRejectModal(false);
      setRejectComment('');
      if (token) dispatch(fetchCustomerPublicAccess({ token }));
    }
    prevRefinementStatus.current = refinementStatus;
  }, [dispatch, refinementStatus, token]);

  const data = useMemo(
    () => (accessData ? mapCustomerAccessToView(accessData) : null),
    [accessData]
  );


  const status = accessData ? (mapStatus(accessData) ?? 'Design review') : 'Design review';
  const isDesignReview = status.toLowerCase().includes('design');
  const isAwaitingApproval = status.toLowerCase().includes('await');
  const isInProduction = status.toLowerCase().includes('production');
  const images = data?.renders ?? [];
  const brandPrimaryColor = accessData?.brand_primary_color ?? '#3B82F6';
  const rawDeadline = accessData?.approved_manufacturer?.deadline;
  const deadline = rawDeadline && rawDeadline.split('-').length === 3
    ? (() => {
      const [y, m, d] = rawDeadline.split('-');
      return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`;
    })()
    : undefined;
  const showPoweredBy = Boolean(accessData?.powered_by ?? accessData?.powered_by_craftsman_ai);
  const hasLoadError = Boolean(error) && !accessData;
  const showSkeletons =
    Boolean(token) &&
    !accessData &&
    !hasLoadError;
  const handleRetry = () => {
    if (!token) return;
    dispatch(fetchCustomerPublicAccess({ token }));
  };

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
        backgroundColor: '#EBF3FE',
      }}
    >
      <header className="bg-white border-b border-gray-200 fixed w-full top-0 z-50">
        <div className="px-3 sm:px-4 md:px-6 lg:px-10 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-full w-auto border border-transparent border-r-gray-300 pr-2 sm:pr-3">
                <img
                  src={accessData?.brand_logo_url ? accessData?.brand_logo_url : "/logo_new.png"}
                  alt="Craftsman.ai"
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                />
              </div>
              <h1 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900">
                Production Sheet
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pb-2 md:pb-8 mt-16">
        {hasLoadError ? (
          <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
            <div className="w-full max-w-lg bg-white rounded-2xl md:rounded-[28px] shadow-[0px_16px_48px_rgba(0,0,0,0.12)] p-6 sm:p-8 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                Something went wrong
              </h2>
              <p className="mt-3 text-sm sm:text-base text-gray-600">
                We could not load this design review right now.
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
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-8 gap-4 sm:gap-5 md:gap-6 items-stretch">
            <div className="lg:col-span-8">
              {showSkeletons ? (
                <ProductionHeaderSkeleton />
              ) : !data ? (
                <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
                  <p className="text-sm sm:text-base text-gray-600">
                    {error ? 'Unable to load design details.' : 'No design data available yet.'}
                  </p>
                </div>
              ) : (
                <ProductionHeader
                  title={data.order_details.order_id}
                  requestSku={data.order_details.request_sku}
                  orderId={data.order_details.order_id}
                  orderDate={new Date(data.order_details.order_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                  })}
                  retailer={data.order_details.retailer_name}
                  status={status}
                  isAwaitingApproval={isAwaitingApproval}
                  approveLoading={approveStatus === 'loading'}
                  refinementLoading={refinementStatus === 'loading'}
                  brandPrimaryColor={brandPrimaryColor}
                  onReject={() => setShowRejectModal(true)}
                  onApprove={() => {
                    if (!token) return;
                    dispatch(approveCustomerDesign({ token }));
                  }}
                />
              )}
            </div>

            <div className={`${isAwaitingApproval ? 'lg:col-span-8' : 'lg:col-span-5'} space-y-4 sm:space-y-5 md:space-y-6 flex flex-col`}>
              {showSkeletons ? (
                <DesignImagesSkeleton />
              ) : data ? (

                <DesignImages
                  initialImage={accessData?.variants?.[0]?.base_design_image_url ?? null}
                  images={images}
                  loading={loading}
                  isAwaitingApproval={isAwaitingApproval}
                  isInProduction={isInProduction}
                  isDesignReview={isDesignReview}
                />
              ) : (
                <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
                  <p className="text-sm sm:text-base text-gray-600">No design images available yet.</p>
                </div>
              )}
            </div>

            <div className={`${isAwaitingApproval ? 'lg:col-span-5' : 'lg:col-span-3'} min-w-0`}>
              {showSkeletons ? (
                <SpecificationsSkeleton />
              ) : !data ? (
                <SpecificationsSkeleton />
              ) : isInProduction ? (
                <OrderProgress
                  approved={true}
                  deadline={deadline}
                  isInProduction={isInProduction}
                  isAwaitingApproval={isAwaitingApproval}
                  brandPrimaryColor={brandPrimaryColor}
                />
              ) : (
                <Specifications specifications={data.specification} specialInstructions={accessData?.share_comment ?? null} isDesignReview={isDesignReview} />
              )}
            </div>

            {isInProduction && data && (
              <div className={`lg:col-span-4 min-w-0`}>
                {showSkeletons ? (
                  <SpecificationsSkeleton />
                ) : (
                  <Specifications specifications={data.specification} specialInstructions={accessData?.share_comment ?? null} isDesignReview={isDesignReview} />
                )}
              </div>
            )}

            <div className={`${isAwaitingApproval ? 'lg:col-span-3' : 'lg:col-span-4'} flex gap-4 sm:gap-5 md:gap-6`}>
              {showSkeletons ? (
                <OrderDetailsSkeleton />
              ) : !data ? (
                <OrderProgressSkeleton />
              ) : isInProduction ? (
                <OrderDetails
                  orderId={data.order_details.order_id}
                  orderIdLabel="Design number"
                  orderDate={new Date(data.order_details.order_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                  })}
                  retailer={data.order_details.retailer_name}
                  manufacturer={data.order_details.manufacturer_name}
                  showFinalPrice={false}
                />
              ) : (
                <OrderProgress
                  approved={false}
                  deadline={deadline}
                  isInProduction={isInProduction}
                  isAwaitingApproval={isAwaitingApproval}
                  brandPrimaryColor={brandPrimaryColor}
                />
              )}
            </div>

            {showSkeletons && (
              <div className="hidden lg:block lg:col-span-4">
                <BottomRightSkeleton />
              </div>
            )}
          </div>
        )}

      </main>

      {showPoweredBy && (
        <div className="px-3 sm:px-4 md:px-6 pb-4 md:pb-6 mt-2">
          <div className="max-w-7xl mx-auto flex justify-start">
            <p className="text-[11px] sm:text-xs font-medium text-gray-500">Powered by Craftsman.AI</p>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/55" onClick={() => setShowRejectModal(false)} />
          <div className="relative w-[calc(100vw-2rem)] max-w-[680px] rounded-[28px] bg-white px-7 py-8 sm:px-10 sm:py-9 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="max-w-[580px]">
              <h3 className="text-[29px] leading-none font-normal tracking-[-0.02em] text-[#1F2A37]">Your Feedback</h3>
              <p className="mt-2 text-[17px] leading-6 text-[#4B5563]">Please explain the required refinements.</p>
            </div>

            <div className="mt-7">
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={5}
                className="h-[124px] w-full resize-none rounded-[12px] border border-[#D1D5DB] bg-white px-5 py-4 text-[16px] leading-6 text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#A7B7D8] focus:ring-0"
                placeholder=""
              />
              {refinementError && (
                <p className="mt-2 text-sm text-red-600">{refinementError}</p>
              )}
            </div>

            <div className="mt-7 flex justify-start">
              <button
                type="button"
                onClick={() => {
                  if (!token || !rejectComment.trim()) return;
                  dispatch(requestCustomerRefinement({ token, comment: rejectComment.trim() }));
                }}
                disabled={refinementStatus === 'loading' || !rejectComment.trim()}
                className="inline-flex min-w-[258px] items-center justify-center gap-3 rounded-full px-8 py-4 text-[20px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(51,100,198,0.24)] hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: brandPrimaryColor }}
              >
                {refinementStatus === 'loading' ? 'Sharing...' : 'Share feedback'}
                <span className="text-[28px] leading-none">&gt;</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
