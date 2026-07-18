"use client";

import { motion } from "framer-motion";

export default function FeaturePreview() {
  return (
    <section
      id="feature-preview"
      className=" bg-[#FAF6F3] pb-12 sm:pb-16 md:pb-20 lg:pb-0 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Feature Mockup Video */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative w-full max-w-6xl mx-auto aspect-[14/9] rounded-lg md:rounded-[28px] overflow-hidden bg-transparent shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          style={{ backgroundColor: "transparent" }}
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/hero1.png"
            aria-label="Craftsman.ai Platform Interface preview video"
            className="absolute inset-0 z-10 block h-full w-full object-cover object-center bg-transparent -mt-[1px]"
            style={{ backgroundColor: "transparent" }}
          >
            <source
              src="/Landing-Page-Video/Craftmen_Demo.webm"
              type="video/webm"
            />
          </video>
        </motion.div>

        {/* Bottom Section */}
        <div className="mt-10 sm:mt-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-2xl sm:text-3xl md:text-4xl font-normal text-[#1E1E1E] mb-4 sm:mb-6 font-satoshi"
          >
            Built for Custom Jewelry  Retailers.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.9,
              ease: [0.25, 0.1, 0.25, 1],
              delay: 0.15,
            }}
            className="text-sm sm:text-base md:text-lg text-[#515151] font-normal mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-4"
          >
            Whether you close deals in-store, over the phone, or online, CraftsmanAI helps you design, approve, price, and collect deposits faster.
          </motion.p>

          {/* Device Icons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.9,
              ease: [0.25, 0.1, 0.25, 1],
              delay: 0.3,
            }}
            className="inline-flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-8 px-4 sm:px-8 py-3.5 sm:py-4 rounded-[32px] sm:rounded-[50px] max-w-[92vw] sm:max-w-none"
            style={{
              background:
                "linear-gradient(90deg, #F1F1F1 12.21%, #E2ECFE 100%)",
            }}
          >
            <p className="text-[11px] xs:text-xs sm:text-sm text-[#515151] font-normal tracking-wide whitespace-nowrap">
              Works seamlessly on phone, tablet, and desktop.
            </p>
            <div className="flex gap-3 sm:gap-4">
              {/* Phone Icon */}
              <div className="flex items-center justify-center">
                {/* <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-[#1E1E1E]" /> */}
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19.8403 4.47998H12.1603C10.0395 4.47998 8.32031 6.19921 8.32031 8.31998V23.68C8.32031 25.8008 10.0395 27.52 12.1603 27.52H19.8403C21.9611 27.52 23.6803 25.8008 23.6803 23.68V8.31998C23.6803 6.19921 21.9611 4.47998 19.8403 4.47998Z"
                    stroke="#1E1E1E"
                  />
                  <path
                    d="M16.0004 24.32C15.8295 24.32 15.6687 24.2535 15.5479 24.1326C15.4269 24.0117 15.3604 23.851 15.3604 23.68C15.3604 23.5531 15.3976 23.4301 15.4683 23.3245C15.5388 23.2189 15.6381 23.1373 15.7554 23.0888C15.8334 23.0564 15.9159 23.04 16.0004 23.04C16.0422 23.04 16.0842 23.0441 16.1252 23.0523C16.2498 23.0772 16.3631 23.1377 16.453 23.2274C16.5427 23.3173 16.6032 23.4306 16.6281 23.5552C16.6529 23.6798 16.6402 23.8077 16.5916 23.9249C16.5431 24.0423 16.4615 24.1416 16.3559 24.2121C16.2503 24.2828 16.1273 24.32 16.0004 24.32Z"
                    fill="#1E1E1E"
                  />
                  <path
                    d="M15.9997 24.9601C15.6603 24.9601 15.3346 24.8251 15.0946 24.5851C14.8546 24.3451 14.7197 24.0195 14.7197 23.6801C14.7197 23.4269 14.7947 23.1795 14.9354 22.9689C15.0761 22.7585 15.276 22.5944 15.5099 22.4975C15.7437 22.4006 16.0011 22.3752 16.2495 22.4246C16.4978 22.474 16.7259 22.5959 16.9048 22.775C17.0839 22.9539 17.2057 23.182 17.2552 23.4303C17.3046 23.6786 17.2792 23.9361 17.1823 24.1699C17.0854 24.4038 16.9213 24.6037 16.7109 24.7444C16.5003 24.885 16.2529 24.9601 15.9997 24.9601Z"
                    fill="#1E1E1E"
                  />
                </svg>
              </div>

              {/* Tablet Icon */}
              <div className="flex items-center justify-center">
                {/* <Tablet className="w-4 h-4 sm:w-5 sm:h-5 text-[#1E1E1E]" /> */}
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M16.0003 24H16.0137M14.667 8H17.3337M10.9337 28H21.067C22.5605 28 23.3073 28 23.8777 27.7093C24.3794 27.4537 24.7874 27.0457 25.043 26.544C25.3337 25.9736 25.3337 25.2268 25.3337 23.7333V8.26667C25.3337 6.7732 25.3337 6.02645 25.043 5.45603C24.7874 4.95425 24.3794 4.54631 23.8777 4.29065C23.3073 4 22.5605 4 21.067 4H10.9337C9.44019 4 8.69345 4 8.12302 4.29065C7.62125 4.54631 7.2133 4.95425 6.95765 5.45603C6.66699 6.02645 6.66699 6.77319 6.66699 8.26667V23.7333C6.66699 25.2268 6.66699 25.9736 6.95765 26.544C7.2133 27.0457 7.62125 27.4537 8.12302 27.7093C8.69345 28 9.44018 28 10.9337 28Z"
                    stroke="#1E1E1E"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Desktop Icon */}
              <div className="flex items-center justify-center">
                {/* <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-[#1E1E1E]" /> */}
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M23.3337 4.00008H8.66699C7.16521 3.9162 5.69122 4.42999 4.56702 5.42928C3.44282 6.42857 2.75977 7.83215 2.66699 9.33341V17.3335C2.75977 18.8347 3.44282 20.2383 4.56702 21.2376C5.69122 22.2368 7.16521 22.7507 8.66699 22.6668H23.3337C24.8354 22.7507 26.3094 22.2368 27.4337 21.2376C28.5578 20.2383 29.2409 18.8347 29.3337 17.3335V9.33341C29.2409 7.83215 28.5578 6.42857 27.4337 5.42928C26.3094 4.42999 24.8354 3.9162 23.3337 4.00008Z"
                    stroke="#1E1E1E"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 22.6666V28"
                    stroke="#1E1E1E"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21.2009 28H10.5342"
                    stroke="#1E1E1E"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
