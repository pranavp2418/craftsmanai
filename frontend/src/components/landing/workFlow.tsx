"use client";

import { CircleMinus, MoveRight, Clock4, ThumbsUp, CheckCircle, FileText, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import CompareIcon from '@mui/icons-material/Compare';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import CTAButton from './CTAButton';

export default function WorkflowComparisonSection() {
  return (
    <section className="w-full bg-[#FAF6F3] py-16 md:pt-20 md:pb-20 mt-0">
      <div className="max-w-[1200px] mx-auto px-4 bg-[#FAF6F3] overflow-hidden">
        {/* Top Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex justify-center mb-8"
        >
          <span className="flex gap-1 items-center bg-[#3575DD] text-white rounded-full px-4 py-1 text-sm font-light tracking-wider">
            <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
            Before vs After
          </span>
        </motion.div>

        {/* Main Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          className="text-[#1E1E1E] font-satoshi font-normal text-2xl md:text-3xl lg:text-4xl text-center mb-12"
        >
          Traditional workflow VS <span className="text-[#2C62B9]">CraftsmanAI</span>
        </motion.h2>

        {/* ROW 1: Image Left, Text Right */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-center mb-12 md:mb-20">
          {/* Image Left */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full md:flex-1"
          >
            <img
              src="/work1.png"
              alt="Traditional Workflow"
              className="w-full"
              style={{
                borderRadius: '24px',
                boxShadow: '0 169px 47px 0 rgba(0,0,0,0.00), 0 108px 43px 0 rgba(0,0,0,0.01), 0 61px 36px 0 rgba(0,0,0,0.05), 0 27px 27px 0 rgba(0,0,0,0.09), 0 7px 15px 0 rgba(0,0,0,0.10)',
              }}
            />
          </motion.div>

          {/* Text Right */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
            className="w-full md:flex-1 "
          >
            <h3 className="text-[#1E1E1E] font-normal font-satoshi text-xl md:text-[40px] mb-6 ml-5">
              Traditional Workflow
            </h3>

            <div className="space-y-4 ml-5">
              <div className="flex items-center gap-3">
                <CircleMinus className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Customer explains the idea manually.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CircleMinus className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Renders take days or weeks.
                </span>
              </div>
              {/* <div className="flex items-center gap-3">
                <CircleMinus className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Renders take days or weeks
                </span>
              </div> */}
              <div className="flex items-center gap-3">
                <CircleMinus className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Quotes are delayed.
                </span>
              </div>
              {/* <div className="flex items-center gap-3">
                <CircleMinus className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Delayed quotations
                </span>
              </div> */}
              <div className="flex items-center gap-3">
                <CircleMinus className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Follow-ups get lost.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CircleMinus className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Deposits come late.
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ROW 2: Text Left, Image Right */}
        <div className="flex flex-col md:flex-row-reverse gap-8 md:gap-16 items-center">
          {/* Image Right */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full md:flex-1"
          >
            <img
              src="/work2.png"
              alt="Craftsman.ai Workflow"
              className="w-full"
              style={{
                borderRadius: '24px',
                boxShadow: '0 169px 47px 0 rgba(0,0,0,0.00), 0 108px 43px 0 rgba(0,0,0,0.01), 0 61px 36px 0 rgba(0,0,0,0.05), 0 27px 27px 0 rgba(0,0,0,0.09), 0 7px 15px 0 rgba(0,0,0,0.10)',
              }}
            />
          </motion.div>

          {/* Text Left */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
            className="w-full md:flex-1"
          >
            <h3 className="text-[#2C62B9] font-normal font-satoshi text-xl md:text-[40px] mb-6 ml-5">
              With CraftsmanAI
            </h3>

            <div className="space-y-4 mb-8 ml-5">
              <div className="flex items-center gap-3">
                <CompareIcon sx={{ width: 20, height: 20, color: '#515151' }} className="flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Render generated instantly.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Quote ready in minutes.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <DeviceHubIcon sx={{ width: 20, height: 20, color: '#515151' }} className="flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Everything stays in one place.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock4 className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Deposit collected faster.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <ThumbsUp className="w-5 h-5 text-[#515151] flex-shrink-0" />
                <span className="text-[#515151] font-normal text-sm md:text-base">
                  Customer approval made simple.
                </span>
              </div>
            </div>

            {/* Gradient Text Badge */}
            <div className="mb-8 ml-5 ">
              <div
                className="inline-block rounded-[50px] px-5 py-3"
                style={{ background: "linear-gradient(90deg, #F1F1F1 12.21%, #E2ECFE 100%)" }}
              >
                <span className="bg-gradient-to-r from-[#2C62B9] via-[#7C3AED] to-[#1FBED6] bg-clip-text text-transparent font-medium text-sm md:text-base">
                  From weeks of waiting to minutes of closing.
                </span>
              </div>
            </div>

            {/* CTA Button */}
            {/* <button className="bg-[#2F68C5] hover:bg-[#1e4fa5] text-white rounded-lg px-6 py-2 ml-5 font-base text-base shadow transition-colors inline-flex items-center gap-2">
              Start Creating Free
             
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E9EFFD]">
                <path d="M12 4L10.59 5.41L16.17 11H4V13H16.17L10.59 18.59L12 20L20 12L12 4Z" fill="currentColor"/>
              </svg>

            </button> */}
            <div className='ml-5'>
              <CTAButton />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
