'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { DesignApiItem } from '@/redux/slices/retailer/designsSlice';
import { getCacheBustedUrl } from '@/src/utils/image';

type DesignStatus =
  | 'Generating'
  | 'Ready for Review'
  | 'Sent to Customer'
  | 'Approved'
  | 'Rejected'
  | 'Sent to Manufacturer'
  | 'Completed'
  | 'Draft'
  | 'GENERATING'
  | 'PENDING'
  | 'PROCESSING'
  | 'GENERATED'
  | 'UNDER_REVIEW'
  | 'SHARED'
  | 'QUOTES_REQUESTED'
  | 'QUOTE_RECEIVED'
  | 'REFINEMENT_REQUESTED'
  | 'APPROVED'
  | 'DESIGN_REJECTED'
  | 'MANUFACTURER_APPROVED'
  | 'REJECTED'
  | 'IN_PRODUCTION'
  | 'SENT_TO_MANUFACTURER'
  | 'COMPLETED'
  | 'FAILED'
  | 'DRAFT';

interface DesignItem {
  id: number;
  image?: string | null;
  title: string;
  customer: string;
  requestId: string;
  time: string;
  status: string;
}

interface DesignGridProps {
  designs: DesignApiItem[];
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const mapStatus = (status: string): string => {
  return (status || '').trim().toUpperCase();
};

const statusStyles: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  'Generating': { bg: 'bg-[#FDA018]/15', text: 'text-[#FDA018]', icon: 'ri-loader-4-line animate-spin', label: 'Generating' },
  'Ready for Review': { bg: 'bg-blue-500/15', text: 'text-blue-500', icon: 'ri-checkbox-circle-line', label: 'Ready for Review' },
  'Sent to Customer': { bg: 'bg-[#FDA018]/15', text: 'text-[#FDA018]', icon: 'ri-send-plane-line', label: 'Sent to Customer' },
  'Approved': { bg: 'bg-[#22A121]/15', text: 'text-[#22A121]', icon: 'ri-checkbox-circle-fill', label: 'Approved' },
  'Rejected': { bg: 'bg-[#EF4444]/15', text: 'text-[#EF4444]', icon: 'ri-close-circle-line', label: 'Rejected' },
  'Sent to Manufacturer': { bg: 'bg-purple-500/15', text: 'text-purple-500', icon: 'ri-hammer-line', label: 'Sent to Manufacturer' },
  'Completed': { bg: 'bg-[#22A121]/15', text: 'text-[#22A121]', icon: 'ri-checkbox-circle-fill', label: 'Completed' },
  'Draft': { bg: 'bg-[#9CA3AF]/15', text: 'text-[#6B7280]', icon: 'ri-file-list-3-line', label: 'Draft' },

  'GENERATING': { bg: 'bg-[#FDA018]/15', text: 'text-[#FDA018]', icon: 'ri-loader-4-line animate-spin', label: 'Generating' },
  'PENDING': { bg: 'bg-[#FDA018]/15', text: 'text-[#FDA018]', icon: 'ri-loader-4-line animate-spin', label: 'Pending' },
  'PROCESSING': { bg: 'bg-[#FDA018]/15', text: 'text-[#FDA018]', icon: 'ri-loader-4-line animate-spin', label: 'Processing' },
  'GENERATED': { bg: 'bg-blue-500/15', text: 'text-blue-500', icon: 'ri-checkbox-circle-line', label: 'Generated' },
  'UNDER_REVIEW': { bg: 'bg-blue-500/15', text: 'text-blue-500', icon: 'ri-checkbox-circle-line', label: 'Under Review' },
  'SENT_TO_CUSTOMER': { bg: 'bg-[#FDA018]/15', text: 'text-[#FDA018]', icon: 'ri-send-plane-line', label: 'Sent to Customer' },
  'SHARED': { bg: 'bg-[#FDA018]/15', text: 'text-[#FDA018]', icon: 'ri-send-plane-line', label: 'Shared' },
  'QUOTES_REQUESTED': { bg: 'bg-purple-500/15', text: 'text-purple-500', icon: 'ri-hammer-line', label: 'Quotes Requested' },
  'QUOTE_RECEIVED': { bg: 'bg-purple-500/15', text: 'text-purple-500', icon: 'ri-hammer-line', label: 'Quote Received' },
  'REFINEMENT_REQUESTED': { bg: 'bg-[#EF4444]/15', text: 'text-[#EF4444]', icon: 'ri-close-circle-line', label: 'Refinement Requested' },
  'APPROVED': { bg: 'bg-[#22A121]/15', text: 'text-[#22A121]', icon: 'ri-checkbox-circle-fill', label: 'Approved' },
  'DESIGN_REJECTED': { bg: 'bg-[#EF4444]/15', text: 'text-[#EF4444]', icon: 'ri-close-circle-line', label: 'Design Rejected' },
  'MANUFACTURER_APPROVED': { bg: 'bg-[#22A121]/15', text: 'text-[#22A121]', icon: 'ri-checkbox-circle-fill', label: 'Manufacturer Approved' },
  'REJECTED': { bg: 'bg-[#EF4444]/15', text: 'text-[#EF4444]', icon: 'ri-close-circle-line', label: 'Rejected' },
  'IN_PRODUCTION': { bg: 'bg-blue-500/15', text: 'text-blue-500', icon: 'ri-checkbox-circle-line', label: 'In Production' },
  'SENT_TO_MANUFACTURER': { bg: 'bg-purple-500/15', text: 'text-purple-500', icon: 'ri-hammer-line', label: 'Sent to Manufacturer' },
  'COMPLETED': { bg: 'bg-[#22A121]/15', text: 'text-[#22A121]', icon: 'ri-checkbox-circle-fill', label: 'Completed' },
  'FAILED': { bg: 'bg-[#EF4444]/15', text: 'text-[#EF4444]', icon: 'ri-close-circle-line', label: 'Failed' },
  'DRAFT': { bg: 'bg-[#9CA3AF]/15', text: 'text-[#6B7280]', icon: 'ri-file-list-3-line', label: 'Draft' },
};

const formatDate = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
};

const mapDesign = (item: DesignApiItem, imageOverrides: Record<string, string>): DesignItem => {
  const overrideImage =
    imageOverrides[item.design_code] || imageOverrides[String(item.id)] || null;
  const variantImage = item.variants?.[0]?.base_design_image_url || item.variants?.[0]?.base_image_url || item.variants?.[0]?.image_url || item.variants?.[0]?.image;

  let finalStatus = mapStatus(item.status);
  const designCodeOrId = item.design_code || String(item.id);
  if (typeof window !== 'undefined') {
    try {
      const isFailed = localStorage.getItem(`design_failed_${designCodeOrId}`) === 'true' ||
        localStorage.getItem(`design_failed_${item.id}`) === 'true' ||
        sessionStorage.getItem(`design_failed_${designCodeOrId}`) === 'true' ||
        sessionStorage.getItem(`design_failed_${item.id}`) === 'true';
      if (isFailed && (finalStatus === 'GENERATING' || finalStatus === 'PENDING' || finalStatus === 'PROCESSING')) {
        finalStatus = 'FAILED';
      }

      const isRefinementGenerating = localStorage.getItem(`refinement_generating_${designCodeOrId}`) === 'true' ||
        localStorage.getItem(`refinement_generating_${item.id}`) === 'true' ||
        sessionStorage.getItem(`refinement_generating_${designCodeOrId}`) === 'true' ||
        sessionStorage.getItem(`refinement_generating_${item.id}`) === 'true';
      if (isRefinementGenerating) {
        if (finalStatus !== 'COMPLETED' && finalStatus !== 'FAILED') {
          finalStatus = 'GENERATING';
        }
      }
    } catch (e) { }
  }

  const isGenerating = finalStatus === 'GENERATING' || finalStatus === 'PENDING' || finalStatus === 'PROCESSING';

  const image = isGenerating ? null : (variantImage || overrideImage || item.input_image_url || item.input_image_urls?.[0] || null);
  const cacheBustedImage = image ? getCacheBustedUrl(image, item.updated_at) : null;
  return {
    id: item.id,
    image: cacheBustedImage,
    title: item.name || '',
    customer: item.shared_customer?.customer_name || '—',
    requestId: designCodeOrId,
    time: formatDate(item.created_at),
    status: finalStatus,
  };
};

export default function DesignGrid({ designs, loading, error, hasMore, onLoadMore }: DesignGridProps) {
  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const currentTarget = observerRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, onLoadMore, loading]);

  if (loading && designs.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={`design-skeleton-${idx}`}
            className="relative overflow-hidden rounded-[14px] aspect-[3/3.3] bg-white dark:bg-surface-100 border border-[#E5E7EB] dark:border-white/[0.08]"
          >
            <div className="absolute inset-0 animate-pulse">
              <div className="absolute inset-0 bg-[#F3F4F6] dark:bg-[#1E2530]" />
              <div className="absolute top-2 right-2 h-4 w-16 rounded-full bg-[#E5E7EB] dark:bg-[#2C3545]" />
              <div className="absolute bottom-0 left-0 right-0 px-2.5 sm:px-3 pb-2.5 sm:pb-3">
                <div className="h-3 w-24 rounded bg-[#E5E7EB] dark:bg-[#2C3545]" />
                <div className="mt-2 h-2.5 w-20 rounded bg-[#E5E7EB] dark:bg-[#2C3545]" />
                <div className="mt-2 h-2 w-12 rounded bg-[#E5E7EB] dark:bg-[#2C3545]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[16px] border border-[#FECACA] dark:border-red-900/30 bg-[#FEF2F2] dark:bg-red-950/10 px-4 py-6 text-center text-sm text-[#B91C1C] dark:text-red-400">
        {error}
      </div>
    );
  }

  const imageOverrides = {} as Record<string, string>;
  const mapped = designs.map((item) => mapDesign(item, imageOverrides));
  if (mapped.length === 0) {
    return (
      <div className="rounded-[16px] border border-[#E5E7EB] dark:border-white/[0.08] bg-white dark:bg-surface-100 px-4 py-6 text-center text-sm text-[#6B7280] dark:text-[#D1D5DB]">
        No designs found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 text-ink dark:text-ink">
        {mapped.map((design) => {
          const badge = statusStyles[design.status] || {
            bg: 'bg-[#9CA3AF]/15',
            text: 'text-[#6B7280]',
            icon: 'ri-file-list-3-line',
            label: design.status,
          };
          return (
            <Link key={design.id} href={`/retailer/requests?id=${design.requestId}`} className="block">
              <div
                className="relative overflow-hidden cursor-pointer group rounded-[14px] border border-transparent dark:border-white/[0.08] aspect-[3/3.3]"
              >
                {design.image ? (
                  <img
                    src={design.image}
                    alt={design.title}
                    className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F3F4F6] dark:bg-surface-150 text-[11px] text-[#9CA3AF] dark:text-ink-600">
                    {design.status === 'GENERATING' || design.status === 'PENDING' || design.status === 'PROCESSING' ? (
                      <>
                        <i className="ri-loader-4-line animate-spin text-[20px] text-[#FDA018] mb-1.5"></i>
                        <span className="font-semibold text-[#FDA018] text-[10px] sm:text-[11px]">Generating...</span>
                      </>
                    ) : (
                      <span>No image</span>
                    )}
                  </div>
                )}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_transparent_40%,_rgba(240,235,228,0.72)_72%,_rgba(232,226,218,0.95)_100%)] dark:bg-[linear-gradient(to_bottom,_transparent_40%,_rgba(15,17,21,0.72)_72%,_rgba(15,17,21,0.95)_100%)]" />
                <div
                  className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 sm:px-2 py-[2px] sm:py-[3px] rounded-full text-[9px] sm:text-[11px] font-semibold backdrop-blur-sm ${badge.bg} ${badge.text}`}
                >
                  <span className={`w-3 h-3 flex items-center justify-center ${badge.icon} text-[9px] sm:text-[10px]`}></span>
                  {badge.label}
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-2.5 sm:px-3 pb-2.5 sm:pb-3">
                  <h3
                    className="text-[11px] sm:text-[13.5px] font-bold text-[#1A1A1A] dark:text-ink leading-snug font-satoshi"
                  >
                    {design.title}
                  </h3>
                  <p
                    className="text-[9px] sm:text-[11.5px] text-[#6B7280] dark:text-[#D1D5DB] mt-0.5 font-inter"
                  >
                    {design.customer} · {design.requestId}
                  </p>
                  <p
                    className="text-[8px] sm:text-[10.5px] text-[#9CA3AF] dark:text-[#A1A8B3] mt-0.5 font-inter"
                  >
                    {design.time}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
        {loading && (
          <>
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`design-loadmore-skeleton-${idx}`}
                className="relative overflow-hidden rounded-[14px] aspect-[3/3.3] bg-white dark:bg-surface-100 border border-[#E5E7EB] dark:border-white/[0.08]"
              >
                <div className="absolute inset-0 animate-pulse">
                  <div className="absolute inset-0 bg-[#F3F4F6] dark:bg-[#1E2530]" />
                  <div className="absolute top-2 right-2 h-4 w-16 rounded-full bg-[#E5E7EB] dark:bg-[#2C3545]" />
                  <div className="absolute bottom-0 left-0 right-0 px-2.5 sm:px-3 pb-2.5 sm:pb-3">
                    <div className="h-3 w-24 rounded bg-[#E5E7EB] dark:bg-[#2C3545]" />
                    <div className="mt-2 h-2.5 w-20 rounded bg-[#E5E7EB] dark:bg-[#2C3545]" />
                    <div className="mt-2 h-2 w-12 rounded bg-[#E5E7EB] dark:bg-[#2C3545]" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      {hasMore && !loading && (
        <div ref={observerRef} className="h-10 w-full" />
      )}
    </div>
  );
}