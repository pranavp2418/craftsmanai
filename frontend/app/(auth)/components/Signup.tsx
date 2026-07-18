'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Mail, Tablet, Check } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  signupUser,
  resetSignup,
  setEmail as setEmailRedux,
  verifyOtp,
  resetOtpState,
} from '@/redux/slices/signup/signupSlice';
import { resendOtp } from '@/redux/slices/signup/resendOtpSlice';
import CountryCodeSelect from '@/src/utils/components/CountryCodeSelect';
import { isValidEmail, sanitizePhoneDigits, getPhoneMaxLength, getPhoneLengthMessage } from '@/lib/formValidation';

type Step = 'signup' | 'otp' | 'success';

interface Props {
  onSwitchToLogin: () => void;
  onHeaderChange?: (meta: { title: string; subtitle: string }) => void;
}

export default function Signup({ onSwitchToLogin, onHeaderChange }: Props) {
  const dispatch = useAppDispatch();
  const { loading, error, success, otpLoading, otpVerified, otpError } = useAppSelector(
    (state) => state.signup,
  );
  const { loading: resendLoading } = useAppSelector((state) => state.resendOtp);

  const [step, setStep] = useState<Step>('signup');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ businessName: '', email: '', password: '', whatsappNumber: '', rememberMe: false });
  const [countryCode, setCountryCode] = useState('+1');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(resetSignup());
    dispatch(resetOtpState());
    setErrors({});
  }, [dispatch]);

  useEffect(() => {
    setErrors({});
  }, [step]);

  useEffect(() => {
    if (step !== 'otp') return;
    if (countdown === 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, step]);

  useEffect(() => {
    if (success) {
      dispatch(setEmailRedux(formData.email));
      setStep('otp'); setCountdown(60); setCanResend(false);
      setOtp(['', '', '', '', '', '']); dispatch(resetSignup());
    }
  }, [success, dispatch, formData.email]);

  useEffect(() => {
    if (error) { dispatch(resetSignup()); }
  }, [error, dispatch]);

  useEffect(() => {
    if (otpVerified) { setStep('success'); dispatch(resetOtpState()); }
  }, [otpVerified, dispatch]);

  useEffect(() => {
    if (otpError) { dispatch(resetOtpState()); }
  }, [otpError, dispatch]);

  useEffect(() => {
    if (!onHeaderChange) return;
    if (step === 'signup') { onHeaderChange({ title: 'Welcome user', subtitle: 'enter your credentials to sign into your dashboard!' }); return; }
    if (step === 'otp') { onHeaderChange({ title: 'Enter OTP', subtitle: `Enter 6-digit code sent to ${formData.email || 'lorem666@gmail.com'}` }); return; }
    onHeaderChange({ title: 'OTP Verified', subtitle: 'Your OTP has been verified successfully.' });
  }, [step, formData.email, onHeaderChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    const businessName = formData.businessName.trim();
    const email = formData.email.trim();
    const password = formData.password.trim();
    const whatsappDigits = formData.whatsappNumber.replace(/\D/g, '');

    if (!businessName) {
      errs.businessName = 'Business name is required';
    }
    if (!email) {
      errs.email = 'Email address is required';
    } else if (!isValidEmail(email)) {
      errs.email = 'Please enter a valid email address';
    }
    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters long';
    }
    const maxLen = getPhoneMaxLength(countryCode);
    if (!whatsappDigits) {
      errs.whatsappNumber = 'WhatsApp number is required';
    } else if (whatsappDigits.length !== maxLen) {
      errs.whatsappNumber = getPhoneLengthMessage(countryCode);
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    dispatch(signupUser({
      business_name: businessName,
      email,
      password,
      whatsapp_number: `${countryCode}${whatsappDigits}`,
      remember_me: formData.rememberMe,
    }));
  };

  const handleCountryCodeChange = (code: string) => {
    const maxLen = getPhoneMaxLength(code);
    setCountryCode(code);
    const nextPhone = sanitizePhoneDigits(formData.whatsappNumber, maxLen);
    setFormData((prev) => ({ ...prev, whatsappNumber: nextPhone }));
    if (nextPhone && nextPhone.length !== maxLen) {
      setErrors((prev) => ({ ...prev, whatsappNumber: getPhoneLengthMessage(code) }));
    } else {
      setErrors((prev) => ({ ...prev, whatsappNumber: '' }));
    }
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    setErrors((prev) => ({ ...prev, otp: '' }));

    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, 6 - i).split('');
      if (digits.length === 0) return;

      const next = [...otp];
      digits.forEach((digit, offset) => {
        next[i + offset] = digit;
      });
      setOtp(next);
      const nextIndex = Math.min(i + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    const next = [...otp]; next[i] = val; setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpPaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6 - i);
    if (!pasted) return;

    e.preventDefault();
    setErrors((prev) => ({ ...prev, otp: '' }));
    const next = [...otp];
    pasted.split('').forEach((digit, offset) => {
      next[i + offset] = digit;
    });
    setOtp(next);
    const nextIndex = Math.min(i + pasted.length, 5);
    otpRefs.current[nextIndex]?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
      setErrors((prev) => ({ ...prev, otp: '' }));
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setErrors({ otp: 'Please enter a valid 6-digit OTP' });
      return;
    }
    dispatch(verifyOtp({ email: formData.email, otp: otpValue, remember_me: formData.rememberMe }));
  };

  const handleResendOtp = () => {
    dispatch(resendOtp({ email: formData.email }));
    setCountdown(60); setCanResend(false); setOtp(['', '', '', '', '', '']);
    setErrors({});
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Shared class tokens
  const inputCls = 'h-9 w-full rounded-[0.625rem] border border-[#D5D5D5] bg-[#F0F2F4] p-3 pr-10 text-[0.8125rem] text-[#1E1E1E] placeholder:text-[#A2A7AF] focus:border-[#3676E0] focus:outline-none dark:border-[#2E3A52] dark:bg-[#1E2535] dark:text-[#E4E9F0] dark:placeholder:text-[#4A5268] dark:focus:border-[#5B9BFF] lg:h-10 lg:text-[0.875rem]';
  const labelCls = 'mb-1 block text-base text-[#1E1E1E] dark:text-[#C8CDD8]';
  const iconCls = 'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A] dark:text-[#5A6A7E]';

  /* ────────── Step 1: Signup form ────────── */
  if (step === 'signup') return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-2.5 lg:space-y-2">
        <div>
          <label htmlFor="su-business" className={labelCls}>Business Name <span className="text-[#EF4444]">*</span></label>
          <div className="relative">
            <input
              id="su-business"
              type="text"
              placeholder="Enter your business name"
              value={formData.businessName}
              onChange={(e) => {
                setFormData({ ...formData, businessName: e.target.value.trimStart().replace(/\s{2,}/g, ' ') });
                setErrors((prev) => ({ ...prev, businessName: '' }));
              }}
              onBlur={() => setFormData({ ...formData, businessName: formData.businessName.trim() })}
              className={`${inputCls} ${errors.businessName ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}`}
            />
            <svg className={iconCls} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16.6665 5.83333H13.3332V4.16667L11.6665 2.5H8.33317L6.6665 4.16667V5.83333H3.33317C2.4165 5.83333 1.6665 6.58333 1.6665 7.5V11.6667C1.6665 12.2917 1.99984 12.8167 2.49984 13.1083V15.8333C2.49984 16.7583 3.2415 17.5 4.1665 17.5H15.8332C16.7582 17.5 17.4998 16.7583 17.4998 15.8333V13.1C17.9915 12.8083 18.3332 12.275 18.3332 11.6667V7.5C18.3332 6.58333 17.5832 5.83333 16.6665 5.83333ZM8.33317 4.16667H11.6665V5.83333H8.33317V4.16667ZM3.33317 7.5H16.6665V11.6667H12.4998V9.16667H7.49984V11.6667H3.33317V7.5ZM10.8332 12.5H9.1665V10.8333H10.8332V12.5ZM15.8332 15.8333H4.1665V13.3333H7.49984V14.1667H12.4998V13.3333H15.8332V15.8333Z" fill="currentColor"/>
            </svg>
          </div>
          {errors.businessName && (
            <p className="text-[0.75rem] text-[#EF4444] mt-1">{errors.businessName}</p>
          )}
        </div>

        <div>
          <label htmlFor="su-email" className={labelCls}>Email Address <span className="text-[#EF4444]">*</span></label>
          <div className="relative">
            <input
              id="su-email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value.replace(/\s/g, '') });
                setErrors((prev) => ({ ...prev, email: '' }));
              }}
              className={`${inputCls} ${errors.email ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}`}
            />
            <Mail className={iconCls} />
          </div>
          {errors.email && (
            <p className="text-[0.75rem] text-[#EF4444] mt-1">{errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="su-password" className={labelCls}>Password <span className="text-[#EF4444]">*</span></label>
          <div className="relative">
            <input
              id="su-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value.replace(/\s/g, '') });
                setErrors((prev) => ({ ...prev, password: '' }));
              }}
              className={`${inputCls} ${errors.password ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}`}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#8A8A8A] hover:text-[#8A8A8A] dark:text-[#5A6A7E]">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-[0.75rem] text-[#EF4444] mt-1">{errors.password}</p>
          )}
        </div>

        <div>
          <label htmlFor="su-whatsapp" className={labelCls}>Phone Number <span className="text-[#EF4444]">*</span></label>
          <div className="flex gap-2">
            <CountryCodeSelect
              value={countryCode}
              onChange={handleCountryCodeChange}
              className=""
              preferredPlacement="top"
              theme="auth"
            />
            <div className="relative flex-1">
              <input
                id="su-whatsapp" type="tel" autoComplete="tel" placeholder="Enter your WhatsApp number"
                value={formData.whatsappNumber}
                onChange={(e) => {
                  setFormData({ ...formData, whatsappNumber: sanitizePhoneDigits(e.target.value, getPhoneMaxLength(countryCode)) });
                  setErrors((prev) => ({ ...prev, whatsappNumber: '' }));
                }}
                className={`${inputCls} ${errors.whatsappNumber ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}`}
                inputMode="numeric"
                maxLength={getPhoneMaxLength(countryCode)}
              />
              <Tablet className={iconCls} />
            </div>
          </div>
          {errors.whatsappNumber && (
            <p className="text-[0.75rem] text-[#EF4444] mt-1">{errors.whatsappNumber}</p>
          )}
        </div>

        <div className="flex items-center">
          <input id="remember" type="checkbox" checked={formData.rememberMe} onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })} className="sr-only" />
          <label htmlFor="remember" className="inline-flex cursor-pointer select-none items-center">
            <span className="flex h-4 w-4 items-center justify-center overflow-hidden rounded border border-[#515151] bg-transparent p-0 dark:border-[#4A5268]">
              {formData.rememberMe && (
                <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full bg-white p-px text-[#3676E0] dark:bg-[#1E2535]">
                  <path d="M1 5L4 8L11 1" stroke="#3676E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="ml-2 text-base text-gray-700 dark:text-gray-400">Remember Me</span>
          </label>
        </div>

        <button type="submit" disabled={loading}
          className="mt-4 w-full cursor-pointer rounded-full bg-[#3676E0] py-2 text-[0.8125rem] font-medium tracking-wider text-white dark:text-black dark:bg-[#60A5FA] transition-colors hover:bg-[#2A66CA] disabled:cursor-not-allowed disabled:opacity-50 lg:!mt-6 lg:py-2.5 lg:text-[0.875rem]">
          {loading ? 'Signing up...' : 'Sign up'}
        </button>
      </form>
    </div>
  );

  /* ────────── Step 2: OTP ────────── */
  if (step === 'otp') return (
    <div className="w-full">
      <form onSubmit={handleOtpSubmit} className="space-y-3 lg:space-y-2.5">
        <p className="mb-4 text-center text-[0.8125rem] text-[#4B535F] dark:text-[#8A94A6] lg:text-base">Enter code here</p>

        <div className="flex justify-center gap-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { otpRefs.current[i] = el; }}
              type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={1} value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onPaste={(e) => handleOtpPaste(i, e)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              className={`h-9 w-9 rounded-lg border bg-[#F0F2F4] p-3 text-center text-[0.8125rem] font-semibold text-[#1E1E1E] focus:outline-none dark:bg-[#1E2535] dark:text-[#E4E9F0] lg:h-10 lg:w-10 lg:text-[0.875rem] ${errors.otp ? 'border-[#EF4444] focus:border-[#EF4444]' : 'border-[#D5D5D5] focus:border-[#3676E0] dark:border-[#2E3A52] dark:focus:border-[#5B9BFF]'}`}
            />
          ))}
        </div>
        {errors.otp && (
          <p className="text-[0.75rem] text-[#EF4444] text-center mt-2">{errors.otp}</p>
        )}

        <button type="submit" disabled={otpLoading}
          className="mt-3 w-full cursor-pointer rounded-full bg-[#3676E0] dark:bg-[#60A5FA] py-2 text-[0.8125rem] font-medium text-white dark:text-black transition-colors hover:bg-[#2A66CA] disabled:cursor-not-allowed disabled:opacity-50 lg:py-2.5 lg:text-sm">
          {otpLoading ? 'Verifying...' : 'Submit'}
        </button>

        <div className="text-center">
          {canResend ? (
            <button type="button" onClick={handleResendOtp} disabled={resendLoading}
              className="cursor-pointer text-[0.8125rem] font-medium text-[#3676E0] hover:underline disabled:cursor-not-allowed disabled:opacity-50 lg:text-base">
              {resendLoading ? 'Resending...' : 'Resend link'}
            </button>
          ) : (
            <p className="text-[0.8125rem] text-[#7A7A7A] dark:text-[#8A94A6] lg:text-base">
              Resend link in <span className="font-medium text-[#3676E0]">{formatTime(countdown)}</span>
            </p>
          )}
        </div>
      </form>
    </div>
  );

  /* ────────── Step 3: Success ────────── */
  return (
    <div className="w-full py-2 text-center">
      <p className="mb-3 text-[0.8125rem] text-[#1E1E1E] tracking-wide dark:text-[#E4E9F0] lg:text-base">OTP submitted successfully</p>

      <div className="mb-4 flex justify-center lg:mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1D8C1D] bg-[#DCFCE7] dark:bg-[#0F2A1A] lg:h-12 lg:w-12">
          <Check className="h-5 w-5 text-[#1D8C1D] lg:h-7 lg:w-7" strokeWidth={1.8} />
        </div>
      </div>

      <Link href="/retailer"
        className="inline-block w-full rounded-full bg-[#3676E0] py-2 text-center text-[0.8125rem] font-medium tracking-wider text-white transition-colors hover:bg-[#2A66CA] lg:py-2.5 lg:text-sm">
        Go to dashboard
      </Link>
    </div>
  );
}
