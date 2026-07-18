"use client";

import { motion } from "framer-motion";
import { Sparkles, TrendingUp } from "lucide-react";
import Image from "next/image";

const TESTIMONIALS = [
  {
    logo: "/IMN.png",
    title: "How Iceman Nick speed up custom iced-out approvals",
    description:
      "CraftsmanAI helped turn customer ideas for custom pendants, chains, and grillz into clear visual previews during the sales conversation.",
    stats: [
      { value: "2.4x", label: "Faster customer design decisions" },
      { value: "3 min", label: "Average first concept preview" },
      { value: "45%", label: "Less back-and-forth on revisions" },
      { value: "Same-day", label: "Customer-ready visual approvals" },
    ],
    quote:
      "“Earlier, customers had to imagine the piece. Now they can see the idea while the excitement is still fresh.”",
    author: "Iceman Nick -\nCustom Jewelry Retailer",
  },
  {
    logo: "/JCJ.png",
    title: "How Johnny's Custom Jewelry made custom orders easier to close",
    description:
      "A local custom jewelry store used CraftsmanAI to present clearer visuals before sending designs for costing, helping customers commit with more confidence.",
    stats: [
      { value: "2x", label: "Higher confidence during approvals" },
      { value: "70%", label: "Fewer unclear design requests" },
      { value: "1 visit", label: "Many approvals handled in-store" },
      { value: "Days > minutes", label: "Faster concept turnaround" },
    ],
    quote:
      "“Before, we waited days for a design preview. Now the customer can approve the direction in the same appointment.”",
    author: "Johnny's Custom Jewelry -\nCustom Retail Store",
  },
  {
    logo: "/RJ.png",
    title: "How Royal Jewelers improved bridal and custom design presentations",
    description:
      "CraftsmanAI gave Royal Jewelers a faster way to show rings, pendants, and personalized designs before production conversations began.",
    stats: [
      { value: "1.8x", label: "Revenue growth" },
      { value: "60%", label: "Revenue growth" },
      { value: "3 min", label: "From idea to polished preview" },
      { value: "Same-day", label: "Design shared with customer" },
    ],
    quote:
      "“Customers understand the design faster when they can see it. It makes the whole custom process feel more premium.”",
    author: "Royal Jewelers -\nBridal & Custom Jewelry Retailer",
  },
];

export default function Testimonials() {
  return (
    <section className="w-full px-4 sm:px-8 py-16 sm:py-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="flex flex-col items-center gap-4 mb-12 sm:mb-14"
      >
        <div className="flex items-center gap-2 bg-[#3575DD] text-white text-sm px-4 py-1.5 rounded-full">
          <Sparkles className="w-4 h-4" />
          <span>Testimonials</span>
        </div>
        <h2 className="font-satoshi font-base text-[#1E1E1E] text-[28px] sm:text-[34px] md:text-[40px] font-normal leading-[1.3] tracking-normal">
          See how retailers transform with
        </h2>
        <Image
          src="/landingPageLogo.png"
          alt="CraftsmanAI"
          width={150}
          height={30}
          className="object-contain"
        />

        <p className="text-[#6B7280] text-sm md:text-base text-center font-light max-w-2xl">
          Real stories from Jewelry retailers who’ve revolutionized their custom design process
        </p>
      </motion.div>

      {/* Cards */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.18,
            },
          },
        }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
      >
        {TESTIMONIALS.map((testimonial, idx) => (
          <motion.div
            key={idx}
            variants={{
              hidden: { opacity: 0, y: 40 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.85 },
              },
            }}
          >
            <TestimonialCard {...testimonial} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function StatBox({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E8E8E8] shadow-sm min-h-[116px] flex flex-col justify-between">
      <TrendingUp
        className="w-4 h-4 text-[#2F68C5]"
        strokeWidth={2.5}
      />

      <div>
        <p className="text-[18px] md:text-xl font-bold font-satoshi text-[#1E1E1E]">{value}</p>
        <p className="text-xs text-[#8A8A8A] font-light leading-snug">
          {label}
        </p>
      </div>
    </div>
  );
}

function TestimonialCard({
  logo,
  title,
  description,
  stats,
  quote,
  author,
}: (typeof TESTIMONIALS)[0]) {
  return (
    <div className="bg-[#F1F1F1] rounded-[32px] p-6 flex flex-col gap-6 h-full">

      {/* Top Logo Area */}
      <div className="flex items-center justify-between border-b border-[#D9D9D9] pb-5">
        <div className="w-[52px] h-[52px] p-1 rounded-full bg-[#000000] flex items-center justify-center overflow-hidden">
          <Image
            src={logo}
            alt="Brand Logo"
            width={52}
            height={52}
            className="object-contain"
          />
        </div>

        <Image
          src="/logo_new.png"
          alt="Diamond Logo"
          width={70}
          height={70}
          className="object-contain"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-lg md:text-xl font-satoshi font-medium text-[#1E1E1E] mb-3 leading-snug">
            {title}
          </h3>

          <p className="text-xs font-normal text-[#515151] font-light leading-relaxed">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <StatBox
              key={i}
              value={s.value}
              label={s.label}
            />
          ))}
        </div>
      </div>

      {/* Quote */}
      <div className="bg-white rounded-2xl border-l-4 border-[#2F68C5] p-5 shadow-sm mt-auto">
        <p className="text-[15px] text-[#515151] leading-relaxed mb-4">
          {quote}
        </p>

        <p className="text-[14px] font-medium text-[#515151] whitespace-pre-line">
          {author}
        </p>
      </div>
    </div>
  );
}