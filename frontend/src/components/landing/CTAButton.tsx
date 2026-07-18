"use client";

import Link from "next/link";
import { useState } from "react";

const ArrowSVG = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="-8.7 5.3 9.4 9.4"
    fill="none"
  >
    <path
      d="M-8.16699 5.83331H0.166341M0.166341 5.83331V14.1666M0.166341 5.83331L-8.16699 14.1666"
      stroke="#2C62B9"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Gap between arrows along the diagonal axis (px)
const STEP = 28;

interface CTAButtonProps {
  text?: string;
  href?: string;
  width?: string;
}

const CTAButton = ({
  text = "Start Creating for Free",
  href = "/signup",
  width = "275px",
}: CTAButtonProps) => {
  const [hovered, setHovered] = useState(false);

  const targetHref = href === "/contact-us" ? "/#contact-us" : href;
  const isLandingHash = targetHref.startsWith("/#");

  const commonProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onClick: (e: any) => {
      if (isLandingHash) {
        const targetId = targetHref.substring(2);
        if (window.location.pathname === "/" || window.location.pathname === "") {
          e.preventDefault();
          const target = document.getElementById(targetId);
          if (target) {
            target.scrollIntoView({ behavior: "smooth" });
          }
        }
      }
    },
    className: "relative overflow-hidden z-10 flex items-center justify-between gap-4 text-white text-base font-medium",
    style: {
      width: width,
      padding: "10px 16px 10px 24px",
      borderRadius: "24px",
      background: "#2C62B9",
      boxShadow: hovered
        ? "0 25px 10px 0 rgba(0,0,0,0.03), 0 12px 32px 0 rgba(0,0,0,0.2), 0 2px 8px 0 rgba(0,0,0,0.15)"
        : "0 0 0 0 rgba(0,0,0,0.00), 0 0 0 0 rgba(0,0,0,0.01), 0 0 0 0 rgba(0,0,0,0.05), 0 0 0 0 rgba(0,0,0,0.09), 0 0 0 0 rgba(0,0,0,0.10)",
      transition: "box-shadow 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
    }
  };

  const childrenContent = (
    <div className="flex items-center justify-between w-full z-10">
      <span className="text-white text-[16px] font-medium leading-snug tracking-wider text-nowrap">
        {text}
      </span>

      {/* Arrow Icon Circle — overflow hidden clips the moving group */}
      <span
        className="relative bg-white shrink-0 overflow-hidden"
        style={{ width: "32px", height: "32px", borderRadius: "50%" }}
      >
        {/*
          Single group containing all 3 arrows arranged diagonally.
          Arrow 1 sits at the center (visible at rest).
          Arrow 2 sits STEP px below-left of center.
          Arrow 3 sits 2×STEP px below-left of center.
          On hover the group translates 2×STEP px toward top-right,
          bringing Arrow 3 to the center — passing Arrow 2 through it.
        */}
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transition: "transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: hovered
              ? `translate(calc(-50% + ${2 * STEP}px), calc(-50% - ${2 * STEP}px))`
              : "translate(-50%, -50%)",
          }}
        >
          {/* Arrow 1 — at center (index 0) */}
          <span
            className="absolute flex items-center justify-center"
            style={{ top: 0, left: 0, transform: "translate(-50%, -50%)" }}
          >
            <ArrowSVG />
          </span>

          {/* Arrow 2 — 1 step below-left */}
          <span
            className="absolute flex items-center justify-center"
            style={{
              top: STEP,
              left: -STEP,
              transform: "translate(-50%, -50%)",
            }}
          >
            <ArrowSVG />
          </span>

          {/* Arrow 3 — 2 steps below-left, lands at center on hover */}
          <span
            className="absolute flex items-center justify-center"
            style={{
              top: 2 * STEP,
              left: -2 * STEP,
              transform: "translate(-50%, -50%)",
            }}
          >
            <ArrowSVG />
          </span>
        </span>
      </span>
    </div>
  );

  const glowElement = (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        width: `calc(${width} + 5px)`,
        height: "24px",
        left: "0px",
        bottom: hovered ? "-8px" : "-15px",
        opacity: hovered ? 1 : 0.8,
        transition: "bottom 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 1s cubic-bezier(0.4, 0, 0.2, 1)",
        borderRadius: "50%",
        background: "#22D3EE",
        filter: "blur(10px)",
        zIndex: 0,
      }}
    />
  );

  return (
    <div className="relative inline-flex flex-col items-center  justify-center">
      {isLandingHash ? (
        <a href={targetHref} {...commonProps}>
          {childrenContent}
          {glowElement}
        </a>
      ) : (
        <Link href={targetHref} {...commonProps}>
          {childrenContent}
          {glowElement}
        </Link>
      )}
    </div>
  );
};

export default CTAButton;
