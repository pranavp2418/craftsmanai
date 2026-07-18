"use client";

import Header from "@/src/components/landing/Header";
import Footer from "@/src/components/landing/Footer";
import { motion } from "framer-motion";

export default function TermsAndConditions() {
  const sections = [
    {
      id: "agreement",
      title: "1. Agreement to Terms",
      content:
        "By accessing or using Craftsman AI, you agree to be bound by these Terms and Conditions and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this platform.",
    },
    {
      id: "services",
      title: "2. Services Offered",
      content:
        "Craftsman AI provides an AI-powered jewelry design platform that allows jewelry retailers, manufacturers, and designers to generate CAD-styled renders, manage customer approvals, and coordinate manufacturer quotes. The platform and its contents are subject to changes, updates, or discontinuation of certain features at our sole discretion.",
    },
    {
      id: "accounts",
      title: "3. User Accounts",
      content:
        "To access certain features of the platform, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate. You are responsible for safeguarding your account password and for any activities or actions under your account.",
    },
    {
      id: "payments",
      title: "4. Payments and Billing",
      content:
        "Certain services on the platform are provided on a paid basis. All fees and billing structures are detailed in the Pricing section or agreed upon in writing. You agree to pay all charges incurred by your account at the prices in effect when such charges are incurred.",
    },
    {
      id: "refund-policy",
      title: "5. Refund & Cancellation Policy",
      content: (
        <div className="space-y-4">
          <p>
            At Craftsman AI, we strive to ensure a smooth and seamless billing experience.
            We understand that payment-related issues can occasionally occur.
          </p>
          <div className="border-l-4 border-amber-500 bg-amber-50/50 p-4 rounded-r-lg my-4">
            <h4 className="font-semibold text-[#152E56] mb-1">
              7-Day Refund Policy for Payment Issues
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              If you experience any payment error, double billing, technical transaction issue, or unauthorized charge, you are eligible for a full refund. You must notify our support team within <strong>7 days</strong> of the transaction date to claim a refund.
            </p>
          </div>
          <p>
            To initiate a refund request under these terms, please contact our support team at{" "}
            <a
              href="mailto:info@craftsmanai.app"
              className="text-[#2563EB] hover:underline font-medium"
            >
              info@craftsmanai.app
            </a>{" "}
            with your account details, transaction ID, and a brief description of the issue.
          </p>
          <p>
            Once verified and approved, refunds will be processed and credited back to your original payment method within 5-7 business days.
          </p>
        </div>
      ),
    },
    {
      id: "ip",
      title: "6. Intellectual Property Rights",
      content:
        "Unless otherwise indicated, the platform, including its source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics, is our proprietary property or is licensed to us, and is protected by copyright and trademark laws.",
    },
    {
      id: "liability",
      title: "7. Limitation of Liability",
      content:
        "In no event shall Craftsman AI, its directors, employees, or partners be liable for any direct, indirect, incidental, special, or consequential damages resulting from your use of, or inability to use, the platform.",
    },
    {
      id: "contact",
      title: "8. Contact Us",
      content: (
        <p>
          If you have any questions or concerns regarding these Terms and Conditions, please contact us at{" "}
          <a
            href="mailto:info@craftsmanai.app"
            className="text-[#2563EB] hover:underline font-medium"
          >
            info@craftsmanai.app
          </a>
          .
        </p>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf6f3] text-[#333333] flex flex-col justify-between">
      <div>
        <Header />

        {/* Hero Header Section */}
        <section className="bg-[#152E56] text-white py-16 px-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-gradient from-blue-900/30 to-transparent opacity-50" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 max-w-4xl mx-auto"
          >
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight font-satoshi mb-4">
              Terms & Conditions
            </h1>
            <p className="text-blue-100/80 text-sm md:text-base max-w-xl mx-auto">
              Please read these terms carefully before using our platform.
            </p>
            <div className="mt-4 text-xs text-blue-200/60 uppercase tracking-widest font-semibold">
              Last Updated: July 13, 2026
            </div>
          </motion.div>
        </section>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-12 md:py-20">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-12 space-y-10"
          >
            {sections.map((section, idx) => (
              <div
                key={section.id}
                className={`pb-8 ${idx !== sections.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <h2 className="text-xl md:text-2xl font-bold text-[#152E56] mb-4 font-satoshi">
                  {section.title}
                </h2>
                <div className="text-gray-600 leading-relaxed text-sm md:text-base space-y-4">
                  {typeof section.content === "string" ? <p>{section.content}</p> : section.content}
                </div>
              </div>
            ))}
          </motion.div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
