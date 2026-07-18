"use client";

import { Sparkles } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

// The visible handle
const SliderHandle = () => (
  <div className="flex items-center justify-center gap-0.5 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#1E1E1E] shadow-lg border-2 border-white cursor-ew-resize">
    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  </div>
);

export default function CompareSection() {
  const [sliderPos, setSliderPos] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const clampedPos = Math.min(1, Math.max(0, sliderPos));

  const calcPos = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    setSliderPos(Math.min(1, Math.max(0, (clientX - left) / width)));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    calcPos(e.clientX);
  }, [calcPos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    calcPos(e.clientX);
  }, [calcPos]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <section className="relative w-full pt-4 sm:pt-8 md:pt-20 lg:pt-24 pb-10 sm:pb-14 md:pb-20 lg:pb-24 bg-cover bg-center bg-no-repeat bg-[url('/bgimagecamplare.png')]">
      {/* Color overlay with opacity */}
      <div className="absolute inset-0 bg-[#FAF6F3]/50 pointer-events-none" />
      <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex justify-center mb-4 sm:mb-5"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-[#3575dd] text-white text-xs sm:text-sm font-light tracking-wider">
            <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
            Renders
          </span>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          className="text-center mb-6 sm:mb-8 md:mb-10 px-2"
        >
          <h2 className="font-satoshi font-base text-[#1E1E1E] text-[28px] sm:text-[34px] md:text-[40px] font-medium leading-[1.3] tracking-normal">
            Let&apos;s turn your Jewelry ideas into
            <br className="hidden sm:block" /> something real.
          </h2>
        </motion.div>

        {/* Compare Slider */}
        <div
          ref={containerRef}
          className="relative mx-auto rounded-xl sm:rounded-2xl overflow-hidden shadow-lg sm:shadow-xl border border-gray-200 cursor-ew-resize select-none"
          style={{ touchAction: "none", userSelect: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Right image — sets container height naturally */}
          <img
            src="/compare1.png"
            alt="After"
            draggable={false}
            className="w-full h-auto block pointer-events-none"
          />

          {/* Left image — same size, clipped from the right via clipPath */}
          <img
            src="/compare2.png"
            alt="Before"
            draggable={false}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              objectFit: "cover",
              objectPosition: "left top",
              clipPath: `inset(0 ${(1 - clampedPos) * 100}% 0 0)`,
            }}
          />

          {/* Divider line */}
          <div
            className="absolute inset-y-0 w-px bg-white/60 pointer-events-none z-10"
            style={{ left: `${clampedPos * 100}%` }}
          />

          {/* Handle — centered on divider, pinned to bottom */}
          <div
            className="absolute bottom-3 sm:bottom-4 z-20 pointer-events-none"
            style={{ left: `${clampedPos * 100}%`, transform: "translateX(-50%)" }}
          >
            <SliderHandle />
          </div>
        </div>

        {/* Description */}
        <p className="mt-5 sm:mt-6 text-sm sm:text-base md:text-lg lg:text-[24px] font-normal text-[#515151] text-left leading-relaxed font-satoshi">
          Turn{" "}
          <strong className="text-[#1E1E1E] font-medium">
            sketches, references,
          </strong>{" "}
          or{" "}
          <strong className="text-[#1E1E1E] font-medium">ideas</strong> into{" "}
          <strong className="text-[#1E1E1E] font-medium">
            realistic
          </strong> jewelry{" "}
          <strong className="text-[#1E1E1E] font-medium">
            designs,
          </strong>{" "}
          streamline approvals
          and move into production without the back-and-forth.
        </p>
      </div>
    </section>
  );
}
