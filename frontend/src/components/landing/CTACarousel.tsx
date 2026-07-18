"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import Image from "next/image";

const slides = [
  {
    id: 1,
    logo: "/NEWLOGO1.png",
    title: "In-Store Virtual Design Kiosks",
    image: "/CTA.png",
    pdf: "/CtaPdf/CraftsmanAI_In_Store_Virtual_Design_Kiosks.pdf",
  },
  {
    id: 2,
    logo: "/NEWLOGO1.png",
    title: "Craftsman-Branded Tablets",
    image: "/CTA1.png",
    pdf: "/CtaPdf/CraftsmanAI_Craftsman_Branded_Tablets_Sales_Hardware.pdf",
  },
  {
    id: 3,
    logo: "/NEWLOGO1.png",
    title: "Digital Try-On Experiences",
    image: "/CTA2.png",
    pdf: "/CtaPdf/CraftsmanAI_Digital_Try_On_Experiences.pdf",
  },
  {
    id: 4,
    logo: "/NEWLOGO1.png",
    title: "Seamless Website Integration",
    image: "/CTA3.png",
    pdf: "/CtaPdf/CraftsmanAI_Seamless_Website_Integration.pdf",
  },
  {
    id: 5,
    logo: "/NEWLOGO1.png",
    title: "Manufacturer Portal Expansion",
    image: "/CTA4.png",
    pdf: "/CtaPdf/CraftsmanAI_Manufacturer_Portal_Expansion.pdf",
  },
];

export default function CTACarousel() {
  return (
    <section className="w-full px-4 py-6 md:py-10 sm:px-6 lg:px-8">
      {/* Inject custom pagination dot colors */}
      <style>{`
        .cat-carousel{
        background: #1B3A6F;
        }
        .cta-carousel .swiper-pagination-bullet {
          background: #234E94;
          opacity: 1;
          width: 10px;
          height: 10px;
        }
        .cta-carousel .swiper-pagination-bullet-active {
          background: #3575DD;
          width: 28px;
          border-radius: 5px;
        }
        .cta-carousel .swiper-pagination {
          bottom: 20px;
          background: #1B3A6F;
          width : auto;
          margin: 0 auto;
          padding: 0px 10px;
          border-radius: 20px;
          transform : translateX(-50%);
          left : 50%
        }

        @keyframes ctaFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cta-carousel .swiper-slide-active .cta-tag {
          animation: ctaFadeUp 0.8s ease forwards;
          animation-delay: 0.05s;
        }
        .cta-carousel .swiper-slide-active .cta-title {
          animation: ctaFadeUp 0.8s ease forwards;
          animation-delay: 0.2s;
        }
        .cta-carousel .swiper-slide-active .cta-btn {
          animation: ctaFadeUp 0.8s ease forwards;
          animation-delay: 0.38s;
        }

        .cta-tag, .cta-title, .cta-btn {
          opacity: 0;
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto max-w-7xl min-h-96"
      >
        <Swiper
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop
          className="cta-carousel rounded-3xl overflow-hidden h-full "
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.id}>
              {/* Slide wrapper — background image fills the whole card */}
              <div
                className="relative w-full min-h-[450px] sm:min-h-[420px] md:min-h-[405px] bg-cover bg-right md:bg-center rounded-xl"
                style={{ backgroundImage: `url('${slide.image}')` }}
                role="img"
                aria-label={slide.title}
              >
                {/* Dark left-side gradient overlay for text readability (below text) */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0b1f46] via-[#0b1f46]/80 to-transparent z-0 pointer-events-none" />

                {/* Text content */}
                <div className="relative z-10 flex flex-col justify-between min-h-[450px] sm:min-h-[420px] md:min-h-[405px] px-6 pt-10 pb-20 sm:px-10 sm:py-12 lg:px-14 max-w-sm md:max-w-lg">
                  {/* Top Section: Logo & Title */}
                  <div className="flex flex-col">
                    <Image
                      src={slide.logo}
                      alt="Logo"
                      width={120}
                      height={40}
                      className="object-contain mb-4 sm:mb-5"
                    />

                    {/* Title */}
                    <h2 className="cta-title font-satoshi font-medium sm:font-normal text-2xl xs:text-3xl sm:text-4xl md:text-5xl text-white leading-snug">
                      {slide.title}
                    </h2>
                  </div>

                  {/* CTA Buttons */}
                  <div className="cta-btn mt-auto flex flex-row items-center gap-2.5 sm:gap-4">
                    <a
                      href="/#contact-us"
                      onClick={(e) => {
                        if (window.location.pathname === "/" || window.location.pathname === "") {
                          e.preventDefault();
                          const target = document.getElementById("contact-us");
                          if (target) {
                            target.scrollIntoView({ behavior: "smooth" });
                          }
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-[#2F68C5] px-3 sm:px-5 min-h-touch text-xs sm:text-sm font-medium text-white transition-all duration-200 hover:bg-[#2554A0] hover:scale-105 hover:shadow-lg hover:shadow-blue-950/40 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#2F68C5] focus:ring-offset-2 flex-1 sm:flex-initial whitespace-nowrap"
                    >
                      Contact Us
                    </a>
                    <a
                      href={slide.pdf}
                      download
                      className="inline-flex items-center justify-center rounded-full border border-[#3b82f6] bg-transparent px-3 sm:px-5 min-h-touch text-xs sm:text-sm font-medium text-[#3b82f6] transition-all duration-200 hover:bg-[#3b82f6]/10 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-2 flex-1 sm:flex-initial whitespace-nowrap"
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </motion.div>
    </section>
  );
}
