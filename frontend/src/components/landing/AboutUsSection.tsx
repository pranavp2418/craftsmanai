"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

type TabId = "why" | "workflow" | "mission";

interface Step {
  num: number;
  label: string;
}

interface TabContent {
  title: string;
  description: string;
  steps?: Step[];
}

const tabData: Record<TabId, TabContent> = {
  why: {
    title: "Built for Modern Custom Jewelry Retail",
    description:
      "Custom Jewelry is personal, but the workflow behind it is often slow, fragmented, and difficult to manage. CraftsmanAI helps retailers bring clarity, speed, and professionalism to the custom-order process.",
  },
  workflow: {
    title: "A Workflow Built Around How Jewelry Is Actually Sold",
    description:
      "CraftsmanAI transforms inspiration into approval-ready visuals while helping retailers reduce revisions, organize requests, and move custom orders forward with greater confidence.",
    steps: [
      { num: 1, label: "Design" },
      { num: 2, label: "Approve" },
      { num: 3, label: "Cost" },
      { num: 4, label: "Price" },
      { num: 5, label: "Deposit" },
    ],
  },
  mission: {
    title: "Built for the Entire Jewelry Ecosystem",
    description:
      "CraftsmanAI supports retailers, sales teams, designers, CAD experts, manufacturers, and customers through a more connected and modern custom Jewelry workflow.",
  },
};

export default function AboutUsSection() {
  const [activeTab, setActiveTab] = useState<TabId>("why");
  const [isLooping, setIsLooping] = useState(false);

  const handleTabChange = (tab: TabId) => {
    if (activeTab === "mission" && tab === "why") {
      setIsLooping(true);
      setTimeout(() => {
        setIsLooping(false);
      }, 450);
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    const tabs: TabId[] = ["why", "workflow", "mission"];
    const interval = setInterval(() => {
      const currentIndex = tabs.indexOf(activeTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      handleTabChange(tabs[nextIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const content = tabData[activeTab];

  return (
    <section className="relative w-full py-16 sm:py-20 lg:py-24 bg-[#121212] overflow-hidden text-white">
      {/* Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-10">

        {/* Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex items-center gap-1.5 bg-[#2F68C5] text-white text-xs sm:text-sm font-light tracking-wider px-4 py-1.5 rounded-full"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5">
            <path d="M4.67492 2.29867C5.07359 1.132 6.68559 1.09667 7.15825 2.19267L7.19825 2.29933L7.73625 3.87267C7.85955 4.23349 8.05879 4.56367 8.32054 4.84095C8.58229 5.11822 8.90046 5.33614 9.25358 5.48L9.39825 5.534L10.9716 6.07133C12.1383 6.47 12.1736 8.082 11.0783 8.55467L10.9716 8.59467L9.39825 9.13267C9.03731 9.25588 8.70699 9.45508 8.4296 9.71684C8.1522 9.97859 7.93418 10.2968 7.79025 10.65L7.73625 10.794L7.19892 12.368C6.80025 13.5347 5.18825 13.57 4.71625 12.4747L4.67492 12.368L4.13758 10.7947C4.01437 10.4337 3.81517 10.1034 3.55341 9.82601C3.29166 9.54862 2.97345 9.3306 2.62025 9.18667L2.47625 9.13267L0.902919 8.59533C-0.264415 8.19667 -0.299748 6.58467 0.796252 6.11267L0.902919 6.07133L2.47625 5.534C2.83707 5.4107 3.16726 5.21146 3.44453 4.94971C3.72181 4.68796 3.93973 4.36979 4.08359 4.01667L4.13758 3.87267L4.67492 2.29867ZM5.93692 2.72933L5.39959 4.30267C5.21185 4.85287 4.90643 5.35554 4.50461 5.77566C4.10279 6.19579 3.61422 6.52328 3.07292 6.73533L2.90625 6.796L1.33292 7.33333L2.90625 7.87067C3.45645 8.05841 3.95912 8.36382 4.37925 8.76564C4.79938 9.16746 5.12687 9.65603 5.33892 10.1973L5.39959 10.364L5.93692 11.9373L6.47425 10.364C6.66199 9.8138 6.96741 9.31113 7.36923 8.891C7.77105 8.47087 8.25962 8.14338 8.80092 7.93133L8.96758 7.87133L10.5409 7.33333L8.96758 6.796C8.41738 6.60826 7.91472 6.30285 7.49459 5.90102C7.07446 5.4992 6.74697 5.01063 6.53492 4.46933L6.47492 4.30267L5.93692 2.72933ZM11.2703 1.20458e-07C11.395 -1.57315e-07 11.5172 0.0349855 11.623 0.100981C11.7288 0.166977 11.814 0.261335 11.8689 0.373333L11.9009 0.451333L12.1343 1.13533L12.8189 1.36867C12.9439 1.41113 13.0535 1.48974 13.1337 1.59454C13.214 1.69934 13.2613 1.82561 13.2698 1.95735C13.2782 2.08908 13.2473 2.22035 13.1811 2.33452C13.1148 2.4487 13.0161 2.54063 12.8976 2.59867L12.8189 2.63067L12.1349 2.864L11.9016 3.54867C11.859 3.67362 11.7804 3.78313 11.6755 3.86333C11.5707 3.94352 11.4444 3.99079 11.3127 3.99915C11.1809 4.0075 11.0497 3.97656 10.9356 3.91025C10.8214 3.84394 10.7296 3.74524 10.6716 3.62667L10.6396 3.54867L10.4063 2.86467L9.72159 2.63133C9.5966 2.58887 9.48703 2.51026 9.40677 2.40546C9.3265 2.30066 9.27916 2.17439 9.27073 2.04265C9.26231 1.91092 9.29318 1.77965 9.35944 1.66548C9.4257 1.5513 9.52436 1.45937 9.64292 1.40133L9.72159 1.36933L10.4056 1.136L10.6389 0.451333C10.6839 0.319617 10.7689 0.205272 10.8821 0.124333C10.9954 0.0433927 11.1311 -8.35209e-05 11.2703 1.20458e-07Z" fill="currentColor" />
          </svg>
          About Us
        </motion.div>

        {/* Desktop View: Tabbed Navigation & Content (visible on sm and up) */}
        <div className="hidden sm:flex flex-col items-center w-full gap-10">
          {/* Tab Navigation */}
          <div className="w-full max-w-4xl border-b border-gray-800 pb-1.5 relative">
            <div className="flex justify-start lg:justify-center gap-6 sm:gap-10 lg:gap-24 overflow-x-auto scrollbar-hide pb-2 px-4 sm:px-6 lg:px-8">
              {(["why", "workflow", "mission"] as const).map((tab) => {
                const isActive = activeTab === tab;
                const label =
                  tab === "why"
                    ? "Why CraftsmanAI Exist"
                    : tab === "workflow"
                      ? "The Workflow"
                      : "The Mission";

                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleTabChange(tab)}
                    className={`relative text-base sm:text-2xl font-satoshi font-medium tracking-wide pb-3 transition-colors duration-200 flex-shrink-0 cursor-pointer ${isActive ? "text-white" : "text-gray-500 hover:text-gray-350"
                      }`}
                  >
                    {label}

                    {/* Normal active indicator */}
                    {isActive && !isLooping && (
                      <motion.div
                        layoutId="activeTabUnderline"
                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white rounded-full z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}

                    {/* Infinite Loop enter indicator: Active tab is 'why' and isLooping is true */}
                    {isActive && isLooping && tab === "why" && (
                      <motion.div
                        initial={{ x: "-120%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white rounded-full z-10"
                        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}

                    {/* Infinite Loop exit indicator: Active tab is 'why', but we are rendering the exit line on 'mission' */}
                    {!isActive && isLooping && tab === "mission" && (
                      <motion.div
                        initial={{ x: 0, opacity: 1 }}
                        animate={{ x: "120%", opacity: 0 }}
                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white rounded-full z-10"
                        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Content Area */}
          <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 mt-6 min-h-[340px]">

            {/* Left Text Column */}
            <div className="w-full lg:w-[65%] flex flex-col items-start text-left">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="flex flex-col items-start w-full"
                >
                  {/* Title */}
                  <h3 className="text-2xl sm:text-3xl lg:text-[32px] font-normal leading-tight text-[#F1F1F1] mb-6 sm:whitespace-nowrap max-w-none font-satoshi">
                    {content.title}
                  </h3>

                  {/* Steps Horizontal Rail (for activeTab === "workflow") */}
                  {activeTab === "workflow" && content.steps && (
                    <div className="w-full mb-8 flex flex-nowrap items-center justify-start md:justify-between gap-3 py-2 overflow-x-auto scrollbar-hide">
                      {content.steps.map((step, idx, arr) => (
                        <div key={idx} className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
                          {/* Step Pill */}
                          <div className="bg-white rounded-full px-1.5 py-1 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2 flex items-center gap-1 sm:gap-1.5 lg:gap-2.5 shadow-sm border border-gray-100 transition-all duration-200">
                            <span className="bg-[#F5F2EB] text-[#8C8479] rounded-full w-4.5 h-4.5 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 flex items-center justify-center text-[10px] sm:text-xs lg:text-xs font-semibold">
                              {step.num}
                            </span>
                            <span className="text-[#1C1C1C] text-[10px] sm:text-xs lg:text-sm font-medium tracking-wide">
                              {step.label}
                            </span>
                          </div>

                          {/* Delicate Arrow separator (don't render after the last item) */}
                          {idx < arr.length - 1 && (
                            <svg
                              viewBox="0 0 14 10"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className="text-gray-600 shrink-0 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5"
                            >
                              <path
                                d="M1 5H13M13 5L9 1M13 5L9 9"
                                stroke="#666666"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-[16px] text-[#D5D5D5] font-normal leading-relaxed max-w-xl mb-6">
                    {content.description}
                  </p>

                  {/* Mission Statement Box (for activeTab === "mission") */}
                  {activeTab === "mission" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className="w-full max-w-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-sm shadow-xl"
                    >
                      <h4 className="text-white font-medium text-lg mb-2">
                        Mission Statement
                      </h4>
                      <p className="text-gray-400 font-light text-sm sm:text-base leading-relaxed">
                        Helping Jewelry retailers modernize the way they sell, present, and manage custom work.
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Logo Column */}
            <div className="hidden lg:flex w-full lg:w-[30%] items-center justify-center mt-6 lg:mt-0">
              <motion.div
                key={activeTab}
                initial={{ scale: 0.95, opacity: 0, rotate: -2 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80 flex items-center justify-center"
              >
                <Image
                  src="/logo_new.png"
                  alt="CraftsmanAI Logo"
                  fill
                  className="object-contain drop-shadow-[0_10px_30px_rgba(47,104,197,0.25)] select-none pointer-events-none transition-all duration-300 hover:scale-105"
                  sizes="(max-width: 768px) 256px, 320px"
                  priority
                />
              </motion.div>
            </div>

          </div>
        </div>

        {/* Mobile View: Stacked Sections (visible below sm) */}
        <div className="flex sm:hidden flex-col w-full gap-10 mt-4 text-left">
          
          {/* Why Section */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col w-full border-l-2 border-[#2F68C5] pl-4"
          >
            <span className="text-xs uppercase tracking-wider text-[#2F68C5] font-semibold mb-1">
              Why CraftsmanAI Exist
            </span>
            <h3 className="text-xl font-medium text-[#F1F1F1] mb-2 font-satoshi">
              {tabData.why.title}
            </h3>
            <p className="text-sm text-[#D5D5D5] font-light leading-relaxed">
              {tabData.why.description}
            </p>
          </motion.div>

          {/* Workflow Section */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-col w-full border-l-2 border-[#2F68C5] pl-4"
          >
            <span className="text-xs uppercase tracking-wider text-[#2F68C5] font-semibold mb-1">
              The Workflow
            </span>
            <h3 className="text-xl font-medium text-[#F1F1F1] mb-3 font-satoshi">
              {tabData.workflow.title}
            </h3>
            
            {/* Steps - Wrapped flex layout, no horizontal scroll */}
            <div className="flex flex-wrap items-center gap-y-2.5 gap-x-1.5 mb-3.5">
              {tabData.workflow.steps?.map((step, idx, arr) => {
                return (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div className="bg-white rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-sm border border-gray-100">
                      <span className="bg-[#F5F2EB] text-[#8C8479] rounded-full w-4.5 h-4.5 flex items-center justify-center text-[10px] font-semibold">
                        {step.num}
                      </span>
                      <span className="text-[#1C1C1C] text-[11px] font-medium">
                        {step.label}
                      </span>
                    </div>
                    {idx < arr.length - 1 && (
                      <span className="text-gray-600 text-xs font-light">→</span>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-sm text-[#D5D5D5] font-light leading-relaxed">
              {tabData.workflow.description}
            </p>
          </motion.div>

          {/* Mission Section */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col w-full border-l-2 border-[#2F68C5] pl-4"
          >
            <span className="text-xs uppercase tracking-wider text-[#2F68C5] font-semibold mb-1">
              The Mission
            </span>
            <h3 className="text-xl font-medium text-[#F1F1F1] mb-2 font-satoshi">
              {tabData.mission.title}
            </h3>
            <p className="text-sm text-[#D5D5D5] font-light leading-relaxed mb-4">
              {tabData.mission.description}
            </p>

            {/* Mission Statement Box */}
            <div className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 backdrop-blur-sm shadow-md">
              <h4 className="text-white font-medium text-sm mb-1.5 font-satoshi">
                Mission Statement
              </h4>
              <p className="text-gray-400 font-light text-xs leading-relaxed">
                Helping Jewelry retailers modernize the way they sell, present, and manage custom work.
              </p>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
