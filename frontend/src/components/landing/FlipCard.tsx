"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface FlipCardProps {
  frontImage: string;
  backImage: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function FlipCard({
  frontImage,
  backImage,
  alt = "Card",
  width = 400,
  height = 500,
  className = "",
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    // Perspective wrapper — required for 3D depth effect
    <div
      className={`relative cursor-pointer ${className}`}
      style={{ perspective: "1200px", width, height }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      {/* Card inner — rotates in 3D */}
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{
          type: "spring",
          stiffness: 80,
          damping: 14,
          duration: 0.6,
        }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* ── FRONT ── */}
        <div
          className="absolute inset-0 w-full h-full rounded-[20px] overflow-hidden shadow-xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          <Image
            src={frontImage}
            alt={`${alt} front`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>

        {/* ── BACK ── */}
        <div
          className="absolute inset-0 w-full h-full rounded-[20px] overflow-hidden shadow-xl"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <Image
            src={backImage}
            alt={`${alt} back`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </motion.div>
    </div>
  );
}
