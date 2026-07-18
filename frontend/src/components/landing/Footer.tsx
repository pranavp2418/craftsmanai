"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="bg-[#152E56] text-[#E3E3E3]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col md:flex-row items-start justify-between gap-8 md:gap-12"
        >
          {/* Logo & Description */}
          <div className="md:flex-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <img
                src="/NEWLOGO1.png"
                alt="Craftsman.ai"
                className="h-24 md:h-24 w-auto object-contain"
              />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-[#E3E3E3] text-center md:text-left mx-auto md:mx-0 lg:whitespace-nowrap">
              The sale acceleration platform for custom Jewelry retailers
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-8 sm:gap-12 md:gap-16 lg:gap-24 items-start justify-between sm:justify-start w-full sm:w-auto mt-8 sm:mt-0">
            {/* Product Links */}
            <div className="min-w-[120px]">
              <h3 className="text-base font-semibold text-white">Product</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <a
                    href="/#how-it-works"
                    className="group inline-flex items-center gap-1 text-sm transition-colors hover:text-white"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a
                    href="/#features"
                    className="group inline-flex items-center gap-1 text-sm transition-colors hover:text-white"
                  >
                    Feature
                  </a>
                </li>
                <li>
                  <a
                    href="/#FAQ"
                    className="group inline-flex items-center gap-1 text-sm transition-colors hover:text-white"
                  >
                    FAQ&apos;s
                  </a>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div className="min-w-[120px]">
              <h3 className="text-base font-semibold text-white">Company</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <a
                    href="/#pricing"
                    className="group inline-flex items-center gap-1 text-sm transition-colors hover:text-white"
                  >
                    Pricing
                  </a>
                </li>
                <li>
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
                    className="group inline-flex items-center gap-1 text-sm transition-colors hover:text-white"
                  >
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div className="min-w-[120px]">
              <h3 className="text-base font-semibold text-white">Legal</h3>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link
                    href="/terms-and-conditions"
                    className="group inline-flex items-center gap-1 text-sm transition-colors hover:text-white"
                  >
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy-policy"
                    className="group inline-flex items-center gap-1 text-sm transition-colors hover:text-white"
                  >
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Divider */}
        <div className=" border-t border-white/10 mt-24" />

        {/* Bottom Section */}
        <motion.div
          // initial={{ opacity: 0, y: 20 }}
          // whileInView={{ opacity: 1, y: 0 }}
          // viewport={{ once: true, margin: "-40px" }}
          // transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
          className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row"
        >
          <p className="text-sm text-center sm:text-left">
            © {new Date().getFullYear()} copyright craftsmanAI All rights reserved.
          </p>

          {/* Social Links */}
          <div className="flex flex-wrap items-center gap-6 justify-center sm:justify-end">
            <Link
              href="https://www.linkedin.com/company/craftsmanai/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E3E3E3] hover:text-white transition-colors flex items-center justify-center"
              aria-label="LinkedIn"
            >
              <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </Link>
            <Link
              href="https://www.instagram.com/craftsmanai.app?igsh=bXN6ZWdrejB2eW5j&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E3E3E3] hover:text-white transition-colors flex items-center justify-center"
              aria-label="Instagram"
            >
              <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </Link>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
