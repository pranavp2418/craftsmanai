"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setScrollY(currentY);
      if (currentY > lastScrollY.current) setScrollDirection('down');
      else if (currentY < lastScrollY.current) setScrollDirection('up');
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { scrollDirection, scrollY };
}

function NavContent({ activeSection }: { activeSection: string }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-16 sm:h-20">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center"
          onClick={(e) => {
            if (window.location.pathname === "/" || window.location.pathname === "") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          <img
            src="/landingPageLogo.png"
            alt="Craftsman.ai"
            className="h-10 sm:h-16 w-auto"
          />
        </Link>

        {/* Navigation Links - Centered on desktop, hidden on mobile */}
        <nav className="hidden md:flex items-center gap-3.5 lg:gap-8 ml-4 lg:ml-16">
          <a
            href="/#why-us"
            onClick={(e) => {
              if (window.location.pathname === "/" || window.location.pathname === "") {
                e.preventDefault();
                const target = document.getElementById("why-us");
                if (target) {
                  target.scrollIntoView({ behavior: "smooth" });
                  window.history.pushState(null, "", "#why-us");
                }
              }
            }}
            className={`text-[14px] whitespace-nowrap transition-colors duration-200 ${activeSection === 'why-us' ? 'font-[700] text-[var(--CTA,#3B82F6)]' : 'font-[500] text-[#515151] hover:text-[var(--CTA,#3B82F6)]'
              }`}
          >
            Why Us
          </a>
          <a
            href="/#features"
            onClick={(e) => {
              if (window.location.pathname === "/" || window.location.pathname === "") {
                e.preventDefault();
                const target = document.getElementById("features");
                if (target) {
                  target.scrollIntoView({ behavior: "smooth" });
                  window.history.pushState(null, "", "#features");
                }
              }
            }}
            className={`text-[14px] whitespace-nowrap transition-colors duration-200 ${activeSection === 'features' ? 'font-[700] text-[var(--CTA,#3B82F6)]' : 'font-[500] text-[#515151] hover:text-[var(--CTA,#3B82F6)]'
              }`}
          >
            Features
          </a>
          <a
            href="/#products"
            onClick={(e) => {
              if (window.location.pathname === "/" || window.location.pathname === "") {
                e.preventDefault();
                const target = document.getElementById("products");
                if (target) {
                  target.scrollIntoView({ behavior: "smooth" });
                  window.history.pushState(null, "", "#products");
                }
              }
            }}
            className={`text-[14px] whitespace-nowrap transition-colors duration-200 ${activeSection === 'products' ? 'font-[700] text-[var(--CTA,#3B82F6)]' : 'font-[500] text-[#515151] hover:text-[var(--CTA,#3B82F6)]'
              }`}
          >
            Products
          </a>
          <a
            href="/#pricing"
            onClick={(e) => {
              if (window.location.pathname === "/" || window.location.pathname === "") {
                e.preventDefault();
                const target = document.getElementById("pricing");
                if (target) {
                  target.scrollIntoView({ behavior: "smooth" });
                  window.history.pushState(null, "", "#pricing");
                }
              }
            }}
            className={`text-[14px] whitespace-nowrap transition-colors duration-200 ${activeSection === 'pricing' ? 'font-[700] text-[var(--CTA,#3B82F6)]' : 'font-[500] text-[#515151] hover:text-[var(--CTA,#3B82F6)]'
              }`}
          >
            Pricing
          </a>
          <a
            href="/#about-us"
            onClick={(e) => {
              if (window.location.pathname === "/" || window.location.pathname === "") {
                e.preventDefault();
                const target = document.getElementById("about-us");
                if (target) {
                  target.scrollIntoView({ behavior: "smooth" });
                  window.history.pushState(null, "", "#about-us");
                }
              }
            }}
            className={`text-[14px] whitespace-nowrap transition-colors duration-200 ${activeSection === 'about-us' ? 'font-[700] text-[var(--CTA,#3B82F6)]' : 'font-[500] text-[#515151] hover:text-[var(--CTA,#3B82F6)]'
              }`}
          >
            About Us
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 lg:gap-4">
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
            className="px-3 md:px-4 lg:px-6 py-2 sm:py-[9px] border border-[#2C62B9] rounded-full text-sm font-medium text-[#2C62B9] hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Contact us
          </a>
          <Link
            href="/login"
            className="px-3 md:px-4 lg:px-6 py-2 sm:py-2.5 bg-[#2563EB] rounded-full text-sm font-medium text-[#E9EFFD] hover:bg-[#2554a3] transition-colors whitespace-nowrap"
          >
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const pathname = usePathname() || '';
  const isLanding = pathname === '/' || pathname === '';
  const { scrollDirection, scrollY } = useScrollDirection();
  const [showFixedHeader, setShowFixedHeader] = useState(false);
  const [activeSection, setActiveSection] = useState(isLanding ? "why-us" : "");

  useEffect(() => {
    if (scrollY > 100 && scrollDirection === 'down') {
      setShowFixedHeader(true);
    }
    if (scrollY < 200 && scrollDirection === 'up') {
      setShowFixedHeader(false);
    }
  }, [scrollDirection, scrollY]);

  useEffect(() => {
    if (!isLanding) {
      setActiveSection("");
      return;
    }
    const sections = ["why-us", "features", "products", "pricing", "about-us"];
    const scrollPosition = window.scrollY + 120; // header height + padding offset

    for (const section of sections) {
      const el = document.getElementById(section);
      if (el) {
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (scrollPosition >= top && scrollPosition < top + height) {
          setActiveSection(section);
          break;
        }
      }
    }

    // Clear hash if we scroll back to the top, or scroll away from the contact-us section
    if (window.location.hash) {
      if (window.scrollY < 100) {
        window.history.replaceState(null, "", window.location.pathname);
      } else if (window.location.hash === "#contact-us") {
        const contactUsEl = document.getElementById("contact-us");
        if (contactUsEl) {
          const contactUsTop = contactUsEl.offsetTop;
          if (window.scrollY < contactUsTop - 400) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      }
    }
  }, [scrollY]);

  return (
    <>
      {/* Normal static header */}
      <header className="w-full bg-[#faf6f3] border-b border-[#E3E3E3]">
        <NavContent activeSection={activeSection} />
      </header>

      {/* Fixed header — slides in when scrolling down past 100px, hides when near top */}
      <AnimatePresence>
        {showFixedHeader && (
          <motion.header
            key="fixed-header"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="fixed top-0 left-0 w-full bg-[#faf6f3] backdrop-blur-md border-b border-[#E3E3E3] shadow-sm z-50"
          >
            <NavContent activeSection={activeSection} />
          </motion.header>
        )}
      </AnimatePresence>
    </>
  );
}
