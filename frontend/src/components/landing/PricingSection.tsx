"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import Link from "next/link";

type BillingCycle = "monthly" | "yearly";

const pricingPlans = [
  {
    name: "Starter",
    price: "$99.99",
    subtitle: "/ month",
    renders: "300 renders per month",
    users: "1 user",
    branding: "No branding on external pages",
    buttonText: "Start Free Trial",
    popular: false,
    features: [
      "AI Jewelry render generation",
      "Sketch to render conversion",
      "Image to render conversion",
      "Text prompt to render",
      "Customer approval sharing",
      "Download high-resolution renders",
      "Email support",
    ],
  },
  {
    name: "Pro",
    price: "$199.99",
    subtitle: "/ month",
    renders: "700 renders per month",
    users: "Up to 3 users",
    branding: "Logo + Powered by CraftsmanAI",
    buttonText: "Start Free Trial",
    popular: true,
    features: [
      "Everything in Starter",
      "Smart AI design detection",
      "Customer approval dashboard",
      "Manufacturer quotation workflow",
      "Multi-customer management",
      "Faster AI processing",
      "Priority support",
    ],
  },
  {
    name: "Business",
    price: "$299.99",
    subtitle: "/ month",
    renders: "1,300 renders per month",
    users: "Up to 8 users",
    branding: "Full custom branding",
    buttonText: "Start Free Trial",
    popular: false,
    features: [
      "Everything in Pro",
      "Full custom branding",
      "No Powered by CraftsmanAI text",
      "Priority support",
      "Larger render capacity",
      "Multi-user business workflow",
    ],
  },
  {
    name: "Custom",
    price: "Contact Sales",
    subtitle: "",
    renders: "Custom",
    users: "Custom",
    branding: "Tailored",
    buttonText: "Contact Sales",
    popular: false,
    features: [
      "Custom render allocation",
      "Custom user allocation",
      "Tailored onboarding",
      "Dedicated support",
      "Custom business requirements",
      "Enterprise-level flexibility",
    ],
  },
];

const trustBadges = [
  "Cancel anytime",
  "Secure payments",
  "Quick onboarding",
  "Dedicated support",
];

export default function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  return (
    <section
      id="pricing"
      className="relative w-full pt-8 pb-14 sm:pt-10 sm:pb-18 md:pt-12 md:pb-24 bg-[#FAF6F3]"
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Pricing pill badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center gap-2 bg-[#3575DD] text-white tracking-wider text-xs sm:text-sm font-light px-4 py-1.5 rounded-full"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Pricing
        </motion.div>

        {/* Main Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          className="text-3xl sm:text-4xl lg:text-[48px] font-normal font-satoshi text-[#1E1E1E] text-center leading-tight mt-5"
        >
          Simple Pricing Built for

          Jewelry Retailers
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
          className="mt-6 text-center text-[#2C62B9] text-base md:text-lg leading-relaxed max-w-3xl font-normal"
        >
          Close 1 Custom Deal this software pays for itself. Most Affordable in the market and the Most Accurate Model in Jewelry.
        </motion.p>

        {/* Free trial text */}


        {/* Monthly/Yearly Toggle */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
          className="mt-8 flex items-center justify-center"
        >
          <div className="relative inline-flex items-center bg-white shadow-sm border border-[#E5E7EB] rounded-full p-1.5">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`relative z-10 px-6 sm:px-8 py-2.5 text-sm sm:text-base font-medium rounded-full transition-all ${billingCycle === "monthly"
                ? "bg-[#1F2937] text-white shadow-sm"
                : "text-[#6B7280]"
                }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative z-10 px-6 sm:px-8 py-2.5 text-sm sm:text-base font-medium rounded-full transition-all flex items-center gap-2 ${billingCycle === "yearly"
                ? "bg-[#1F2937] text-white shadow-sm"
                : "text-[#6B7280]"
                }`}
            >
              Yearly
              <span className="bg-[#FAF6F3] text-[#8A8A8A] text-xs font-semibold px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div> */}

        {/* Pricing Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1 }}
          onMouseLeave={() => setHoveredPlan(null)}
          className="mt-12 w-full grid grid-cols-1 lg:grid-cols-4 gap-5"
        >
          {pricingPlans.map((plan) => {
            const isHighlighted = hoveredPlan ? plan.name === hoveredPlan : plan.popular;

            return (
              <div
                key={plan.name}
                onMouseEnter={() => setHoveredPlan(plan.name)}
                className={`bg-white rounded-[20px] p-8 flex flex-col shadow-md border-2 origin-top transition-all duration-300 ${isHighlighted
                    ? "border-[#3B82F6] shadow-[0_12px_30px_rgba(59,130,246,0.15)] lg:scale-[1.05] scale-[1.02] z-10"
                    : "border-[#E5E7EB] scale-100 z-0"
                  }`}
              >
                {/* Title */}
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-xl font-bold text-[#111827] font-satoshi">
                    {plan.name}
                  </h3>
                  {plan.popular && (
                    <span className="bg-[#3B82F6] text-white text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full">
                      Most Popular
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="mt-4">
                  <div className="flex items-start gap-2">
                    <span className="text-3xl font-bold text-[#111827] leading-none font-satoshi">
                      {plan.price}
                    </span>

                    {plan.subtitle && (
                      <span className="text-[#6B7280] mt-2 text-sm">
                        {plan.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Top Details */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3 text-sm text-[#4B5563]">
                    <span className="text-[#2563EB] shrink-0"><svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.95438 15.25C2.7974 15.25 2.66472 15.1936 2.55633 15.0808C2.44795 14.9681 2.39375 14.83 2.39375 14.6667V5.33333C2.39375 5.17 2.44795 5.03194 2.55633 4.91917C2.66472 4.80639 2.7974 4.75 2.95438 4.75H13.0456C13.2026 4.75 13.3353 4.80639 13.4437 4.91917C13.5521 5.03194 13.6063 5.17 13.6063 5.33333V14.6667C13.6063 14.83 13.5521 14.9681 13.4437 15.0808C13.3353 15.1936 13.2026 15.25 13.0456 15.25H2.95438ZM12.485 11.75V5.91667H3.515V14.0833L9.12125 8.25L12.485 11.75ZM12.485 13.395L9.12125 9.895L5.09597 14.0833H12.485V13.395ZM5.7575 9.41667C5.55568 9.41667 5.3688 9.36417 5.19688 9.25917C5.02495 9.15417 4.88853 9.01222 4.78762 8.83333C4.68671 8.65444 4.63625 8.46 4.63625 8.25C4.63625 8.04 4.68671 7.84556 4.78762 7.66667C4.88853 7.48778 5.02495 7.34583 5.19688 7.24083C5.3688 7.13583 5.55568 7.08333 5.7575 7.08333C5.95933 7.08333 6.1462 7.13583 6.31813 7.24083C6.49005 7.34583 6.62647 7.48778 6.72738 7.66667C6.8283 7.84556 6.87875 8.04 6.87875 8.25C6.87875 8.46 6.8283 8.65444 6.72738 8.83333C6.62647 9.01222 6.49005 9.15417 6.31813 9.25917C6.1462 9.36417 5.95933 9.41667 5.7575 9.41667Z" fill="#2563EB" />
                    </svg>
                    </span>
                    <span>{plan.renders}</span>
                  </div>

                  <div className="flex items-start gap-3 text-sm text-[#4B5563]">
                    <span className="text-[#2563EB] shrink-0">
                      <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3.515 16.125C3.515 15.2772 3.72056 14.4917 4.13169 13.7683C4.52786 13.0683 5.06232 12.5122 5.73507 12.1C6.43025 11.6722 7.18522 11.4583 8 11.4583C8.81477 11.4583 9.56975 11.6722 10.2649 12.1C10.9377 12.5122 11.4721 13.0683 11.8683 13.7683C12.2794 14.4917 12.485 15.2772 12.485 16.125H11.3637C11.3637 15.495 11.2105 14.9078 10.904 14.3633C10.605 13.8344 10.2014 13.4144 9.69309 13.1033C9.16984 12.7844 8.60547 12.625 8 12.625C7.39452 12.625 6.83016 12.7844 6.30691 13.1033C5.79861 13.4144 5.39496 13.8344 5.09596 14.3633C4.78949 14.9078 4.63625 15.495 4.63625 16.125H3.515ZM8 10.875C7.38705 10.875 6.82269 10.7156 6.30691 10.3967C5.79861 10.0856 5.39496 9.66556 5.09596 9.13667C4.78949 8.6 4.63625 8.01278 4.63625 7.375C4.63625 6.73722 4.78949 6.15 5.09596 5.61333C5.39496 5.08444 5.79861 4.66444 6.30691 4.35333C6.82269 4.03444 7.38705 3.875 8 3.875C8.61295 3.875 9.17731 4.03444 9.69309 4.35333C10.2014 4.66444 10.605 5.08444 10.904 5.61333C11.2105 6.15 11.3637 6.73722 11.3637 7.375C11.3637 8.01278 11.2105 8.6 10.904 9.13667C10.605 9.66556 10.2014 10.0856 9.69309 10.3967C9.17731 10.7156 8.61295 10.875 8 10.875ZM8 9.70833C8.40365 9.70833 8.7774 9.60333 9.12125 9.39333C9.4651 9.18333 9.73794 8.89944 9.93976 8.54167C10.1416 8.18389 10.2425 7.795 10.2425 7.375C10.2425 6.955 10.1416 6.56611 9.93976 6.20833C9.73794 5.85056 9.4651 5.56667 9.12125 5.35667C8.7774 5.14667 8.40365 5.04167 8 5.04167C7.59635 5.04167 7.2226 5.14667 6.87875 5.35667C6.5349 5.56667 6.26206 5.85056 6.06024 6.20833C5.85841 6.56611 5.7575 6.955 5.7575 7.375C5.7575 7.795 5.85841 8.18389 6.06024 8.54167C6.26206 8.89944 6.5349 9.18333 6.87875 9.39333C7.2226 9.60333 7.59635 9.70833 8 9.70833Z" fill="#2563EB" />
                      </svg>
                    </span>
                    <span>{plan.users}</span>
                  </div>

                  <div className="flex items-start gap-3 text-sm text-[#4B5563]">
                    <span className="text-[#2563EB] shrink-0">
                      <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 4.16634C8.76245 4.16634 9.49127 4.30245 10.1864 4.57467C10.8517 4.83912 11.4441 5.21051 11.9636 5.68884C12.4831 6.16717 12.8849 6.71356 13.169 7.32801C13.4605 7.97356 13.6063 8.64634 13.6063 9.34634C13.6063 9.93745 13.4642 10.4858 13.1802 10.9913C12.9036 11.4736 12.5299 11.8586 12.0589 12.1463C11.5805 12.4419 11.0573 12.5897 10.4892 12.5897H9.39035C9.12873 12.5897 8.90822 12.685 8.72882 12.8755C8.54942 13.0661 8.45972 13.2975 8.45972 13.5697C8.45972 13.8108 8.5382 14.0247 8.69518 14.2113C8.85215 14.398 8.93064 14.6158 8.93064 14.8647C8.93064 15.1291 8.83907 15.3566 8.65593 15.5472C8.4728 15.7377 8.25415 15.833 8 15.833C7.23755 15.833 6.50874 15.6813 5.81357 15.378C5.14829 15.0825 4.5559 14.6644 4.03638 14.1238C3.51687 13.5833 3.11509 12.9669 2.83104 12.2747C2.53952 11.5513 2.39375 10.793 2.39375 9.99967C2.39375 9.20634 2.53952 8.44801 2.83104 7.72467C3.11509 7.03245 3.51687 6.41606 4.03638 5.87551C4.5559 5.33495 5.14829 4.9169 5.81357 4.62134C6.50874 4.31801 7.23755 4.16634 8 4.16634ZM7.33847 13.5697C7.33847 13.1808 7.43003 12.823 7.61317 12.4963C7.79631 12.1697 8.04485 11.9091 8.3588 11.7147C8.67275 11.5202 9.0166 11.423 9.39035 11.423H10.4892C10.848 11.423 11.1806 11.3297 11.4871 11.143C11.7936 10.9563 12.0365 10.7055 12.2159 10.3905C12.3953 10.0755 12.485 9.72745 12.485 9.34634C12.485 8.63079 12.2832 7.9619 11.8795 7.33967C11.4834 6.73301 10.9489 6.25079 10.2761 5.89301C9.58097 5.51967 8.82412 5.33301 8.00561 5.33301C7.1871 5.33301 6.43025 5.5469 5.73508 5.97467C5.06233 6.3869 4.52787 6.94301 4.13169 7.64301C3.72057 8.36634 3.515 9.1519 3.515 9.99967C3.515 10.8008 3.69814 11.5513 4.06442 12.2513C4.42322 12.928 4.91283 13.4763 5.53325 13.8963C6.16863 14.3319 6.8638 14.5847 7.61878 14.6547C7.4319 14.3125 7.33847 13.9508 7.33847 13.5697ZM5.47719 9.99967C5.24547 9.99967 5.04738 9.91412 4.88293 9.74301C4.71848 9.5719 4.63625 9.36579 4.63625 9.12467C4.63625 8.88356 4.71848 8.67745 4.88293 8.50634C5.04738 8.33523 5.24547 8.24967 5.47719 9.99967C5.70892 8.24967 5.907 8.33523 6.07145 8.50634C6.2359 8.67745 6.31813 8.88356 6.31813 9.12467C6.31813 9.36579 6.2359 9.5719 6.07145 9.74301C5.907 9.91412 5.70892 9.99967 5.47719 9.99967ZM10.5228 9.99967C10.2911 9.99967 10.093 9.91412 9.92855 9.74301C9.7641 9.5719 9.68188 9.36579 9.68188 9.12467C9.68188 8.88356 9.7641 8.67745 9.92855 8.50634C10.093 8.33523 10.2911 8.24967 10.5228 8.24967C10.7545 8.24967 10.9526 8.33523 11.1171 8.50634C11.2815 8.67745 11.3638 8.88356 11.3638 9.12467C11.3638 9.36579 11.2815 9.5719 11.1171 9.74301C10.9526 9.91412 10.7545 9.99967 10.5228 9.99967ZM8 8.24967C7.76828 8.24967 7.57019 8.16412 7.40574 7.99301C7.24129 7.8219 7.15907 7.61579 7.15907 7.37467C7.15907 7.13356 7.24129 6.92745 7.40574 6.75634C7.57019 6.58523 7.76828 6.49967 8 6.49967C8.23173 6.49967 8.42982 6.58523 8.59427 6.75634C8.75872 6.92745 8.84094 7.13356 8.84094 7.37467C8.84094 7.61579 8.75872 7.8219 8.59427 7.99301C8.42982 8.16412 8.23173 8.24967 8 8.24967Z" fill="#2563EB" />
                      </svg>
                    </span>
                    <span>{plan.branding}</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#E5E7EB] my-8" />

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex gap-3">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="mt-1 shrink-0"
                      >
                        <path
                          d="M6.4 11.2L2.8 7.6L1.867 8.533L6.4 13.067L14.133 5.333L13.2 4.4L6.4 11.2Z"
                          fill="#2563EB"
                        />
                      </svg>

                      <span className="text-[#4B5563] text-xs">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Button */}
                <Link
                  href={plan.buttonText === "Contact Sales" ? "/#contact-us" : "/signup"}
                  onClick={(e) => {
                    if (plan.buttonText === "Contact Sales" && (window.location.pathname === "/" || window.location.pathname === "")) {
                      e.preventDefault();
                      const target = document.getElementById("contact-us");
                      if (target) {
                        target.scrollIntoView({ behavior: "smooth" });
                      }
                    }
                  }}
                  className={`mt-8 w-full py-3 rounded-full text-sm font-medium transition-all duration-300 text-center block ${isHighlighted
                      ? "bg-[#3B82F6] text-white shadow-lg shadow-blue-500/25"
                      : "bg-[#1E1E1E] text-white"
                    }`}
                >
                  {plan.buttonText}
                </Link>
              </div>
            );
          })}
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.6 }}
          className="mt-14 sm:mt-16 flex flex-wrap justify-center items-center gap-3 sm:gap-4"
        >
          {trustBadges.map((badge, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-4 py-2 border border-[#6D6D6D] rounded-full text-[#6D6D6D] text-sm shadow-sm"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_2606_22524)">
                  <path d="M12.0001 4.66656L11.0601 3.72656L6.83344 7.95323L7.77344 8.89323L12.0001 4.66656ZM14.8268 3.72656L7.77344 10.7799L4.98677 7.9999L4.04677 8.9399L7.77344 12.6666L15.7734 4.66656L14.8268 3.72656ZM0.273438 8.9399L4.0001 12.6666L4.9401 11.7266L1.2201 7.9999L0.273438 8.9399Z" fill="#6D6D6D" />
                </g>
                <defs>
                  <clipPath id="clip0_2606_22524">
                    <rect width="16" height="16" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              {badge}
            </div>
          ))}
        </motion.div>

        {/* CTA section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.7 }}
          className="mt-8 flex flex-col items-center gap-4 bg-white rounded-[24px] p-5 sm:p-8 py-8 sm:py-10 w-full border border-[#E8E8E8] box-border"
        >
          <h3 className="text-[#111827] text-lg sm:text-[24px] font-bold text-center font-satoshi leading-snug">
            Enjoy <span className="text-[#2F68C5]">50% off</span> by becoming a Member by <span className="text-[#2F68C5]">Dec 2026</span>
          </h3>
          <p className="text-[#8A8A8A] text-xs sm:text-[14px] text-center max-w-2xl leading-relaxed">
            Close just one custom jewelery order and your plan pays for itself.
          </p>
          <div className="flex justify-center mt-3 w-full sm:w-auto">
            <Link
              href="/signup"
              style={{
                background:
                  "conic-gradient(from 90deg at 50% 50%, #1FBED6 -103.85deg, #2C62B9 46.73deg, #7C3AED 155.77deg, #1FBED6 256.15deg, #2C62B9 406.73deg)",
              }}
              className="inline-flex items-center justify-center px-5 py-2.5 sm:px-8 sm:py-3 text-[#E9EFFD] text-sm sm:text-[16px] font-semibold rounded-full transition-all hover:opacity-90 active:scale-95 shadow-md w-full sm:w-auto text-center whitespace-normal break-words"
            >
              Enjoy 1 Month Free Trial
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
