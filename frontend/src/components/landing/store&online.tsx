"use client";

import { Store, Radio, Check } from "lucide-react";
import { motion } from "framer-motion";

export default function StoreAndOnline() {
  return (
    <section className="w-full bg-[#FAF6F3] pt-10 sm:pt-14 md:pt-5 pb-4 sm:pb-6 md:pb-5 mt-0 md:mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Store Card */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
            className="bg-[#F1F1F1] rounded-3xl p-8"
          >
            {/* Header */}
            <div className="flex items-start gap-6 mb-7">
              {/* <Store size={64}  className="text-[#515151] flex-shrink-0 font-base text-base" /> */}
              <svg
                viewBox="0 0 87 83"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-16 h-16 flex-shrink-0 text-[#515151]"
              >
                <path
                  d="M55.6705 80.6667V59.8333C55.6705 58.7283 55.2316 57.6685 54.4502 56.8871C53.6688 56.1057 52.6089 55.6667 51.5039 55.6667H34.8372C33.7321 55.6667 32.6723 56.1057 31.8909 56.8871C31.1095 57.6685 30.6705 58.7283 30.6705 59.8333V80.6667M67.2289 36.125C66.3603 35.2935 65.2042 34.8293 64.0018 34.8293C62.7993 34.8293 61.6433 35.2935 60.7747 36.125C58.8372 37.973 56.2626 39.004 53.5851 39.004C50.9077 39.004 48.333 37.973 46.3955 36.125C45.5272 35.2947 44.372 34.8313 43.1705 34.8313C41.9691 34.8313 40.8139 35.2947 39.9455 36.125C38.0079 37.9742 35.4323 39.006 32.7539 39.006C30.0754 39.006 27.4999 37.9742 25.5622 36.125C24.6936 35.2935 23.5376 34.8293 22.3351 34.8293C21.1327 34.8293 19.9766 35.2935 19.108 36.125C17.2366 37.9109 14.7675 38.9365 12.1815 39.0023C9.59545 39.068 7.07747 38.1692 5.11764 36.4807C3.15781 34.7923 1.89636 32.435 1.57881 29.8677C1.26126 27.3004 1.91034 24.7068 3.3997 22.5917L15.4372 5.15833C16.201 4.0313 17.2293 3.10856 18.4321 2.47082C19.635 1.83307 20.9757 1.49975 22.3372 1.5H64.0039C65.3614 1.49948 66.6984 1.83059 67.8988 2.46453C69.0991 3.09848 70.1264 4.01607 70.8914 5.1375L82.9539 22.6042C84.4436 24.7209 85.0918 27.3165 84.7723 29.8852C84.4528 32.4538 83.1883 34.8114 81.2254 36.4987C79.2625 38.186 76.7417 39.082 74.1542 39.0121C71.5667 38.9423 69.0979 37.9116 67.2289 36.1208M9.83721 38.7917V72.3333C9.83721 74.5435 10.7152 76.6631 12.278 78.2259C13.8408 79.7887 15.9604 80.6667 18.1705 80.6667H68.1705C70.3807 80.6667 72.5003 79.7887 74.0631 78.2259C75.6259 76.6631 76.5039 74.5435 76.5039 72.3333V38.7917"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <div>
                <h3 className="text-xl sm:text-3xl font-medium text-[#1E1E1E] font-satoshi mb-1">
                  Store
                </h3>
                <p className="text-sm sm:text-base text-[#6D6D6D]">
                  In-Store Sales. Reinvented.
                </p>
              </div>
            </div>

            {/* Separator */}
            <div
              className="border-t border-[#D5D5D5] my-5"
              style={{ borderTopWidth: "0.7px" }}
            ></div>

            {/* Checklist */}
            <div className="space-y-3 mb-5 min-h-[180px]">
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                Designed for your Store Experience

                </span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  Customer walks in with and Idea
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  You generate a CAD Render in Minutes
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  They Approve or edit it on the spot

                </span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  Sale Locked and Deposit Collected Immediately

                </span>
              </div>
               <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  Quote Request Sent to Manufacturers Instantly
                </span>
              </div>
                <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                   Everything stays on one Portal
                </span>
              </div>
            </div>

            {/* Highlight Text */}
            <p className="text-sm sm:text-base text-[#2F68C5] font-medium mt-5 mb-5">
              Turn Showroom Conversations Into Confirmed Orders — Before The
              Customer Walks Out.
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2.5">
              <div className="inline-flex items-center gap-2 border border-[#6D6D6D] text-[#515151] rounded-full px-3.5 py-1.5 text-xs sm:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12.0001 4.66656L11.0601 3.72656L6.83344 7.95323L7.77344 8.89323L12.0001 4.66656ZM14.8268 3.72656L7.77344 10.7799L4.98677 7.9999L4.04677 8.9399L7.77344 12.6666L15.7734 4.66656L14.8268 3.72656ZM0.273438 8.9399L4.0001 12.6666L4.9401 11.7266L1.2201 7.9999L0.273438 8.9399Z" fill="#6D6D6D" /></svg>
                Instant renders
              </div>
              <div className="inline-flex items-center gap-2 border border-[#6D6D6D] text-[#515151] rounded-full px-3.5 py-1.5 text-xs sm:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12.0001 4.66656L11.0601 3.72656L6.83344 7.95323L7.77344 8.89323L12.0001 4.66656ZM14.8268 3.72656L7.77344 10.7799L4.98677 7.9999L4.04677 8.9399L7.77344 12.6666L15.7734 4.66656L14.8268 3.72656ZM0.273438 8.9399L4.0001 12.6666L4.9401 11.7266L1.2201 7.9999L0.273438 8.9399Z" fill="#6D6D6D" /></svg>
                Higher approval rates
              </div>
              <div className="inline-flex items-center gap-2 border border-[#6D6D6D] text-[#515151] rounded-full px-3.5 py-1.5 text-xs sm:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12.0001 4.66656L11.0601 3.72656L6.83344 7.95323L7.77344 8.89323L12.0001 4.66656ZM14.8268 3.72656L7.77344 10.7799L4.98677 7.9999L4.04677 8.9399L7.77344 12.6666L15.7734 4.66656L14.8268 3.72656ZM0.273438 8.9399L4.0001 12.6666L4.9401 11.7266L1.2201 7.9999L0.273438 8.9399Z" fill="#6D6D6D" /></svg>
                Faster deposits
              </div>
              <div className="inline-flex items-center gap-2 border border-[#6D6D6D] text-[#515151] rounded-full px-3.5 py-1.5 text-xs sm:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12.0001 4.66656L11.0601 3.72656L6.83344 7.95323L7.77344 8.89323L12.0001 4.66656ZM14.8268 3.72656L7.77344 10.7799L4.98677 7.9999L4.04677 8.9399L7.77344 12.6666L15.7734 4.66656L14.8268 3.72656ZM0.273438 8.9399L4.0001 12.6666L4.9401 11.7266L1.2201 7.9999L0.273438 8.9399Z" fill="#6D6D6D" /></svg>
                Eliminating "I'll think about it"
              </div>
            </div>
          </motion.div>

          {/* Online Card */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
            className="bg-[#F1F1F1] rounded-3xl p-8"
          >
            {/* Header */}
            <div className="flex items-start gap-6 mb-7">
              {/* <Radio size={64} className=" text-[#515151] flex-shrink-0" /> */}
              <svg
                viewBox="0 0 78 56"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-16 h-16 flex-shrink-0 text-[#515151]"
              >
                <path
                  d="M12.2337 54.2833C8.75141 50.8011 5.98914 46.6671 4.10456 42.1174C2.21998 37.5677 1.25 32.6913 1.25 27.7667C1.25 22.8421 2.21998 17.9657 4.10456 13.4159C5.98914 8.86619 8.75141 4.7322 12.2337 1.25M65.267 1.25C68.7492 4.7322 71.5115 8.86619 73.3961 13.4159C75.2807 17.9657 76.2506 22.8421 76.2506 27.7667C76.2506 32.6913 75.2807 37.5677 73.3961 42.1174C71.5115 46.6671 68.7492 50.8011 65.267 54.2833M24.017 42.5C22.0819 40.5654 20.5468 38.2685 19.4995 35.7405C18.4522 33.2125 17.9131 30.503 17.9131 27.7667C17.9131 25.0303 18.4522 22.3208 19.4995 19.7928C20.5468 17.2648 22.0819 14.968 24.017 13.0333M53.4837 13.0333C55.4188 14.968 56.9539 17.2648 58.0012 19.7928C59.0485 22.3208 59.5875 25.0303 59.5875 27.7667C59.5875 30.503 59.0485 33.2125 58.0012 35.7405C56.9539 38.2685 55.4188 40.5654 53.4837 42.5M42.917 27.7667C42.917 28.8717 42.478 29.9315 41.6966 30.7129C40.9152 31.4943 39.8554 31.9333 38.7503 31.9333C37.6453 31.9333 36.5854 31.4943 35.804 30.7129C35.0226 29.9315 34.5837 28.8717 34.5837 27.7667C34.5837 26.6616 35.0226 25.6018 35.804 24.8204C36.5854 24.039 37.6453 23.6 38.7503 23.6C39.8554 23.6 40.9152 24.039 41.6966 24.8204C42.478 25.6018 42.917 26.6616 42.917 27.7667Z"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <div>
                <h3 className="text-xl sm:text-3xl font-medium text-[#1E1E1E] font-satoshi mb-1">
                  Online
                </h3>
                <p className="text-sm sm:text-base text-[#6D6D6D]">
                  Close Online Custom Orders Faster.
                </p>
              </div>
            </div>

            {/* Separator */}
            <div
              className="border-t border-[#D5D5D5] my-5"
              style={{ borderTopWidth: "0.7px" }}
            ></div>

            {/* Checklist */}
            <div className="space-y-3 mb-5 min-h-[180px]">
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  Designed for your Online Presence Experience
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  Customer can Design from your Online Store or Social Media
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  Customer can send request Online or through Social Media
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  You generate a CAD Render in Minutes
                </span>
              </div>
               <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  They Approve Digitally
                </span>
              </div>
               <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  Quote Sent Instantly
                </span>
              </div>
               <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-[#515151] flex-shrink-0" />
                <span className="text-sm sm:text-base text-[#515151] font-medium">
                  Request, Design, Approval, Costing Happens Online
                </span>
              </div>
            </div>

            {/* Highlight Text */}
            <p className="text-sm sm:text-base text-[#2F68C5] font-medium mt-5 mb-5">
              No Weeks Of Delay, No Lost Online Inquiries.
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2.5 mt-10">
              <div className="inline-flex items-center gap-2 border border-[#6D6D6D] text-[#515151] rounded-full px-3.5 py-1.5 text-xs sm:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12.0001 4.66656L11.0601 3.72656L6.83344 7.95323L7.77344 8.89323L12.0001 4.66656ZM14.8268 3.72656L7.77344 10.7799L4.98677 7.9999L4.04677 8.9399L7.77344 12.6666L15.7734 4.66656L14.8268 3.72656ZM0.273438 8.9399L4.0001 12.6666L4.9401 11.7266L1.2201 7.9999L0.273438 8.9399Z" fill="#6D6D6D" /></svg>
                Faster response
              </div>
              <div className="inline-flex items-center gap-2 border border-[#6D6D6D] text-[#515151] rounded-full px-3.5 py-1.5 text-xs sm:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12.0001 4.66656L11.0601 3.72656L6.83344 7.95323L7.77344 8.89323L12.0001 4.66656ZM14.8268 3.72656L7.77344 10.7799L4.98677 7.9999L4.04677 8.9399L7.77344 12.6666L15.7734 4.66656L14.8268 3.72656ZM0.273438 8.9399L4.0001 12.6666L4.9401 11.7266L1.2201 7.9999L0.273438 8.9399Z" fill="#6D6D6D" /></svg>
                Reduced lost sales
              </div>
              <div className="inline-flex items-center gap-2 border border-[#6D6D6D] text-[#515151] rounded-full px-3 py-1.5 text-xs sm:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12.0001 4.66656L11.0601 3.72656L6.83344 7.95323L7.77344 8.89323L12.0001 4.66656ZM14.8268 3.72656L7.77344 10.7799L4.98677 7.9999L4.04677 8.9399L7.77344 12.6666L15.7734 4.66656L14.8268 3.72656ZM0.273438 8.9399L4.0001 12.6666L4.9401 11.7266L1.2201 7.9999L0.273438 8.9399Z" fill="#6D6D6D" /></svg>
                Higher engagement
              </div>
              <div className="inline-flex items-center gap-2 border border-[#6D6D6D] text-[#515151] rounded-full px-3.5 py-1.5 text-xs sm:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12.0001 4.66656L11.0601 3.72656L6.83344 7.95323L7.77344 8.89323L12.0001 4.66656ZM14.8268 3.72656L7.77344 10.7799L4.98677 7.9999L4.04677 8.9399L7.77344 12.6666L15.7734 4.66656L14.8268 3.72656ZM0.273438 8.9399L4.0001 12.6666L4.9401 11.7266L1.2201 7.9999L0.273438 8.9399Z" fill="#6D6D6D" /></svg>
                Competitive edge
              </div>
            </div>
          </motion.div>
        </div>

        {/* Security Badges */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2.5 mt-12 font-satoshi"
        >
          <div
            className="inline-flex justify-center sm:justify-start items-center gap-3 text-[#1E1E1E] font-base tracking-wide rounded-[50px] px-6 sm:px-10 py-4 text-sm sm:text-base w-[290px] xs:w-[320px] sm:w-auto"
            style={{
              background:
                "linear-gradient(90deg, #F1F1F1 12.21%, #E2ECFE 100%)",
            }}
          >
            <Check className="w-4 h-4" />
            Commercial usage rights
          </div>
          <div
            className="inline-flex justify-center sm:justify-start items-center gap-3 text-[#1E1E1E] font-base tracking-wide rounded-[50px] px-6 sm:px-10 py-4 text-sm sm:text-base w-[290px] xs:w-[320px] sm:w-auto"
            style={{
              background:
                "linear-gradient(90deg, #F1F1F1 12.21%, #E2ECFE 100%)",
            }}
          >
            <Check className="w-4 h-4" />
            Data privacy
          </div>
          <div
            className="inline-flex justify-center sm:justify-start items-center gap-3 text-[#1E1E1E] font-base tracking-wide rounded-[50px] px-6 sm:px-10 py-4 text-sm sm:text-base w-[290px] xs:w-[320px] sm:w-auto"
            style={{
              background:
                "linear-gradient(90deg, #F1F1F1 12.21%, #E2ECFE 100%)",
            }}
          >
            <Check className="w-4 h-4" />
            Secure approval links
          </div>
          <div
            className="inline-flex justify-center sm:justify-start items-center gap-3 text-[#1E1E1E] font-base tracking-wide rounded-[50px] px-6 sm:px-10 py-4 text-sm sm:text-base w-[290px] xs:w-[320px] sm:w-auto"
            style={{
              background:
                "linear-gradient(90deg, #F1F1F1 12.21%, #E2ECFE 100%)",
            }}
          >
            <Check className="w-4 h-4" />
            No customer account required
          </div>
        </motion.div>
      </div>
    </section>
  );
}
