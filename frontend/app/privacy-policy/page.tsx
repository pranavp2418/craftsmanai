"use client";

import Header from "@/src/components/landing/Header";
import Footer from "@/src/components/landing/Footer";
import { motion } from "framer-motion";

export default function PrivacyPolicy() {
  const sections = [
    {
      id: "introduction",
      title: "1. Introduction",
      content:
        "Craftsman AI is committed to protecting your privacy. This Privacy Policy describes how we collect, use, store, and disclose your personal and business information when you use our AI-powered jewelry design platform.",
    },
    {
      id: "information-collected",
      title: "2. Information We Collect",
      content: (
        <div className="space-y-4">
          <p>We collect several types of information to provide and improve our services, including:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              <strong>Account Data:</strong> Contact information, such as your name, business name, email address, and login credentials when you sign up.
            </li>
            <li>
              <strong>Design Data:</strong> Images, reference files, custom design specifications, and preferences uploaded or created by you on the platform.
            </li>
            <li>
              <strong>Billing Information:</strong> Stripe transaction details, subscription tiers, usage statistics, and payment history (we do not store raw credit card details directly).
            </li>
            <li>
              <strong>Usage and Log Data:</strong> Details about how you interact with our features, including page views, active sessions, performance indicators, and browser type.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "how-we-use",
      title: "3. How We Use Your Information",
      content: (
        <div className="space-y-4">
          <p>We process your information for purposes based on legitimate business interests, including:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>To set up and manage your user and billing account.</li>
            <li>To process your subscriptions, top-ups, and verify transaction statuses.</li>
            <li>To generate AI-powered CAD-style jewelry renders based on your inputs.</li>
            <li>To facilitate cooperation and quote sharing between jewelry retailers and manufacturers.</li>
            <li>To improve platform security, address technical bugs, and optimize loading behaviors.</li>
          </ul>
        </div>
      ),
    },
    {
      id: "sharing",
      title: "4. Sharing and Disclosure",
      content:
        "We do not sell your personal or business data. We may share information with trusted third-party service providers (like payment processors and cloud hosting platforms) strictly to operate our platform, or when required by law to comply with legal processes.",
    },
    {
      id: "data-security",
      title: "5. Data Security",
      content:
        "We implement industry-standard administrative, physical, and technical security measures designed to protect your personal and design data against unauthorized access, alteration, or disclosure. However, please be aware that no online transmission is 100% secure.",
    },
    {
      id: "retention",
      title: "6. Data Retention",
      content:
        "We retain your personal and design information as long as your account remains active or as needed to provide you with our services, comply with legal requirements, resolve disputes, and enforce our agreements.",
    },
    {
      id: "rights",
      title: "7. Your Choices and Rights",
      content:
        "You can update your profile information, manage email preferences, and request account deletion by navigating to your account settings page or contacting our support team directly.",
    },
    {
      id: "contact",
      title: "8. Contact Us",
      content: (
        <p>
          If you have any questions or feedback regarding this Privacy Policy, please email us at{" "}
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
              Privacy Policy
            </h1>
            <p className="text-blue-100/80 text-sm md:text-base max-w-xl mx-auto">
              Learn how we handle, protect, and respect your personal and design data.
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
