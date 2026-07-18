"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import CTAButton from "./CTAButton";

const cards = [
  {
    id: 1,
    title: "Sketch to Render",
    frontImage: "/Anything1.png",
    backImage: "/Anythinghover1.png",
  },
  {
    id: 2,
    title: "Photo to Render",
    frontImage: "/Anything2.png",
    backImage: "/Anythinghover2.png",
  },
  {
    id: 3,
    title: "Product Link to Render",
    frontImage: "/Anything3.png",
    backImage: "/Anythinghover3.png",
  },
  {
    id: 4,
    title: "Text to Render",
    frontImage: "/Anything4.png",
    backImage: "/Anythinghover4.png",
  },
  {
    id: 5,
    title: "CAD to Enhanced Render",
    frontImage: "/Anything5.png",
    backImage: "/Anythinghover5.png",
  },
];

function FlipCard({
  title,
  frontImage,
  backImage,
}: {
  title: string;
  frontImage: string;
  backImage: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`rounded-[20px] p-px transition-all duration-300 cursor-pointer ${hovered
          ? "bg-[linear-gradient(90deg,#2C62B9_12.98%,#7C3AED_43.27%,#1FBED6_71.15%)]"
          : "bg-transparent"
        }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="bg-[#F1F1F1] rounded-[20px] p-4 sm:p-5 flex flex-col sm:h-[360px]">
        {/* Title */}
        <p className="text-lg sm:text-2xl font-medium font-satoshi text-[#1E1E1E] text-center mb-3 leading-snug shrink-0">
          {title}
        </p>

        {/* Image area */}
        <div className="relative w-full h-[220px] sm:h-[245px] mt-auto flex items-center justify-center">
          {/* Front image */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ opacity: hovered ? 0 : 1 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <Image
              src={frontImage}
              alt={title}
              width={250}
              height={245}
              className="object-contain max-w-full max-h-full"
            />
          </motion.div>

          {/* Back image */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <Image
              src={backImage}
              alt={`${title} hover`}
              width={250}
              height={245}
              className="object-contain max-w-full max-h-full"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function InputToRenderSection() {
  return (
    <section className="w-full bg-[#FAF6F3] py-10 sm:py-14 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top row: heading + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-10"
        >
          <h2 className="text-xl sm:text-2xl md:text-3xl font-medium text-[#1E1E1E] leading-snug max-w-3xl font-satoshi">
            From Anything{" "}
            <span className="inline-block">→</span>{" "}
            To Accurate Render in Minutes.
          </h2>
          {/* <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#3575DD]  text-[#E9EFFD] px-5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            Start Creating Free
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link> */}

          <CTAButton />
        </motion.div>

        {/* Cards — continuous left-to-right auto sliding marquee */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          className="relative w-full overflow-hidden py-4"
        >
          <style>{`
            @keyframes marquee-ltr {
              0% {
                transform: translateX(-50%);
              }
              100% {
                transform: translateX(0%);
              }
            }
            .marquee-inner {
              display: flex;
              width: max-content;
              animation: marquee-ltr 30s linear infinite;
            }
            .marquee-inner:hover {
              animation-play-state: paused;
            }
          `}</style>
          <div className="marquee-inner">
            <div className="flex gap-4 pr-4 shrink-0">
              {cards.map((card) => (
                <div key={`set1-${card.id}`} className="w-[280px] sm:w-[320px] shrink-0">
                  <FlipCard {...card} />
                </div>
              ))}
            </div>
            <div className="flex gap-4 pr-4 shrink-0">
              {cards.map((card) => (
                <div key={`set2-${card.id}`} className="w-[280px] sm:w-[320px] shrink-0">
                  <FlipCard {...card} />
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Bottom text */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
          className="mt-8 sm:mt-10"
        >
          <h3 className="text-xl sm:text-2xl md:text-3xl font-medium text-[#1E1E1E] font-satoshi">
            No matter how rough the input
          </h3>
          <p className="text-xl sm:text-2xl md:text-3xl font-normal text-[#515151] font-satoshi">
            CraftsmanAI structures, refines, and renders it with market-leading accuracy.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
