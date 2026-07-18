"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import CTAButton from "./CTAButton";

export default function CTABottom() {
  return (
    <section className="w-full px-4 py-8 md:py-10 sm:px-6 lg:px-8 -mt-5">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-[#F4F6FA] h-full"
      >
        <div className="overflow-hidden relative flex items-center justify-end h-full min-h-72 md:min-h-96" >

          <div
            className="hidden sm:block w-full absolute shrink-0 h-full bg-[left_10%_center] sm:bg-left bg-cover rounded-2xl z-20"
            style={{ backgroundImage: "url('/CTA/CTA-bottom-banner.png')" }}
            role="img"
            aria-label="Custom jewelery banner"
          />


          <div className="px-6 py-8 sm:px-8 sm:py-10 lg:px-16 lg:py-16 z-30 w-full sm:max-w-[50%] xl:max-w-2xl ml-auto">
            {/* Heading */}
            <motion.h2
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
              className="text-2xl sm:text-3xl lg:text-[40px] font-normal text-[#1E1E1E] leading-tight font-satoshi"
            >
              Ready to explore the right CraftsmanAI expansion for your business?
            </motion.h2>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.35 }}
              className="mt-4 text-sm sm:text-base text-[#515151] leading-relaxed max-w-lg"
            >
              Speak with our team to learn which products, integrations, or hardware solutions
              best fit your retail or manufacturing workflow.
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.5 }}
              className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4"
            >
              <CTAButton text="Contact Sales" href="/contact-us" width="200px" />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Helper Footer Text */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="mt-6 text-center text-xs sm:text-sm text-[#6D6D6D] max-w-2xl mx-auto leading-relaxed"
      >
        Available only with an active CraftsmanAI subscription. Product availability may
        vary by rollout stage and implementation scope.
      </motion.p>
    </section>
  );
}
