"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import Image from "next/image";

const categories = [
  { id: 1, name: "Pendant",   image: "/scroll1.png", label: "Custom Pendant" },
  { id: 2, name: "Bracelet", image: "/scroll4.png", label: "Custom Bracelet" },
  { id: 3, name: "Ring",     image: "/scroll3.png", label: "Custom Ring" },
  { id: 4, name: "Earrings", image: "/scroll2.png", label: "Custom Earrings" },
];

const CARD_COUNT = categories.length;

function CardItem({
  cat,
  index,
  smoothIndex,
  cardGap,
  onClick,
}: {
  cat: (typeof categories)[0];
  index: number;
  smoothIndex: ReturnType<typeof useSpring>;
  cardGap: number;
  onClick?: () => void;
}) {
  const y = useTransform(smoothIndex, (v) => {
    const diff = index - v;
    if (diff > 0) return diff * cardGap + diff * diff * 30;
    return diff * cardGap;
  });

  const x = useTransform(smoothIndex, (v) => {
    const diff = index - v;
    if (diff > 0) return Math.min(24, diff * 12);
    if (diff < 0) return Math.max(-16, diff * 8);
    return 0;
  });

  const scale = useTransform(smoothIndex, (v) => {
    const diff = index - v;
    const dist = Math.abs(diff);
    if (diff > 0) return Math.max(0.72, 1 - dist * 0.14);
    return Math.max(0.84, 1 - dist * 0.08);
  });

  const filter = useTransform(smoothIndex, (v) => {
    const dist = Math.abs(index - v);
    return `blur(${Math.min(4, dist * 2)}px)`;
  });

  const overlayOpacity = useTransform(smoothIndex, (v) => {
    const dist = Math.abs(index - v);
    return Math.min(0.75, dist * 0.38);
  });

  const zIndex = useTransform(smoothIndex, (v) => {
    const dist = Math.abs(index - v);
    return Math.round(100 - dist * 10);
  });

  return (
    <motion.div
      style={{ y, x, scale, zIndex, cursor: onClick ? "pointer" : "default" }}
      className="absolute inset-0 rounded-3xl shadow-[0px_21px_46px_0px_rgba(0,0,0,0.15),0px_83px_83px_0px_rgba(0,0,0,0.12),0px_187px_112px_0px_rgba(0,0,0,0.08)]"
      onClick={onClick}
    >
      <motion.div
        style={{ filter }}
        className="absolute inset-0 rounded-3xl bg-white overflow-hidden"
      >
        <Image
          src={cat.image}
          alt={cat.label}
          fill
          sizes="(max-width: 768px) 92vw, 65vw"
          className="object-contain sm:object-cover"
          priority={index === 0}
        />
        <motion.div
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 bg-white pointer-events-none"
        />
      </motion.div>
    </motion.div>
  );
}

export default function ScrollShowcaseSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [pinState, setPinState] = useState<"before" | "pinned" | "after">("before");
  const pinStateRef = useRef(pinState);
  const snapLocked = useRef(false);
  const targetIndex = useRef(0);

  // Tie scroll to this container â€” same pattern as ScrollTriggerWorkflow
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Map 0â†’1 scroll to 0â†’(CARD_COUNT-1) float index
  const rawIndex = useTransform(
    scrollYProgress,
    [0, 1],
    [0, CARD_COUNT - 1]
  );

  const springIndex = useSpring(rawIndex, { stiffness: 60, damping: 20, mass: 0.5 });

  useMotionValueEvent(rawIndex, "change", (latest) => {
    const rounded = Math.min(CARD_COUNT - 1, Math.round(latest));
    // Keep targetIndex in sync when scroll changes without snap (e.g. browser back/forward)
    if (!snapLocked.current) targetIndex.current = rounded;
    setActiveIndex((prev) => {
      if (rounded !== prev) setPrevIndex(prev);
      return rounded;
    });
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextState = latest <= 0 ? "before" : latest >= 1 ? "after" : "pinned";
    if (nextState !== pinStateRef.current) {
      pinStateRef.current = nextState;
      setPinState(nextState);
    }
  });

  const direction = activeIndex >= prevIndex ? 1 : -1;

  // ── Snap scroll ──────────────────────────────────────────────────────────
  // Each card occupies exactly 100vh of the container's scroll range.
  // Snap point for card i = containerOffsetTop + i * innerHeight

  const snapToCard = useCallback((index: number) => {
    const el = containerRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY + index * window.innerHeight;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const handleCardClick = useCallback((index: number) => {
    if (index < 0 || index >= CARD_COUNT) return;
    if (snapLocked.current) return;
    snapLocked.current = true;
    targetIndex.current = index;
    snapToCard(index);
    setTimeout(() => { snapLocked.current = false; }, 1000);
  }, [snapToCard]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const isActive = rect.top <= 2 && rect.bottom >= window.innerHeight - 2;
      if (!isActive) return;

      const goingDown = e.deltaY > 0;
      if (!goingDown && targetIndex.current === 0) return;
      if (goingDown && targetIndex.current === CARD_COUNT - 1) return;

      e.preventDefault();
      if (snapLocked.current) return;
      snapLocked.current = true;

      const nextIndex = goingDown
        ? Math.min(targetIndex.current + 1, CARD_COUNT - 1)
        : Math.max(targetIndex.current - 1, 0);

      targetIndex.current = nextIndex;
      snapToCard(nextIndex);
      setTimeout(() => { snapLocked.current = false; }, 1000);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [snapToCard]);

  // Touch snap
  const touchStartY = useRef<number | null>(null);
  useEffect(() => {
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      if (touchStartY.current === null) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const isActive = rect.top <= 2 && rect.bottom >= window.innerHeight - 2;
      if (!isActive) return;

      const delta = touchStartY.current - e.changedTouches[0].clientY;
      touchStartY.current = null;
      if (Math.abs(delta) < 40) return;

      const goingDown = delta > 0;
      if (!goingDown && targetIndex.current === 0) return;
      if (goingDown && targetIndex.current === CARD_COUNT - 1) return;

      e.preventDefault();
      if (snapLocked.current) return;
      snapLocked.current = true;

      const nextIndex = goingDown
        ? Math.min(targetIndex.current + 1, CARD_COUNT - 1)
        : Math.max(targetIndex.current - 1, 0);

      targetIndex.current = nextIndex;
      snapToCard(nextIndex);
      setTimeout(() => { snapLocked.current = false; }, 1000);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: false });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [snapToCard]);
  // ─────────────────────────────────────────────────────────────────────────

  // Responsive card dimensions — larger on mobile (<md), standard on md+
  const [cardDims, setCardDims] = useState({
    w: "min(720px, 65vw)",
    h: "min(522px, calc(65vw * 580 / 800))",
  });

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 768) {
        setCardDims({
          w: "min(800px, 92vw)",
          h: "min(580px, calc(92vw * 580 / 800))",
        });
      } else {
        setCardDims({
          w: "min(720px, 65vw)",
          h: "min(522px, calc(65vw * 580 / 800))",
        });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const cardW = cardDims.w;
  const cardH = cardDims.h;
  const cardGapPx = 522 + 50; // used only for motion calculations (px)

  return (
    // Outer tall container â€” CARD_COUNT * 100vh gives one full viewport per card
    // contain:"layout" is critical â€” prevents parent overflow from breaking sticky
    <div
      ref={containerRef}
      className="relative z-0"
      style={{ height: `${CARD_COUNT * 100}vh`, position: "relative" }}
    >
      {/* Only this inner div is sticky */}
      <div
        className="h-screen overflow-hidden"
        style={{
          ...(pinState === "pinned"
            ? { position: "fixed", top: "1.25rem", left: 0, right: 0, height: "100vh", zIndex: 5 }
            : pinState === "after"
              ? { position: "absolute", bottom: 0, left: 0, right: 0, height: "100vh" }
              : { position: "absolute", top: 0, left: 0, right: 0, height: "100vh" }),
          backgroundImage: "url('/scrollcontentbgimage.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Decorative diamond */}
        <svg
          className="absolute right-0 top-1/2 -translate-y-1/2 w-40 h-52 sm:w-80 sm:h-96 opacity-15 pointer-events-none hidden sm:block"
          viewBox="0 0 320 400" fill="none"
        >
          <ellipse cx="160" cy="200" rx="140" ry="190" stroke="#C4B49A" strokeWidth="0.8" />
          <ellipse cx="160" cy="200" rx="105" ry="145" stroke="#C4B49A" strokeWidth="0.8" />
          <ellipse cx="160" cy="200" rx="70"  ry="100" stroke="#C4B49A" strokeWidth="0.8" />
          <ellipse cx="160" cy="200" rx="35"  ry="55"  stroke="#C4B49A" strokeWidth="0.8" />
        </svg>

        {/* Decorative circles */}
        <svg
          className="absolute -left-8 sm:-left-16 bottom-0 w-32 h-32 sm:w-56 sm:h-56 opacity-15 pointer-events-none"
          viewBox="0 0 240 240" fill="none"
        >
          <circle cx="120" cy="120" r="115" stroke="#C4B49A" strokeWidth="0.8" />
          <circle cx="120" cy="120" r="80"  stroke="#C4B49A" strokeWidth="0.8" />
          <circle cx="120" cy="120" r="45"  stroke="#C4B49A" strokeWidth="0.8" />
        </svg>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col relative">

          {/* Card + label area */}
          <div className="flex-1 min-h-0 flex items-center justify-center relative pt-16 sm:pt-40">
            <div className="flex flex-col sm:block items-center gap-2 sm:gap-0">

              {/* Animated label */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: direction * 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: direction * -18 }}
                  transition={{ duration: 0.38, ease: "easeInOut" }}
                  className="sm:absolute sm:left-0 sm:top-1/2 font-satoshi sm:-translate-y-1/2 pointer-events-none text-center sm:text-left"
                  style={{ zIndex: 2250 }}
                >
                  <p className="text-xl sm:text-3xl md:text-5xl lg:text-6xl whitespace-nowrap ">
                    <span className="text-[#8A8A8A] font-medium ml-5">
                      {categories[activeIndex].label.split(" ")[0]}{" "}
                    </span>
                    <span className="text-[#1A1A1A] font-medium ml-5">
                      {categories[activeIndex].label.split(" ").slice(1).join(" ")}
                    </span>
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Card stack */}
              <div
                className="relative"
                style={{ width: cardW, height: cardH }}
              >
                <CardItem key="virtual-start" cat={categories[CARD_COUNT - 1]} index={-1} smoothIndex={springIndex} cardGap={cardGapPx} />
                {categories.map((cat, i) => (
                  <CardItem key={cat.id} cat={cat} index={i} smoothIndex={springIndex} cardGap={cardGapPx} onClick={() => handleCardClick(i)} />
                ))}
                <CardItem key="virtual-end" cat={categories[0]} index={CARD_COUNT} smoothIndex={springIndex} cardGap={cardGapPx} />
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="shrink-0 flex items-center justify-between pb-5 sm:pb-8">
            {/* Category names */}
            <div className="flex flex-row sm:flex-col gap-3 sm:gap-0.5">
              {categories.map((cat, i) => (
                <motion.p
                  key={cat.id}
                  animate={{ opacity: i === activeIndex ? 1 : 0.3 }}
                  transition={{ duration: 0.3 }}
                  className={`text-xs sm:text-lg text-[#1A1A1A] cursor-default ${
                    i === activeIndex ? "font-medium" : "font-normal"
                  }`}
                >
                  {cat.name}
                </motion.p>
              ))}
            </div>

            {/* Progress dots */}
            {/* <div className="flex sm:flex-col gap-1.5 items-center">
              {categories.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    width:   i === activeIndex ? 6 : 6,
                    height:  i === activeIndex ? 20 : 6,
                    opacity: i === activeIndex ? 1 : 0.3,
                  }}
                  transition={{ duration: 0.3 }}
                  className="rounded-full bg-[#1A1A1A]"
                />
              ))}
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}

