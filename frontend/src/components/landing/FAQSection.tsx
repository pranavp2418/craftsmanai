"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

const faqs = [
  {
    question: "How accurate are the renders?",
    answer:
      "CraftsmanAI renders are built to communicate design intent with clarity and confidence, helping retailers, customers, and manufacturers stay aligned before production begins. They are approval-ready visuals, not final CAD files.",
  },
  {
    question: "Do I need to be good at prompting AI to use CraftsmanAI?",
    answer:
      "Yes. CraftsmanAI is built around how custom jewelry is actually sold, helping retailers move from concept to approval in a more organized and efficient way..",
  },
  {
    question: "Do my customers need to sign up to review their design?",
    answer:
      "No. Designs can be shared through secure approval links, allowing customers to review their render without creating an account.",
  },
  {
    question: "What can I create on CraftsmanAI?",
    answer:
      "CraftsmanAI supports multiple jewelry categories, including rings, pendants, chains, earrings, bracelets, grills, and watches, with subtype-specific logic for more precise render outputs.",
  },
  {
    question: "Can my customers use CraftsmanAI directly through my website?",
    answer:
      "Yes. CraftsmanAI can be embedded into your online store or website experience, allowing your customers to submit their own design ideas directly through your brand. This creates a smoother intake flow, generates qualified custom-order leads, and helps your team manage submissions in a more organized reach outs and CRM-ready workflow.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="FAQ" className="relative w-full pt-14 sm:pt-18 md:pt-24 pb-8 sm:pb-12 md:pb-16 bg-cover bg-center bg-no-repeat bg-[url('/bgimagecamplare.png')]">
      {/* Overlay */}
      <div className="absolute inset-0 bg-[#FAF6F3]/60 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-8">
        {/* FAQs pill */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center gap-1.5 bg-[#2F68C5] text-white tracking-wider text-xs sm:text-sm font-light tracking-wider px-4 py-1.5 rounded-full"
        >
          <Sparkles className="w-3.5 h-3.5" />
          FAQs
        </motion.div>

        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          className="text-2xl sm:text-3xl lg:text-[44px] font-medium font-satoshi text-[#1E1E1E] text-center leading-tight my-4"
        >
          Frequently Asked Questions
        </motion.h2>

        {/* Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
          className="w-full flex flex-col gap-3"
        >
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div
                key={i}
                layout
                className="w-full bg-white rounded-2xl  border border-[#E8E8E8] overflow-hidden"
              >
                {/* Question row */}
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left"
                >
                  <span className="text-[#1E1E1E] text-base md:text-xl sm:text-2xl font-medium leading-snug font-satoshi">
                    {faq.question}
                  </span>

                  {/* Icon button */}
                  <span
                    className="flex-shrink-0 cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    style={{ backgroundColor: "#F2F2F2" }}
                  >
                    <motion.svg
                      viewBox="0 0 14 14"
                      fill="none"
                      className="w-3.5 h-3.5 text-[#515151a9]"
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      {/* Plus shape — rotating 45° makes an ×  */}
                      <path
                        d="M7 1v12M1 7h12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </motion.svg>
                  </span>
                </button>

                {/* Answer */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 sm:px-6 pb-5 text-[#515151] text-[14px] sm:text-lg font-light max-w-4xl leading-relaxed">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
