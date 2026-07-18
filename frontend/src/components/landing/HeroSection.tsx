"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import CTAButton from './CTAButton';

export default function HeroSection() {
  return (
    <section className="w-full bg-[##FAF6F3] py-12 sm:py-16 md:py-20 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium text-[#1E1E1E] font-satoshi leading-[1.2] tracking-normal"
          >
            Close Custom Jewelry {' '}
            <br className="hidden sm:block" />
            Sales in{' '}
            <span className="text-[#2F68C5]">Minutes</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1], delay: 0.25 }}
            className="text-sm sm:text-base md:text-lg text-[#515151] font-inter font-normal py-5 max-w-4xl mx-auto leading-relaxed px-4"
          >
            CraftsmanAI helps custom jewelry retailers turn ideas, sketches, and customer references
            <br className="hidden sm:block" />
            into photorealistic renders and instant quotations — right in-store or online.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1], delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            {/* <button className="w-full sm:w-auto px-6 py-2 border border-[#2C62B9] rounded-xl text-sm sm:text-base font-medium text-[#2C62B9] hover:bg-[#2C62B9] hover:text-white transition-all">
              See How It Works
              </button>
              <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-2 bg-[#2F68C5] rounded-xl text-sm sm:text-base font-medium text-[#E9EFFD] hover:bg-[#2554a3] transition-colors text-center"
              >
              Start Creating Free
              </Link> */}
            <CTAButton />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
