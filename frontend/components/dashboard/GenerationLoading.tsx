'use client';

import { useState, useEffect, useCallback } from 'react';

const STATUS_MESSAGES = [
  'Analyzing your design prompt...',
  'Applying jewellery style and structure...',
  'Rendering high-quality visuals...',
  'Finalizing design details...',
];

const MORPH_SHAPES = [
  'M 50 10 C 30 10 15 25 15 45 C 15 65 30 80 50 80 C 70 80 85 65 85 45 C 85 25 70 10 50 10 Z M 50 20 C 60 20 70 30 70 45 C 70 60 60 70 50 70 C 40 70 30 60 30 45 C 30 30 40 20 50 20 Z',
  'M 50 8 C 20 8 8 30 8 50 C 8 75 25 92 50 92 C 75 92 92 75 92 50 C 92 30 80 8 50 8 Z M 50 22 C 65 22 78 35 78 52 C 78 68 65 80 50 80 C 35 80 22 68 22 52 C 22 35 35 22 50 22 Z',
  'M 50 5 C 15 5 5 35 5 50 C 5 70 20 95 50 95 C 80 95 95 70 95 50 C 95 35 85 5 50 5 Z M 50 25 C 60 25 75 38 75 52 C 75 66 60 78 50 78 C 40 78 25 66 25 52 C 25 38 40 25 50 25 Z',
  'M 50 12 C 28 12 10 30 10 50 C 10 72 28 88 50 88 C 72 88 90 72 90 50 C 90 30 72 12 50 12 Z M 50 28 C 62 28 74 38 74 52 C 74 64 62 74 50 74 C 38 74 26 64 26 52 C 26 38 38 28 50 28 Z',
];

interface GenerationLoadingProps {
  prompt?: string;
  jewelleryType?: string;
  onRetry?: () => void;
  onEditPrompt?: () => void;
  onComplete?: () => void;
}

export default function GenerationLoading({
  prompt,
  jewelleryType = 'Ring',
  onRetry,
  onEditPrompt,
  onComplete,
}: GenerationLoadingProps) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [morphIndex, setMorphIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 400);
  }, [onComplete]);

  useEffect(() => {
    if (hasError) return;
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [hasError]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMorphIndex((prev) => (prev + 1) % MORPH_SHAPES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-complete after simulated generation (4.5 - 6.5s)
  useEffect(() => {
    if (hasError) return;
    const delay = 4500 + Math.random() * 2000;
    const timeout = setTimeout(() => {
      if (onComplete) onComplete();
    }, delay);
    return () => clearTimeout(timeout);
  }, [hasError, onComplete]);

  const handleRetry = () => {
    setHasError(false);
    setStatusIndex(0);
    if (onRetry) onRetry();
  };

  const handleEdit = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onEditPrompt) onEditPrompt();
    }, 400);
  };

  if (!isVisible && !hasError) return null;

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-400 bg-[linear-gradient(135deg,_#FFF5F0_0%,_#F8F0FF_50%,_#F0F4FF_100%)] ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Soft background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle,_rgba(255,200,180,0.18)_0%,_transparent_70%)] blur-[80px]"
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle,_rgba(200,180,255,0.15)_0%,_transparent_70%)] blur-[80px]"
        />
        <div
          className="absolute top-[40%] left-[60%] w-[30vw] h-[30vw] rounded-full bg-[radial-gradient(circle,_rgba(180,210,255,0.12)_0%,_transparent_70%)] blur-[60px]"
        />
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center text-center max-w-[520px] w-full mx-6">
        {hasError ? (
          <>
            {/* Error State */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-red-500/10"
            >
              <span className="w-10 h-10 flex items-center justify-center">
                <i className="ri-error-warning-line text-[28px] text-[#EF4444]"></i>
              </span>
            </div>

            <h1
              className="text-[22px] font-semibold text-[#1A1A2E] mb-2 font-satoshi"
            >
              Something went wrong
            </h1>
            <p className="text-[14px] text-[#9CA3AF] mb-8 leading-relaxed">
              We couldn&apos;t generate your design. Please try again.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleEdit}
                className="px-5 py-2.5 rounded-full text-[13px] font-medium text-[#6B7280] transition-all cursor-pointer whitespace-nowrap hover:bg-[#F3F4F6] border border-[#E5E7EB]"
              >
                Edit Prompt
              </button>
              <button
                onClick={handleRetry}
                className="px-5 py-2.5 rounded-full text-[13px] font-medium text-white transition-all cursor-pointer whitespace-nowrap hover:opacity-90 bg-[#6366F1]"
              >
                Retry Generation
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Morphing jewellery loader */}
            <div className="relative mb-8">
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center bg-[linear-gradient(135deg,_rgba(99,102,241,0.08)_0%,_rgba(139,92,246,0.08)_100%)] shadow-[0_0_60px_rgba(99,102,241,0.12),_0_0_120px_rgba(139,92,246,0.06)]"
              >
                <svg
                  viewBox="0 0 100 100"
                  className="w-14 h-14 [filter:drop-shadow(0_2px_8px_rgba(99,102,241,0.2))]"
                >
                  <path
                    d={MORPH_SHAPES[morphIndex]}
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="morph-path"
                  />
                  <circle cx="50" cy="45" r="4" fill="#8B5CF6" opacity="0.6">
                    <animate
                      attributeName="r"
                      values="4;6;4"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0.9;0.6"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </svg>
              </div>
              {/* Orbiting dots */}
              <div className="absolute inset-0 animate-spin [animation-duration:8s]">
                <div
                  className="absolute w-2 h-2 rounded-full bg-[#6366F1]/40 top-0 left-1/2 -translate-x-1/2"
                />
              </div>
              <div className="absolute inset-0 animate-spin [animation-duration:12s] [animation-direction:reverse]">
                <div
                  className="absolute w-1.5 h-1.5 rounded-full bg-[#8B5CF6]/30 bottom-[5%] right-[15%]"
                />
              </div>
            </div>

            {/* Heading */}
            <h1
              className="text-[22px] font-semibold text-[#1A1A2E] mb-2 font-satoshi"
            >
              Generating Your Design
            </h1>
            <p className="text-[13.5px] text-[#9CA3AF] mb-6 leading-relaxed">
              Our AI is crafting a unique jewellery design based on your input.
            </p>

            {/* Dynamic status */}
            <div className="h-6 mb-4 flex items-center justify-center">
              <span
                className="text-[13px] font-medium text-[#6366F1] transition-all duration-500 font-inter"
              >
                {STATUS_MESSAGES[statusIndex]}
              </span>
            </div>

            {/* Indeterminate progress line */}
            <div className="w-full max-w-[280px] h-[2px] bg-[#E5E7EB] rounded-full overflow-hidden mb-6">
              <div
                className="h-full rounded-full w-[60%] bg-[linear-gradient(90deg,_#6366F1,_#8B5CF6,_#6366F1)] [background-size:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]"
              />
            </div>

            {/* Context reminder */}
            {(prompt || jewelleryType) && (
              <div
                className="w-full rounded-xl px-4 py-3 mb-4 text-left bg-white/60 border border-black/[0.05] backdrop-blur-[8px]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3.5 h-3.5 flex items-center justify-center">
                    <i className="ri-sparkling-line text-[12px] text-[#8B5CF6]"></i>
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    Your Request
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500"
                  >
                    {jewelleryType}
                  </span>
                  {prompt && (
                    <span className="text-[12px] text-[#6B7280] truncate max-w-[280px]">
                      {prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Time expectation */}
            <p className="text-[11.5px] text-[#C4C4C4]">
              This usually takes a few seconds
            </p>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
        .morph-path {
          transition: d 2s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}