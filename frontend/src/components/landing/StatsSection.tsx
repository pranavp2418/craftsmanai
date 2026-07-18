"use client";

import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export default function StatsSection() {
  const stats = [
    {
      headline: "62%",
      title: "Faster approvals",
      description: "Customers decide quicker when they see realistic renders."
    },
    {
      headline: "Same-day",
      title: "Quotations",
      description: "No waiting for external designers."
    },
    {
      headline: "0",
      title: "Outsourcing Delays",
      description: "Everything happens in one platform."
    },
    {
      headline: "100%",
      title: "Centralized Workflow",
      description: "Design, approvals, quotes — all organized in one place."
    }
  ];

  return (
    <section className="w-full py-8 md:py-16">
      <div className="max-w-[1200px] mx-auto px-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="bg-[#F1F1F1] rounded-2xl px-5 py-5 md:px-10 md:py-8"
        >
          <div className="flex flex-col md:flex-row gap-6 md:gap-0">
            {stats.map((stat, index) => (
              <motion.div key={index} variants={itemVariants} className="flex flex-1">
                {/* Content */}
                <div className="flex-1 flex flex-col">
                  {/* Headline */}
                  <h3 className="text-[#1E1E1E] font-medium font-satoshi text-xl md:text-3xl mb-2">
                    {stat.headline}
                  </h3>
                  
                  {/* Title */}
                  <h4 className="text-[#515151] font-normal text-sm md:text-base mb-2">
                    {stat.title}
                  </h4>
                  
                  {/* Description */}
                  <p className="text-[#8A8A8A] font-normal text-xs ">
                    {stat.description}
                  </p>
                </div>

                {/* Separator - only show between items, not after last one, and only on desktop */}
                {index < stats.length - 1 && (
                  <div className="hidden md:block w-px bg-[#D5D5D5] mx-6 lg:mx-8"></div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
