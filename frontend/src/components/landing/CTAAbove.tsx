"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const checkItems = [
  "Review the final render",
  "Approve the quotation",
  "Pay the deposit instantly",
];

export default function CTAAbove() {
  return (
    <section className="w-full bg-[#faf6f3] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto overflow-hidden">
        <div
          className="w-full rounded-2xl sm:rounded-3xl px-6 sm:px-10 lg:px-14 py-10 sm:py-12 lg:py-14 flex flex-col lg:flex-row items-start lg:items-center gap-10 lg:gap-16"
          style={{ backgroundColor: "#001853" }}
        >
          {/* ── Left copy ── */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex-1 flex flex-col gap-5"
          >
            <div>
              <p className="text-[#E3E3E3] text-2xl sm:text-3xl lg:text-4xl font-normal leading-tight">
                Design approved?
              </p>
              <p className="text-white text-2xl sm:text-3xl lg:text-4xl leading-tight">
                <span className="font-medium">Collect the deposit</span>{" "}
                without
                <br className="hidden sm:block" /> 
                leaving the flow.
              </p>
            </div>

            <p className="text-[#E3E3E3] text-sm sm:text-base leading-relaxed max-w-sm">
              For retailers who prefer a seamless approval-to-payment
              experience, CraftsmanAI supports optional Stripe integration.
            </p>

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
              className="inline-flex items-center justify-center w-fit px-8 py-3 rounded-full text-sm font-medium text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-950/40 active:scale-95"
              style={{ backgroundColor: "#2F68C5" }}
            >
              Contact Us
            </a>
          </motion.div>

          {/* ── Right cards ── */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
            className="w-full lg:w-[580px] flex flex-col gap-3"
          >
            {/* Top card */}
            <div
              className="rounded-2xl overflow-hidden border-2 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/30"
              style={{ borderColor: "#234E94" }}
            >
              {/* Card heading row */}
              <div
                className="flex items-start justify-between gap-4 px-5 py-4"
                style={{ backgroundColor: "#1B3A6F" }}
              >
                <p className="text-white text-sm sm:text-base font-medium leading-snug max-w-sm">
                  When sending the final design approval link, your customer
                  can:
                </p>
                {/* Stripe badge */}
                <span className="flex-shrink-0 rounded-md px-2 py-1 text-xs sm:text-sm font-bold tracking-wide text-blue-900">
                  <svg
                    viewBox="0 0 27 21"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-9 h-6 sm:w-10 sm:h-8"
                  >
                    <path
                      d="M23.0812 8.85C22.6641 8.85 22.2047 9.16406 22.2047 9.91406H23.925C23.925 9.16406 23.4891 8.85 23.0812 8.85ZM17.5781 8.97187C17.1938 8.97187 16.9547 9.10781 16.7812 9.3L16.7906 11.775C16.9547 11.9484 17.1891 12.0891 17.5781 12.0891C18.1922 12.0891 18.6047 11.4187 18.6047 10.5234C18.6047 9.65156 18.1828 8.96719 17.5781 8.97187ZM24.75 0H2.25C1.00781 0 0 1.00781 0 2.25V18.75C0 19.9922 1.00781 21 2.25 21H24.75C25.9922 21 27 19.9922 27 18.75V2.25C27 1.00781 25.9922 0 24.75 0ZM5.72812 11.6766C5.72812 12.8766 4.77656 13.5562 3.38906 13.5656C2.81719 13.5656 2.18906 13.4531 1.57031 13.1859V11.5969C2.13281 11.8969 2.84063 12.1266 3.39375 12.1266C3.76406 12.1266 4.03125 12.0281 4.03125 11.7188C4.03125 10.9219 1.5 11.2219 1.5 9.37969C1.5 8.19844 2.4 7.49531 3.75 7.49531C4.30312 7.49531 4.85156 7.57969 5.40469 7.8V9.36563C4.89844 9.09375 4.25625 8.93906 3.75 8.93906C3.39844 8.93906 3.18281 9.04219 3.18281 9.3C3.18281 10.05 5.72812 9.69375 5.72812 11.6766ZM8.95312 9.02344H7.6875V11.3906C7.6875 12.3703 8.74219 12.0656 8.95312 11.9813V13.3359C8.73281 13.4578 8.32969 13.5563 7.78594 13.5563C6.79688 13.5563 6.05625 12.8297 6.05625 11.8453L6.06562 6.50625L7.69219 6.15937V7.60312H8.95312V9.02344ZM12.4219 9.13594C12.2109 9.06562 11.5453 8.96719 11.1516 9.48281V13.4391H9.4875V7.60312H10.9266L11.0297 8.09531C11.4187 7.37812 12.1969 7.52344 12.4172 7.60312H12.4219V9.13594ZM14.4891 13.4391H12.8156V7.60312H14.4891V13.4391ZM14.4891 6.74063L12.8156 7.09687V5.74219L14.4891 5.38594V6.74063ZM17.9625 13.5609C17.3813 13.5609 17.025 13.3125 16.7859 13.1391L16.7812 15.0234L15.1172 15.375V7.60312H16.5844L16.6688 8.01562C16.8984 7.80469 17.3203 7.49531 17.9719 7.49531C19.1391 7.49531 20.2406 8.55 20.2406 10.4859C20.2406 12.6 19.1531 13.5562 17.9625 13.5609ZM25.4812 11.1469H22.2234C22.2984 11.925 22.8703 12.1547 23.5172 12.1547C24.1781 12.1547 24.6984 12.0141 25.1531 11.7844V13.125C24.6984 13.3734 24.1031 13.5563 23.3063 13.5563C21.6844 13.5563 20.55 12.5391 20.55 10.5328C20.55 8.83594 21.5109 7.49063 23.0953 7.49063C24.675 7.49063 25.5 8.83594 25.5 10.5422C25.5 10.7062 25.4859 11.0531 25.4812 11.1469Z"
                      fill="white"
                    />
                  </svg>
                </span>
              </div>

              {/* Checklist */}
              <div
                className="px-5 pt-4 pb-1 flex flex-col gap-3"
                style={{ backgroundColor: "#152E56" }}
              >
                {checkItems.map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <svg
                      className="w-4 h-4 flex-shrink-0 text-white/70"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M3 8l3.5 3.5L13 4.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-white/80 text-sm">{item}</span>
                  </div>
                ))}

                {/* Divider */}
                <div
                  className="mt-2 border-t"
                  style={{ borderColor: "#234E94" }}
                />

                <p className="text-white/50 text-xs sm:text-sm pb-4 leading-relaxed">
                  The funds go directly to your bank account securely and
                  transparently.
                </p>
              </div>
            </div>

            {/* Bottom disclaimer card */}
            <div
              className="rounded-2xl border-2 px-5 py-4 transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-950/30"
              style={{
                backgroundColor: "#152E56",
                borderColor: "#234E94",
              }}
            >
              <p className="text-white/70 text-xs sm:text-sm leading-relaxed">
                This integration is optional and enabled only upon request. By
                default, CraftsmanAI does not process or manage retailer
                payments.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
