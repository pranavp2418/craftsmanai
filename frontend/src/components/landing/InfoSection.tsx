"use client";

import { motion } from 'framer-motion';

const stats = [
  {
    highlight: "15,000+",
    label: "Jewelry",
    labelBold: "",
    rest: "Designs Trained",
    highlightFirst: true,
  },
  {
    highlight: "100+",
    label: "Professional",
    labelBold: "",
    rest: "Designers",
    highlightFirst: true,
  },
  {
    highlight: "",
    label: "Industry-Leading",
    labelBold: "Accuracy",
    rest: "",
    highlightFirst: false,
  },
  {
    highlight: "",
    label: "From Weeks to",
    labelBold: "Minutes",
    rest: "",
    highlightFirst: false,
  },
];

export default function InfoSection() {
  return (
    <section className="w-full bg-[#faf6f3] py-16 md:py-20 lg:py-5 px-4 mb-0 md:mb-12">
      <div className="max-w-7xl mx-auto flex flex-col items-center font-satoshi">
        {/* Main copy */}
        <motion.p
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-center text-[#515151] font-normal text-lg md:text-xl lg:text-3xl leading-relaxed max-w-4xl font-satoshi"
        >
          CraftsmanAI is trained on over{" "}
          <span className="text-[#1E1E1E] font-medium">
            15,000+ real jewelry designs
          </span>{" "}
          and refined with insights from{" "}
          <span className="text-[#1E1E1E] font-medium">
            100+ professional jewelry designers
          </span>{" "}
          across various jewelry types.
        </motion.p>

        {/* Gradient headline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
          className="mt-6 text-center text-xl md:text-2xl lg:text-3xl font-base bg-clip-text text-transparent font-medium"
          style={{
            backgroundImage:
              "conic-gradient(from 90deg at 50% 50%, #1FBED6 -103.85deg, #2C62B9 46.73deg, #7C3AED 155.77deg, #1FBED6 256.15deg, #2C62B9 406.73deg)",
          }}

        >
          This isn&apos;t generic AI.
        </motion.p>

        {/* Sub-copy */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.25 }}
          className="mt-3 text-center text-[#515151d5] text-lg md:text-xl lg:text-2xl leading-relaxed max-w-4xl"
        >
          It&apos;s built for the precision, proportions, and production
          realities of custom jewelry.
        </motion.p>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1], delay: 0.35 }}
          className="mt-12 w-full max-w-5xl bg-[#F1F1F1] rounded-2xl px-6 py-6 md:py-7"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#D4D4D4]">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="flex flex-col justify-center px-4 md:px-6 py-4 md:py-0 first:pt-0 last:pb-0 md:first:pl-4 md:last:pr-4"
              >
                {stat.highlightFirst ? (
                  <p className="text-base md:text-base lg:text-lg leading-snug text-[#515151]">
                    <span className="font-medium text-[#1e1e1e]">
                      {stat.highlight}
                    </span>{" "}
                    {stat.label}
                    {stat.rest && (
                      <>
                        <br />
                        {stat.rest}
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-base md:text-base lg:text-lg leading-snug text-[#515151]">
                    {stat.label}
                    <br />
                    <span className="font-medium text-[#1E1E1E]">
                      {stat.labelBold}
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
