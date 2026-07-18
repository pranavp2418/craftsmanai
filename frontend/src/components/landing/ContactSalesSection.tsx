"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Briefcase, Mail, Phone, Store, ChevronDown } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { submitContactForm, resetContactState } from "@/redux/slices/retailer/contactSlice";
import { toast } from "react-toastify";
import Image from "next/image";
import { isValidEmail, getPhoneMaxLength, getPhoneLengthMessage, sanitizePhoneDigits } from "@/lib/formValidation";
import CountryCodeSelect from "@/src/utils/components/CountryCodeSelect";

// Custom select options
const STORE_TYPE_OPTIONS = [
  { label: "Offline Retail Store", value: "Offline Retail Store" },
  { label: "Online Store", value: "Online Store" },
  { label: "Both online & offline stores", value: "Both online & offline stores" },
  { label: "Manufacturer", value: "Manufacturer" },
  { label: "Designer", value: "Designer" },
];

const INTEREST_OPTIONS = [
  { label: "Book a Free Demo", value: "Book a Free Demo" },
  { label: "AI Design & Render Workflow", value: "AI Design & Render Workflow" },
  { label: "In-Store Virtual Kiosk", value: "In-Store Virtual Kiosk" },
  { label: "Website Integration", value: "Website Integration" },
  { label: "White-Label Hardware", value: "White-Label Hardware" },
  { label: "Deposit Collection Integration", value: "Deposit Collection Integration" },
  { label: "Enterprise API Access", value: "Enterprise API Access" },
  { label: "Custom Manufacturing Workflow", value: "Custom Manufacturing Workflow" },
  { label: "Just Exploring", value: "Just Exploring" },
];

function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  icon: Icon,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon?: any;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div className="relative" ref={ref}>
      {Icon && (
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#515151] pointer-events-none z-10" />
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-[#E6E6E6] text-left text-[16px] sm:text-sm md:text-base rounded-full py-3 sm:py-3.5 ${Icon ? "pl-11" : "pl-5"
          } pr-10 focus:outline-none focus:ring-2 focus:ring-[#2C62B9] transition-all ${!value ? "text-[#9CA3AF]" : "text-[#515151]"
          }`}
      >
        <span className="block truncate">{selectedLabel || placeholder}</span>
      </button>
      <ChevronDown
        className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#515151] pointer-events-none transition-transform duration-200 ${isOpen ? "rotate-180" : ""
          }`}
      />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-[#E6E6E6] rounded-[24px] py-2 shadow-xl border border-white/40 overflow-hidden"
          >
            <div className="max-h-[280px] overflow-y-auto scrollbar-hide">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-5 py-3 text-[16px] sm:text-sm md:text-base text-[#1E1E1E] hover:bg-[#F5F5F5] transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ContactSalesSection() {
  const dispatch = useAppDispatch();
  const { loading, success } = useAppSelector((state) => state.retailerContact);

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+1");
  const [storeType, setStoreType] = useState("");
  const [interest, setInterest] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (success) {
      setFullName("");
      setBusinessName("");
      setEmail("");
      setPhone("");
      setPhoneCountryCode("+1");
      setStoreType("");
      setInterest("");
      setErrors({});
      dispatch(resetContactState());
    }
  }, [success, dispatch]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!fullName.trim()) {
      nextErrors.fullName = "Full Name is required.";
    }
    if (!businessName.trim()) {
      nextErrors.businessName = "Business Name is required.";
    }
    if (!email.trim()) {
      nextErrors.email = "Work Email is required.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Please enter a valid Work Email.";
    }
    if (!phone.trim()) {
      nextErrors.phone = "Phone Number is required.";
    } else {
      const maxLength = getPhoneMaxLength(phoneCountryCode);
      if (phone.length !== maxLength) {
        nextErrors.phone = getPhoneLengthMessage(phoneCountryCode);
      }
    }
    if (!storeType) {
      nextErrors.storeType = "Please select a Store Type.";
    }
    if (!interest) {
      nextErrors.interest = "Please select what you are interested in.";
    }
    return nextErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    dispatch(
      submitContactForm({
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        email: email.trim(),
        phone: `${phoneCountryCode}${phone.trim()}`,
        store_type: storeType,
        interest: interest,
      })
    );
  };

  return (
    <section id="contact-us" className="w-full bg-[#FAF6F3] py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 scroll-mt-16 sm:scroll-mt-20">
      <div className="max-w-7xl mx-auto flex flex-col items-start font-satoshi">
        {/* Headings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-10 w-full"

        >
          <div>
            <Image
              src="/landingPageLogo.png"
              alt="CraftsmanAI"
              width={150}
              height={30}
              className="object-contain mb-10"
            />
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-medium text-[#1E1E1E] leading-tight mb-4 font-satoshi">
            Turn Custom Requests Into Confirmed Sales.
          </h2>
          <p className="text-[#515151] text-base md:text-lg leading-relaxed max-w-3xl">
            From instant renders to production-ready approvals, tell us about your store and we'll show you how CraftsmanAI can transform your workflow.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="w-full"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
            {/* Full Name */}
            <div className="flex flex-col gap-2">
              <label className="text-[#1E1E1E] font-medium text-sm md:text-base ml-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-4 w-4 h-4 text-[#515151]" />
                <input
                  type="text"
                  placeholder="Enter your Full Name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setErrors((prev) => ({ ...prev, fullName: "" }));
                  }}
                  className={`w-full bg-[#E6E6E6] text-[#515151] placeholder:text-[#9CA3AF] text-[16px] sm:text-sm md:text-base rounded-full py-3 sm:py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 transition-all ${
                    errors.fullName ? "border border-red-500 focus:ring-red-500" : "border border-transparent focus:ring-[#2C62B9]"
                  }`}
                />
              </div>
              {errors.fullName && (
                <span className="text-red-500 text-xs mt-1 ml-1">{errors.fullName}</span>
              )}
            </div>

            {/* Business Name */}
            <div className="flex flex-col gap-2">
              <label className="text-[#1E1E1E] font-medium text-sm md:text-base ml-1">
                Business Name <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Briefcase className="absolute left-4 w-4 h-4 text-[#515151]" />
                <input
                  type="text"
                  placeholder="Enter your Business Name"
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    setErrors((prev) => ({ ...prev, businessName: "" }));
                  }}
                  className={`w-full bg-[#E6E6E6] text-[#515151] placeholder:text-[#9CA3AF] text-[16px] sm:text-sm md:text-base rounded-full py-3 sm:py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 transition-all ${
                    errors.businessName ? "border border-red-500 focus:ring-red-500" : "border border-transparent focus:ring-[#2C62B9]"
                  }`}
                />
              </div>
              {errors.businessName && (
                <span className="text-red-500 text-xs mt-1 ml-1">{errors.businessName}</span>
              )}
            </div>

            {/* Work Email */}
            <div className="flex flex-col gap-2">
              <label className="text-[#1E1E1E] font-medium text-sm md:text-base ml-1">
                Work Email <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 w-4 h-4 text-[#515151]" />
                <input
                  type="email"
                  placeholder="Enter your Work Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  className={`w-full bg-[#E6E6E6] text-[#515151] placeholder:text-[#9CA3AF] text-[16px] sm:text-sm md:text-base rounded-full py-3 sm:py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 transition-all ${
                    errors.email ? "border border-red-500 focus:ring-red-500" : "border border-transparent focus:ring-[#2C62B9]"
                  }`}
                />
              </div>
              {errors.email && (
                <span className="text-red-500 text-xs mt-1 ml-1">{errors.email}</span>
              )}
            </div>

            {/* Phone Number */}
            <div className="flex flex-col gap-2">
              <label className="text-[#1E1E1E] font-medium text-sm md:text-base ml-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <CountryCodeSelect
                  value={phoneCountryCode}
                  onChange={(code) => {
                    const maxLength = getPhoneMaxLength(code);
                    setPhoneCountryCode(code);
                    const nextPhone = sanitizePhoneDigits(phone, maxLength);
                    setPhone(nextPhone);
                    setErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  className="!bg-[#E6E6E6] !border-transparent rounded-full !py-3 sm:!py-3.5 !h-auto text-[#515151] shrink-0"
                />
                <div className="relative flex items-center flex-1">
                  <Phone className="absolute left-4 w-4 h-4 text-[#515151]" />
                  <input
                    type="tel"
                    placeholder="Enter your Phone Number"
                    value={phone}
                    onChange={(e) => {
                      const maxLength = getPhoneMaxLength(phoneCountryCode);
                      setPhone(sanitizePhoneDigits(e.target.value, maxLength));
                      setErrors((prev) => ({ ...prev, phone: "" }));
                    }}
                    className={`w-full bg-[#E6E6E6] text-[#515151] placeholder:text-[#9CA3AF] text-[16px] sm:text-sm md:text-base rounded-full py-3 sm:py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 transition-all ${
                      errors.phone ? "border border-red-500 focus:ring-red-500" : "border border-transparent focus:ring-[#2C62B9]"
                    }`}
                  />
                </div>
              </div>
              {errors.phone && (
                <span className="text-red-500 text-xs mt-1 ml-1">{errors.phone}</span>
              )}
            </div>

            {/* Store Type */}
            <div className="flex flex-col gap-2">
              <label className="text-[#1E1E1E] font-medium text-sm md:text-base ml-1">
                Store Type <span className="text-red-500">*</span>
              </label>
              <div className={errors.storeType ? "rounded-full border border-red-500" : ""}>
                <CustomSelect
                  options={STORE_TYPE_OPTIONS}
                  value={storeType}
                  onChange={(val) => {
                    setStoreType(val);
                    setErrors((prev) => ({ ...prev, storeType: "" }));
                  }}
                  placeholder="Select Store Type"
                  icon={Store}
                />
              </div>
              {errors.storeType && (
                <span className="text-red-500 text-xs mt-1 ml-1">{errors.storeType}</span>
              )}
            </div>

            {/* Interested In */}
            <div className="flex flex-col gap-2">
              <label className="text-[#1E1E1E] font-medium text-sm md:text-base ml-1">
                What are you interested in? <span className="text-red-500">*</span>
              </label>
              <div className={errors.interest ? "rounded-full border border-red-500" : ""}>
                <CustomSelect
                  options={INTEREST_OPTIONS}
                  value={interest}
                  onChange={(val) => {
                    setInterest(val);
                    setErrors((prev) => ({ ...prev, interest: "" }));
                  }}
                  placeholder="Select Interest"
                />
              </div>
              {errors.interest && (
                <span className="text-red-500 text-xs mt-1 ml-1">{errors.interest}</span>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#2C62B9] hover:bg-[#234d94] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-[16px] sm:text-sm md:text-base py-3 sm:py-3.5 px-8 md:px-10 rounded-full transition-colors min-h-touch"
            >
              {loading ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </motion.form>
      </div>
    </section>
  );
}
