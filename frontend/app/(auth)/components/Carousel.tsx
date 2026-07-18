'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { flushSync } from 'react-dom';
import { useAppearance } from '@/lib/appearance-context';

type Slide = {
  image: string;
  name: string;
  subtitle: string;
  category: string;
  subCategory: string;
  angle: string;
};

const slides: Slide[] = [
  { image: '/AuthCarousel/Bracelet%20Charm.png', name: 'Bracelet Charm', subtitle: 'Charms layered with personal stories and keepsakes', category: 'Bracelet', subCategory: 'Charm', angle: '' },
  { image: '/AuthCarousel/Bracelet%20Cuff.png', name: 'Bracelet Cuff', subtitle: 'Sculpted metal that hugs the wrist with quiet strength', category: 'Bracelet', subCategory: 'Cuff', angle: '' },
  { image: '/AuthCarousel/Chain%20Cuban.png', name: 'Chain Cuban', subtitle: 'Bold Cuban links carrying heirloom weight and modern shine', category: 'Chain', subCategory: 'Cuban', angle: '' },
  { image: '/AuthCarousel/Chain%20Tennis.png', name: 'Chain Tennis', subtitle: 'An endless line of brilliance that flows with every move', category: 'Chain', subCategory: 'Tennis', angle: '' },
  { image: '/AuthCarousel/Earring%20Chandelier.png', name: 'Earring Chandelier', subtitle: 'Cascading chandelier tiers that dance and scatter light', category: 'Earring', subCategory: 'Chandelier', angle: '' },
  { image: '/AuthCarousel/Earring%20Drop-Dangles.png', name: 'Earring Drop-Dangles', subtitle: 'Graceful drops that sway with each step, catching every glow', category: 'Earring', subCategory: 'Drop-Dangles', angle: '' },
  { image: '/AuthCarousel/Pendant%20Logo-Brand.png', name: 'Pendant Logo-Brand', subtitle: 'Signature branding brought front and center as wearable art', category: 'Pendant', subCategory: 'Logo-Brand', angle: '' },
  { image: '/AuthCarousel/Pendant%20Religious.png', name: 'Pendant Religious', subtitle: 'Refined expressions of faith to keep close and celebrate', category: 'Pendant', subCategory: 'Religious', angle: '' },
  { image: '/AuthCarousel/Ring%20Engagement.png', name: 'Ring Engagement', subtitle: 'A promise ringed in fire, brilliance, and forever intent', category: 'Ring', subCategory: 'Engagement', angle: '' },
  { image: '/AuthCarousel/Ring%20Statement.png', name: 'Ring Statement', subtitle: 'One bold ring that commands every glance and conversation', category: 'Ring', subCategory: 'Statement', angle: '' },
  { image: '/AuthCarousel/Watch%20Bezel-Iced.png', name: 'Watch Bezel-Iced', subtitle: 'Iced bezel turning time into theatre with fearless shine', category: 'Watch', subCategory: 'Bezel-Iced', angle: '' },
  { image: '/AuthCarousel/Watch%20Skeleton.png', name: 'Watch Skeleton', subtitle: 'Skeleton movement showcasing crafted mechanics and depth', category: 'Watch', subCategory: 'Skeleton', angle: '' },
];

const HEADER_GRADIENT = 'linear-gradient(90deg, rgba(44,98,185,0.50) 0%, rgba(124,58,237,0.50) 50%, rgba(31,190,214,0.50) 100%)';
const CONIC_GRADIENT = 'conic-gradient(from 90deg at 50% 50%, #2C62B9 46.73077046871185deg, #7C3AED 155.76923489570618deg, #1FBED6 256.1538362503052deg)';

// Toggle gradient — different opacity for light vs dark
const TOGGLE_BG_LIGHT = 'linear-gradient(90deg, rgba(44,98,185,0.05) 0%, rgba(124,58,237,0.05) 50%, rgba(31,190,214,0.05) 100%)';
const TOGGLE_BG_DARK = 'linear-gradient(90deg, rgba(44,98,185,0.18) 0%, rgba(124,58,237,0.18) 50%, rgba(31,190,214,0.18) 100%)';
const TOGGLE_SEL_LIGHT = 'linear-gradient(90deg, rgba(44,98,185,0.10) 0%, rgba(124,58,237,0.10) 50%, rgba(31,190,214,0.10) 100%)';
const TOGGLE_SEL_DARK = 'linear-gradient(90deg, rgba(44,98,185,0.32) 0%, rgba(124,58,237,0.32) 50%, rgba(31,190,214,0.32) 100%)';

// ── iOS-drum-roll wheel physics ───────────────────────────────────────────────
const WHEEL_ROW_HEIGHT = 44;
const ITEM_ANGLE_DEG = 22;
const ITEM_ANGLE_RAD = (ITEM_ANGLE_DEG * Math.PI) / 180;
const CYLINDER_RADIUS = WHEEL_ROW_HEIGHT / Math.sin(ITEM_ANGLE_RAD);
const WHEEL_HEIGHT = 224;
const WHEEL_CENTER_Y = WHEEL_HEIGHT / 2;
const MAX_VISIBLE_ANGLE = 60;
const WHEEL_OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const;
const AUTO_SLIDE_INTERVAL = 2400;
const WHEEL_EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
// ─────────────────────────────────────────────────────────────────────────────

function wrapIndex(index: number, total: number) {
  return ((index % total) + total) % total;
}

// Reads the live root font-size as a multiple of the 16px base.
// At <lg the root font-size is the browser default (16px) -> exactly 1, so the
// wheel renders byte-identically. At lg+ the root font-size is fluid (vw-based),
// so this co-scales the framer-motion drum with the rem layout, keeping it
// pixel-proportional and zoom-invariant. Browser zoom fires `resize` -> re-read.
function useRootScale() {
  const [rootScale, setRootScale] = useState(1);
  useEffect(() => {
    const read = () => {
      const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
      setRootScale(fs > 0 ? fs / 16 : 1);
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return rootScale;
}

function GradientChip({ label }: { label: string }) {
  return (
    <div className="rounded-full p-px" style={{ background: CONIC_GRADIENT }}>
      <div className="flex items-center gap-1.5 rounded-full bg-[#F3F4F6] px-2 py-1 text-[0.625rem] font-medium dark:bg-[#1A1E28] lg:px-2.5 lg:py-1 lg:text-[0.6875rem]">
        <span className="h-3 w-3 shrink-0 rounded-full lg:h-3.5 lg:w-3.5" style={{ background: CONIC_GRADIENT }} />
        <span className="bg-clip-text text-transparent text-nowrap" style={{ backgroundImage: CONIC_GRADIENT }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function AngleRow({
  category,
  subCategory,
  angle,
  active = false,
}: {
  category: string;
  subCategory: string;
  angle: string;
  active?: boolean;
}) {
  return (
    <div
      className={`mx-auto flex w-full items-center justify-between gap-2 rounded-full px-2.5 py-1.5 md:gap-3 md:px-3 md:py-2 ${active
        ? 'bg-[#E8ECF1] font-medium text-[#3A3D42] shadow-[0_8px_22px_rgba(36,56,89,0.1)] dark:bg-[#252D3D] dark:text-[#E4E9F0] dark:shadow-[0_8px_22px_rgba(0,0,0,0.4)]'
        : 'text-[var(--carousel-inactive-text)] dark:text-[var(--carousel-inactive-text-dark)]'
        }`}
    >
      <span className="flex-1 truncate text-center text-xs md:text-sm [text-shadow:0_1px_1px_rgba(255,255,255,0.6)] dark:[text-shadow:none]">
        {category}
      </span>
      <span className="h-5 w-px shrink-0 bg-[#DADDE3] dark:bg-[#3A4258] md:h-6" />
      <span className="flex-1 truncate text-center text-xs md:text-sm">
        {subCategory}
      </span>
      {/* Angle column kept for future use per request; uncomment to show */}
      {false && (
        <>
          <span className="h-5 w-px shrink-0 bg-[#DADDE3] dark:bg-[#3A4258] md:h-6" aria-hidden="true" />
          <span className="w-[3rem] shrink-0 truncate text-center text-xs md:w-[3.5rem] md:text-sm">
            {angle || '—'}
          </span>
        </>
      )}
    </div>
  );
}

function WheelRow({
  offset,
  activeIndex,
  wheelRotation,
  rootScale,
}: {
  offset: number;
  activeIndex: number;
  wheelRotation: ReturnType<typeof useMotionValue<number>>;
  rootScale: number;
}) {
  const slide = slides[wrapIndex(activeIndex + offset, slides.length)];

  const y = useTransform(wheelRotation, (rot) => {
    const thetaDeg = offset * ITEM_ANGLE_DEG - rot;
    const thetaRad = (thetaDeg * Math.PI) / 180;
    return rootScale * (WHEEL_CENTER_Y + CYLINDER_RADIUS * Math.sin(thetaRad) - WHEEL_ROW_HEIGHT / 2);
  });

  const z = useTransform(wheelRotation, (rot) => {
    const thetaDeg = offset * ITEM_ANGLE_DEG - rot;
    const thetaRad = (thetaDeg * Math.PI) / 180;
    return rootScale * (CYLINDER_RADIUS * (Math.cos(thetaRad) - 1));
  });

  const rotateX = useTransform(wheelRotation, (rot) => {
    return rot - offset * ITEM_ANGLE_DEG;
  });

  const opacity = useTransform(wheelRotation, (rot) => {
    const abs = Math.abs(offset * ITEM_ANGLE_DEG - rot);
    if (abs >= MAX_VISIBLE_ANGLE) return 0;
    if (abs <= 15) return 1;
    return 1 - (abs - 15) / (MAX_VISIBLE_ANGLE - 15);
  });

  const scale = useTransform(wheelRotation, (rot) => {
    const thetaDeg = offset * ITEM_ANGLE_DEG - rot;
    const thetaRad = (thetaDeg * Math.PI) / 180;
    return 0.78 + 0.22 * Math.cos(thetaRad);
  });

  return (
    <motion.div
      className="absolute left-0 right-0"
      style={{ y, z, opacity, rotateX, scale, transformOrigin: 'center center', transformStyle: 'preserve-3d' }}
    >
      <AngleRow category={slide.category} subCategory={slide.subCategory} angle={slide.angle} />
    </motion.div>
  );
}

function AngleWheel({
  activeIndex,
  wheelRotation,
  isDark,
  rootScale,
}: {
  activeIndex: number;
  wheelRotation: ReturnType<typeof useMotionValue<number>>;
  isDark: boolean;
  rootScale: number;
}) {
  const currentSlide = slides[activeIndex];

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: `${WHEEL_HEIGHT * rootScale}px`, perspective: `${600 * rootScale}px` }}
    >
      {/* Static active-row highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10"
        style={{ top: `${(WHEEL_CENTER_Y - WHEEL_ROW_HEIGHT / 2) * rootScale}px` }}
      >
        <AngleRow category={currentSlide.category} subCategory={currentSlide.subCategory} angle={currentSlide.angle} active />
      </div>

      {/* Cylindrical drum */}
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        {WHEEL_OFFSETS.map((offset) => (
          <WheelRow key={offset} offset={offset} activeIndex={activeIndex} wheelRotation={wheelRotation} rootScale={rootScale} />
        ))}
      </div>

      {/* Gradient masks */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-[#F3F4F6] transition-colors dark:bg-[#1A1E28]"
        style={{
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.3) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.3) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-[#F3F4F6] transition-colors dark:bg-[#1A1E28]"
        style={{
          maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.3) 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.3) 100%)',
        }}
      />
    </div>
  );
}

export default function Carousel() {
  const [active, setActive] = useState(0);
  const { resolvedTheme, setTheme } = useAppearance();
  const isDark = resolvedTheme === 'dark';
  const wheelRotation = useMotionValue(0);
  const isAnimatingRef = useRef(false);
  const wheelScale = useRootScale();

  const shiftBy = useCallback(
    (delta: number) => {
      if (delta === 0 || isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      void (async () => {
        flushSync(() => {
          wheelRotation.set(-delta * ITEM_ANGLE_DEG);
          setActive((prev) => wrapIndex(prev + delta, slides.length));
        });

        try {
          await animate(wheelRotation, 0, {
            duration: 0.58,
            ease: WHEEL_EASE,
          });
        } finally {
          wheelRotation.set(0);
          isAnimatingRef.current = false;
        }
      })();
    },
    [wheelRotation],
  );

  useEffect(() => {
    const id = window.setInterval(() => shiftBy(1), AUTO_SLIDE_INTERVAL);
    return () => window.clearInterval(id);
  }, [shiftBy]);

  const current = slides[active];
  const goPrevious = () => shiftBy(-1);
  const goNext = () => shiftBy(1);

  const goToSlide = (index: number) => {
    if (index === active) return;
    const fwd = (index - active + slides.length) % slides.length;
    const bwd = (active - index + slides.length) % slides.length;
    shiftBy(fwd <= bwd ? fwd : -bwd);
  };

  const toggleBg = isDark ? TOGGLE_BG_DARK : TOGGLE_BG_LIGHT;
  const toggleSel = isDark ? TOGGLE_SEL_DARK : TOGGLE_SEL_LIGHT;

  return (
    <div className="relative flex h-full w-full select-none flex-col overflow-hidden bg-[#F3F4F6] transition-colors dark:bg-[#1A1E28]">
      <div className="relative z-10 flex h-full flex-col px-4 py-3 md:px-5 md:py-4 lg:px-6 lg:py-4 xl:px-7 xl:py-5">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <Link href="/">
            <Image src={isDark ? "/dark%20mode%20logo.png" : "/light%20mode%20logo.png"} alt="Craftsman.ai" width={100} height={100} className="h-auto w-auto shrink-0 cursor-pointer" priority />
          </Link>
          {/* <Image src="/logo.png" alt="Craftsman.ai" width={118} height={34} className="h-auto w-auto shrink-0 dark:hidden" priority /> */}

          <div
            className="rounded-full px-2.5 py-1.5 text-center text-[0.625rem] tracking-wide text-white md:px-3 md:py-2 md:text-[0.6875rem] md:tracking-widest xl:px-4 xl:py-3 xl:text-[0.8125rem]"
            style={{ background: HEADER_GRADIENT }}
          >
            Every single perfectly captured
          </div>

          {/* Light / Dark toggle */}
          <div
            className="flex shrink-0 items-center rounded-full p-1.5 text-xs text-[#454C58] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] dark:text-[#9AA0AE] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] md:p-2"
            style={{ background: toggleBg }}
          >
            <button
              type="button"
              onClick={() => setTheme('light')}
              suppressHydrationWarning={true}
              className={`flex items-center gap-1 rounded-full px-2 py-1.5 transition-colors md:px-3 md:py-2 ${!isDark
                ? 'font-medium text-[#2F68C5] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                : 'cursor-pointer text-[#5C6475] hover:text-[#2F68C5] dark:text-[#6B7589] dark:hover:text-[#7BAAF7]'
                }`}
              style={!isDark ? { background: toggleSel } : undefined}
              aria-pressed={!isDark}
              aria-label="Switch to light mode"
            >
              <span className="hidden sm:inline">Light</span>
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              suppressHydrationWarning={true}
              className={`flex items-center gap-1 rounded-full px-2 py-1.5 transition-colors md:px-3 md:py-2 ${isDark
                ? 'font-medium text-[#2F68C5] shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:text-[#7BAAF7]'
                : 'cursor-pointer text-[#5C6475] hover:text-[#2F68C5] dark:text-[#6B7589] dark:hover:text-[#7BAAF7]'
                }`}
              style={isDark ? { background: toggleSel } : undefined}
              aria-pressed={isDark}
              aria-label="Switch to dark mode"
            >
              <span className="hidden sm:inline">Dark</span>
              <Moon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Main image stage */}
        <div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center md:mt-4 lg:mt-3">
          <button
            onClick={goPrevious}
            aria-label="Previous pendant"
            suppressHydrationWarning={true}
            className="absolute left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#EBEDF1]/95 text-[#252A33] transition hover:bg-white dark:bg-[#252D3D]/95 dark:text-[#E4E9F0] dark:hover:bg-[#2E3848] md:left-4"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={`img-${active}`}
              initial={{ opacity: 0, x: -28, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 28, scale: 0.96 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="relative h-64 w-44 sm:h-72 sm:w-52 md:h-80 md:w-60 lg:h-72 lg:w-52 xl:h-[24rem] xl:w-[18rem] 2xl:h-[28rem] 2xl:w-[20rem]"
            >
              <Image
                src={current.image}
                alt={current.name}
                fill
                sizes="(min-width: 1536px) 20rem, (min-width: 1280px) 18rem, (min-width: 1024px) 13rem, (min-width: 768px) 15rem, (min-width: 640px) 13rem, 11rem"
                className="object-contain drop-shadow-[0_22px_52px_rgba(66,94,142,0.22)]"
                priority
              />
            </motion.div>
          </AnimatePresence>

          <button
            onClick={goNext}
            aria-label="Next pendant"
            suppressHydrationWarning={true}
            className="absolute right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#EBEDF1]/95 text-[#252A33] transition hover:bg-white dark:bg-[#252D3D]/95 dark:text-[#E4E9F0] dark:hover:bg-[#2E3848] md:right-4"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Pagination dots */}
        <div className="mt-1 flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              suppressHydrationWarning={true}
              className={`h-2.5 w-2.5 rounded-full transition ${i === active
                ? 'bg-[#2F68C5]'
                : 'bg-[#CFD4DC] hover:bg-[#B8C0CE] dark:bg-[#3A4258] dark:hover:bg-[#4F5C7A]'
                }`}
            />
          ))}
        </div>

        {/* Bottom: title + wheel dial */}
        <div className="mt-2.5 grid gap-2.5 md:mt-3 lg:mt-2.5 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-end 2xl:grid-cols-[minmax(0,1fr)_20.5rem]">
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`copy-${active}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <h2 className="text-[1.125rem] font-medium capitalize leading-tight text-[#2F68C5] md:text-[1.25rem] lg:text-[1.125rem] xl:text-[1.375rem] 2xl:text-[1.625rem]">
                  {current.name}
                </h2>
                <p className="mt-0.5 text-[0.6875rem] leading-snug text-[#232936]/85 dark:text-[#8A94A6] md:text-xs lg:text-[0.6875rem] xl:text-[0.75rem]">{current.subtitle}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-2.5 flex flex-nowrap items-center gap-1.5 md:gap-2">
              <GradientChip label="render in minutes" />
              <GradientChip label="Client ready previews" />
            </div>
          </div>

          {/* iOS-style drum-roll wheel */}
          <div className="w-full xl:w-[19rem] xl:justify-self-end 2xl:w-[20.5rem] -mb-10 -mr-3">
            <div className="w-full rounded-[1.375rem] px-2 py-2 md:px-3 md:py-2.5">
              <div className="flex items-center gap-2.5 py-1">
                <div className="min-w-0 flex-1">
                  <AngleWheel activeIndex={active} wheelRotation={wheelRotation} isDark={isDark} rootScale={wheelScale} />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
