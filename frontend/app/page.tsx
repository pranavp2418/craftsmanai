"use client";

import { useState, useEffect } from "react";
import {
  Header,
  HeroSection,
  FeaturePreview,
  Testimonials,
  StoreAndOnline,
  WorkflowComparisonSection,
  StatsSection,
  WhyExpand,
  AboutUsSection,
} from "@/src/components/landing";
import CompareSection from "@/src/components/landing/CompareSection";
import InputToRenderSection from "@/src/components/landing/InputToRenderSection";
import ScrollShowcaseSection from "@/src/components/landing/ScrollShowcaseSection";
import CTABottom from "@/src/components/landing/CTABottom";
import CTACarousel from "@/src/components/landing/CTACarousel";
import Footer from "@/src/components/landing/Footer";
import ScrollTriggerWorkflow from "@/src/components/landing/ScrollTriggerWorkflow";
import InfoSection from "@/src/components/landing/InfoSection";
import CTAAbove from "@/src/components/landing/CTAAbove";
import FAQSection from "@/src/components/landing/FAQSection";
import AnimatedLoader from "@/src/components/AnimatedLoader";
import PricingSection from "@/src/components/landing/PricingSection";
import ContactSalesSection from "@/src/components/landing/ContactSalesSection";

export default function LandingPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hide loader after 5 seconds
    const timer = setTimeout(() => {
      setLoading(false);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading) {
      const handleHashScroll = () => {
        const hash = window.location.hash;
        if (hash) {
          // Extract the first segment in case there is a duplicate like #contact-us#contact-us
          const cleanHashId = hash.split("#").filter(Boolean)[0];
          if (cleanHashId) {
            const target = document.getElementById(cleanHashId);
            if (target) {
              setTimeout(() => {
                target.scrollIntoView({ behavior: "smooth" });
              }, 100);

              // Correct URL in the browser if it was a duplicate hash
              const cleanHashUrl = `#${cleanHashId}`;
              if (hash !== cleanHashUrl) {
                window.history.replaceState(null, "", `${window.location.pathname}${cleanHashUrl}`);
              }
            }
          }
        }
      };

      handleHashScroll();
      window.addEventListener("hashchange", handleHashScroll);
      return () => {
        window.removeEventListener("hashchange", handleHashScroll);
      };
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#faf6f3]">
        <AnimatedLoader width={420} height={250} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf6f3] overflow-x-clip">
      <div className="w-full">
        <Header />
        <HeroSection />
        <div className="scroll-mt-16 sm:scroll-mt-20">
          <FeaturePreview />
        </div>
        <div className="scroll-mt-16 sm:scroll-mt-20">
          <StoreAndOnline />
        </div>
        <div id="features" className="scroll-mt-16 sm:scroll-mt-20">
          <InputToRenderSection />
        </div>
        <div id="why-us" className="scroll-mt-16 sm:scroll-mt-20">
          <CompareSection />
        </div>
      <WorkflowComparisonSection />
      </div>
      <ScrollShowcaseSection />
        <WhyExpand />




      <StatsSection />
      <div id="products" className="scroll-mt-16 sm:scroll-mt-20">
        <ScrollTriggerWorkflow />
      </div>
      <CTACarousel />
      <Testimonials />
      <InfoSection />
      {/* <CTAAbove /> */}
      <div id="pricing" className="scroll-mt-16 sm:scroll-mt-20">
        <PricingSection />
      </div>
      <FAQSection />
      <CTABottom />
      <div id="about-us" className="scroll-mt-16 sm:scroll-mt-20">
        <AboutUsSection />
        <ContactSalesSection />
        <Footer />
      </div>
    </div>
  );
}
