'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Maximize2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CustomerAccessVariant } from '@/redux/slices/customer/customerSlice';

interface DesignImagesProps {
  initialImage: string | { name: string } | any;
  images: (string | string[])[];
  // initialImage?: CustomerAccessVariant['metal_variations_json'];
  loading?: boolean;
  isAwaitingApproval?: boolean;
  isInProduction?: boolean;
  isDesignReview?: boolean;
}

const getAngleLabel = (url: string, initialImageUrl: string, index: number): string => {
  const cleanUrl = String(url).toLowerCase();
  if (initialImageUrl && cleanUrl === initialImageUrl.toLowerCase()) {
    return 'Initial Image';
  }
  if (cleanUrl.includes('side_view') || cleanUrl.includes('/side') || cleanUrl.includes('_side_')) {
    return 'Side View';
  }
  if (cleanUrl.includes('back_view') || cleanUrl.includes('/back') || cleanUrl.includes('_back_')) {
    return 'Back View';
  }
  if (cleanUrl.includes('worn_view') || cleanUrl.includes('/worn') || cleanUrl.includes('_worn_')) {
    return 'Worn View';
  }
  if (cleanUrl.includes('top_view') || cleanUrl.includes('/top') || cleanUrl.includes('_top_')) {
    return 'Top View';
  }
  if (cleanUrl.includes('three_quarter') || cleanUrl.includes('quarter')) {
    return 'Three Quarter View';
  }
  if (cleanUrl.includes('front_view') || cleanUrl.includes('/front') || cleanUrl.includes('_front_')) {
    return 'Front View';
  }
  
  if (index === 0 && initialImageUrl) return 'Initial Image';
  const defaultLabels = initialImageUrl
    ? ['Initial Image', 'Side View', 'Back View', 'Worn View']
    : ['Side View', 'Back View', 'Worn View'];
  return defaultLabels[index] ?? `View ${index + 1}`;
};

export default function DesignImages({
  images,
  initialImage,
  loading = false,
  isAwaitingApproval = false,
  isInProduction = false,
  isDesignReview = false,
}: DesignImagesProps) {
  const flattenedImages = useMemo(
    () =>
      (Array.isArray(images[0]) ? (images as string[][]).flat() : (images as string[])).filter(
        Boolean,
      ),
    [images],
  );

  const initialImageUrl = typeof initialImage === 'string' ? initialImage.trim() : '';
  const displayImages = useMemo(() => {
    const merged = [initialImage, ...flattenedImages].filter(Boolean);
    return Array.from(new Set(merged));
  }, [flattenedImages, initialImageUrl]);

  const [mainImage, setMainImage] = useState(initialImageUrl || flattenedImages[0] || '');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    setMainImage(initialImageUrl || flattenedImages[0] || '');
    setCurrentImageIndex(0);
  }, [flattenedImages, initialImageUrl]);

  useEffect(() => {
    if (displayImages[currentImageIndex]) {
      setMainImage(displayImages[currentImageIndex]);
    }
  }, [currentImageIndex, displayImages]);

  const handleOpenLightbox = (imageUrl: string) => {
    if (!imageUrl) return;
    const index = displayImages.indexOf(imageUrl);
    setCurrentImageIndex(index >= 0 ? index : 0);
    setIsLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleNextImage = () => {
    if (!displayImages.length) return;
    setCurrentImageIndex((prev) => (prev + 1) % displayImages.length);
  };

  const handlePrevImage = () => {
    if (!displayImages.length) return;
    setCurrentImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleCloseLightbox();
    if (e.key === 'ArrowRight') handleNextImage();
    if (e.key === 'ArrowLeft') handlePrevImage();
  };

  const handlePreviewKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenLightbox(mainImage);
    }
  };

  const statusBadge = isAwaitingApproval
    ? { label: 'Awaiting approval', classes: 'bg-amber-100 text-amber-800' }
    : isInProduction
      ? { label: 'In Production', classes: 'bg-blue-100 text-blue-800' }
      : isDesignReview
        ? { label: 'Design review', classes: 'bg-gray-100 text-gray-800' }
        : null;

  if (loading) {
    return (
      <div className="bg-white p-3 sm:p-4 md:p-4.5 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] h-full overflow-hidden">
        <div className="h-5 w-28 bg-gray-200 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_96px] gap-3 sm:gap-4 w-full min-w-0 p-3 sm:p-4 bg-[#fafaf8] rounded-xl shadow-md">
          <div className="relative overflow-hidden rounded-[18px] aspect-square bg-gray-200 animate-pulse min-w-0" />
          <div className="grid grid-cols-4 sm:grid-cols-1 gap-3 min-w-0">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="relative rounded-[14px] overflow-hidden aspect-square bg-gray-200 animate-pulse min-w-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white p-3 sm:p-4 md:p-4.5 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] h-full relative overflow-hidden">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <h3 className="text-lg sm:text-xl md:text-2xl font-base text-gray-900">Design Images</h3>
          {/* {statusBadge && (
            <div className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${statusBadge.classes}`}>
              {statusBadge.label}
            </div>
          )} */}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px] gap-2.5 sm:gap-3 w-full min-w-0 p-3 sm:p-4 bg-[#fafaf8] rounded-xl shadow-md overflow-hidden">
          <div className="relative overflow-hidden rounded-[18px] min-w-0  p-2 sm:p-2.5 transition-all duration-500 -mt-3">
            <div
              role="button"
              tabIndex={0}
              className="relative block mx-auto rounded-xl overflow-hidden aspect-square max-h-[500px] cursor-pointer"
              onClick={() => handleOpenLightbox(mainImage)}
              onKeyDown={handlePreviewKeyDown}
            >
              <img
                src={mainImage}
                alt="Main design"
                className="w-full h-full object-cover aspect-square object-center cursor-pointer"
              />

              <button
                type="button"
                onClick={() => handleOpenLightbox(mainImage)}
                className="absolute top-2 right-2 sm:top-3 sm:right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-black/[0.04] hover:bg-white transition-colors cursor-pointer"
                aria-label="View full screen"
              >
                <Maximize2 className="w-4 h-4 text-gray-700" />
              </button>
            </div>
          </div>

          {displayImages.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-1 gap-2.5 sm:gap-3 min-w-0 h-full">
              {displayImages.slice(-4).map((image, index) => {
                const isActive = mainImage === image;
                const absoluteIndex = displayImages.indexOf(image);
                const angleLabel = getAngleLabel(image, initialImageUrl, absoluteIndex);

                return (
                  <div
                    key={index}
                    className={`relative rounded-[14px] overflow-hidden cursor-pointer group transition-all duration-300 border border-black/[0.04] aspect-square${isActive
                        ? 'shadow-[0px_4px_16px_rgba(59,130,246,0.15)] opacity-100 scale-[1.06]'
                        : 'shadow-none opacity-75'
                      }`}
                  >
                    <button
                      type="button"
                      className="block w-full h-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMainImage(image);
                      }}
                    >
                      <img
                        src={image}
                        alt={`Design ${index + 1}`}
                        className="w-full h-full aspect-square object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                    </button>

                    <div className="hidden sm:block absolute bottom-0 left-0 right-0 px-2 py-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent">
                      <span className="text-[9px] sm:text-[10px] font-semibold text-white block drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {angleLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black bg-opacity-95 flex items-center justify-center"
          onClick={handleCloseLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          style={{ animation: 'fadeIn 0.2s ease-in-out', marginTop: '0px' }}
        >
          <button
            onClick={handleCloseLightbox}
            className="absolute top-4 right-4 p-3 bg-gray-900 bg-opacity-80 hover:bg-opacity-100 rounded-full transition-all duration-200 cursor-pointer z-50 hover:scale-110"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {displayImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevImage();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-gray-900 bg-opacity-80 hover:bg-opacity-100 rounded-full transition-all duration-200 cursor-pointer z-50 hover:scale-110"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-8 h-8 text-white" />
            </button>
          )}

          {displayImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextImage();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-gray-900 bg-opacity-80 hover:bg-opacity-100 rounded-full transition-all duration-200 cursor-pointer z-50 hover:scale-110"
              aria-label="Next image"
            >
              <ChevronRight className="w-8 h-8 text-white" />
            </button>
          )}

          <div
            className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'zoomIn 0.3s ease-out' }}
          >
            <img
              src={displayImages[currentImageIndex] ?? mainImage}
              alt={`Design ${currentImageIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              style={{ animation: 'fadeIn 0.2s ease-in-out' }}
            />
          </div>

          {displayImages.length > 1 && (
            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 bg-white bg-opacity-10 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl z-50 max-w-[90vw] overflow-x-auto">
              {displayImages.map((image, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-md sm:rounded-lg overflow-hidden transition-all duration-200 cursor-pointer shrink-0 ${currentImageIndex === index
                      ? 'ring-2 sm:ring-3 ring-blue-500 scale-110'
                      : 'ring-1 sm:ring-2 ring-white ring-opacity-50 hover:ring-blue-400 hover:scale-105'
                    }`}
                >
                  <img
                    // @ts-ignore
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
