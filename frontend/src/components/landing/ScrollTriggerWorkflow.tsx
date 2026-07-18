"use client";

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";

// 5 timeline steps
const STEPS = [
  { id: 0, label: "Design" },
  { id: 1, label: "Approve" },
  { id: 2, label: "Send" },
  { id: 3, label: "Quotation" },
  { id: 4, label: "Production" },
];

// 6 content states — image changes at each scroll segment
const CONTENT_STATES = [
  {
    stepIndex: 0,
    desc: "Upload inspiration or sketch",
    image: "/ScrollTrigger-Workflow/Image-1.png",
  },
  {
    stepIndex: 0,
    desc: "Generate accurate render instantly",
    image: "/ScrollTrigger-Workflow/Image-2.png",
  },
  {
    stepIndex: 1,
    desc: "Get customer approval via secure link",
    image: "/ScrollTrigger-Workflow/Image-3.png",
  },
  {
    stepIndex: 2,
    desc: "Send to manufacturer for costing",
    image: "/ScrollTrigger-Workflow/Image-4.png",
  },
  {
    stepIndex: 3,
    desc: "Approve from multiple manufacturer quotation",
    image: "/ScrollTrigger-Workflow/Image-5.png",
  },
  {
    stepIndex: 4,
    desc: "Production Started",
    image: "/ScrollTrigger-Workflow/Image-6.png",
  },
];

const SCROLL_SEGMENTS = CONTENT_STATES.length; // 6
const TIMELINE_STEPS = STEPS.length; // 5

export default function ScrollTriggerWorkflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentIndex, setContentIndex] = useState(0);
  const [pinState, setPinState] = useState<"before" | "pinned" | "after">("before");
  const pinStateRef = useRef(pinState);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Map scrollYProgress → content state index (0–5)
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextState = latest <= 0 ? "before" : latest >= 1 ? "after" : "pinned";
    if (nextState !== pinStateRef.current) {
      pinStateRef.current = nextState;
      setPinState(nextState);
    }
    const idx = Math.min(
      SCROLL_SEGMENTS - 1,
      Math.floor(latest * SCROLL_SEGMENTS),
    );
    setContentIndex(idx);
  });

  const currentState = CONTENT_STATES[contentIndex];
  const currentStepIndex = currentState.stepIndex;

  // Line fill: 6 scroll segments → holds at 25% during Design→Approve transition
  const lineWidth = useTransform(
    scrollYProgress,
    [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1],
    ["0%", "0%", "25%", "50%", "75%", "100%", "100%"],
  );

  return (
    <section id="how-it-works" className="bg-[#333437] w-full mb-10" style={{ backgroundImage: "url('/ScrollTriggerImage.png')", backgroundSize: "cover", backgroundPosition: "top", backgroundRepeat: "no-repeat", backgroundAttachment: "fixed" }}>
      {/* ── Heading — normal scroll, outside sticky zone ── */}
      <div className=" w-full px-4 pt-10 pb-4 sm:pt-14 sm:pb-6 flex flex-col items-center gap-4">
        <h2 className="w-full font-satoshi text-center text-2xl sm:text-3xl lg:text-4xl tracking-wide text-white leading-tight max-w-3xl">
          Designed for Your Real Custom Workflow.
        </h2>
      </div>

      {/* ── Scroll container — only the inner panel is sticky ── */}
      <div
        ref={containerRef}
        className="relative"
        style={{ height: `${SCROLL_SEGMENTS * 100}vh`, position: "relative" }}
      >
        {/* Only this div is sticky */}
        <div
          className="flex flex-col h-screen items-center px-4 sm:px-8 py-4 sm:py-6 gap-3 sm:gap-5 overflow-hidden"
          style={
            pinState === "pinned"
              ? { position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 5 }
              : pinState === "after"
                ? { position: "absolute", bottom: 0, left: 0, right: 0, height: "100vh" }
                : { position: "absolute", top: 0, left: 0, right: 0, height: "100vh" }
          }
        >

          {/* ── Timeline ── */}
          <div className="w-full max-w-72 md:max-w-3xl px-1 sm:px-2 mt-24">
            {/* Label row */}
            <div className="relative h-5 w-full mb-2">
              {STEPS.map((step, i) => {
                const pct = (i / (TIMELINE_STEPS - 1)) * 100;
                const transform =
                  i === 0
                    ? "translateX(0%)"
                    : i === TIMELINE_STEPS - 1
                      ? "translateX(-100%)"
                      : "translateX(-50%)";
                return (
                  <span
                    key={step.id}
                    style={{ left: `${pct}%`, transform }}
                    className={`absolute top-0 text-[10px] sm:text-xs  tracking-wider transition-colors duration-300 whitespace-nowrap ${i <= currentStepIndex ? "text-[#2F68C5] z-2" : "text-[#F1F1F1]"
                      }
                    ${i == 0 ? "-ml-5" : i == 4 ? "ml-5" : ""}
                    `}
                  >
                    {step.label}
                  </span>
                );
              })}
            </div>

            {/* Track + dots */}
            <div className="relative h-0.5 bg-[#E3E3E3] rounded-full">
              <motion.div
                className="absolute left-0 top-0 h-full bg-[#2F68C5] rounded-full"
                style={{ width: lineWidth }}
              />
              {STEPS.map((step, i) => {
                const pct = (i / (TIMELINE_STEPS - 1)) * 100;
                return (
                  <motion.div
                    key={step.id}
                    style={{ left: `${pct}%` }}
                    animate={{
                      backgroundColor:
                        i <= currentStepIndex ? "#2F68C5" : "#E3E3E3",
                    }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full z-10 border-0"
                  />
                );
              })}
            </div>
          </div>

          {/* ── Step description ── */}
          <div className="h-7 sm:h-8 flex items-center justify-center my-5 mt-16 md:mt-10">
            <AnimatePresence mode="wait">
              <motion.p
                key={contentIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-base sm:text-lg md:text-2xl xl:text-3xl text-[#F1F1F1] text-center"
              >
                {currentState.desc}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* ── Image area ── */}
          <div className="relative flex-1 w-full max-w-5xl flex items-center justify-center min-h-0">
            {CONTENT_STATES.map((state, i) => (
              <motion.div
                key={i}
                initial={false}
                animate={{
                  opacity: i === contentIndex ? 1 : 0,
                  filter:
                    i === contentIndex
                      ? "blur(0px) brightness(1)"
                      : "blur(12px) brightness(0.5)",
                }}
                transition={{
                  opacity: { duration: 0.75, ease: "easeInOut" },
                  filter: { duration: 0.3, ease: "easeInOut" },
                }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <img
                  src={state.image}
                  alt={state.desc}
                  className="max-h-full max-w-full w-auto object-contain rounded-xl sm:rounded-2xl shadow-2xl"
                  style={{
                    boxShadow:
                      i === contentIndex
                        ? "0 25px 60px -10px rgba(47, 104, 197, 0.35), 0 10px 30px -5px rgba(0,0,0,0.5)"
                        : "none",
                  }}
                />
              </motion.div>
            ))}
          </div>

          <div className="w-full flex md:hidden justify-center py-8 sm:py-10">
            <div className="rounded-full border border-gray-700 bg-linear-to-b from-[#F1F1F1] to-[#E2ECFE] px-4 md:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium">
              <span
                style={{
                  background:
                    "linear-gradient(90deg, #2C62B9 0%, #7C3AED 50%, #1FBED6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                No guesswork. No chaos.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom gradient pill — normal scroll, outside sticky zone ── */}
      <div className="w-full hidden md:flex justify-center py-8 sm:py-10">
        <div className="rounded-full border border-gray-700 bg-gradient-to-b from-[#F1F1F1] to-[#E2ECFE] px-16 sm:px-24 py-2.5 sm:py-3 text-sm sm:text-base font-medium">
          <span
            style={{
              background:
                "linear-gradient(90deg, #2C62B9 0%, #7C3AED 50%, #1FBED6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            No guesswork. No chaos.
          </span>
        </div>
      </div>
    </section>
  );
}
