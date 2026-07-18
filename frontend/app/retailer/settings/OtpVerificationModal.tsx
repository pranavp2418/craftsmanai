'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { verifyResetPasswordOtp, resetOtpVerifyState } from '@/redux/slices/forgotPassword/otpVerify';

interface OtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (otp: string) => void;
  email: string;
}

export default function OtpVerificationModal({
  isOpen,
  onClose,
  onSubmit,
  email,
}: OtpVerificationModalProps) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [errorMsg, setErrorMsg] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.otpVerify);

  useEffect(() => {
    if (isOpen) {
      dispatch(resetOtpVerifyState());
      setOtp(Array(6).fill(''));
      setErrorMsg('');
      // Focus first input on open
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  const handleChange = (value: string, index: number) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    
    // Take only the last character entered
    newOtp[index] = cleaned.substring(cleaned.length - 1);
    setOtp(newOtp);

    // Auto focus next input if filled
    if (newOtp[index] && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Focus previous input on backspace if current is empty
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    
    if (pastedData) {
      const newOtp = Array(6).fill('');
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      
      // Focus the last filled input or the first one if empty
      const targetIndex = Math.min(pastedData.length, 5);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length === 6) {
      setErrorMsg('');
      const result = await dispatch(verifyResetPasswordOtp({
        email,
        otp: fullOtp,
        otp_type: 'cancel_plan',
      }));

      if (verifyResetPasswordOtp.fulfilled.match(result)) {
        dispatch(resetOtpVerifyState());
        onSubmit(fullOtp);
      } else if (verifyResetPasswordOtp.rejected.match(result)) {
        setErrorMsg(result.payload || 'Invalid verification code. Please try again.');
      }
    }
  };

  const isComplete = otp.join('').length === 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[480px] rounded-[24px] p-6 sm:p-8 bg-white dark:bg-surface-100 border border-gray-100 dark:border-border-default shadow-xl flex flex-col items-center">
        
        {/* Title */}
        <h3 className="">OTP Verification</h3>
        <p className="text-xs sm:text-sm text-[#6B7280] text-center mb-6">
          enter an OTP sent to your registered mail id
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-6">
          
          {/* OTP inputs container */}
          <div className="flex flex-col items-center w-full">
            <span className="text-sm font-semibold text-[#1F2937] mb-3 dark:text-gray-600">Enter code here</span>
            <div className="flex gap-2 sm:gap-3 justify-center w-full max-w-xs">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  disabled={loading}
                  onChange={(e) => handleChange(e.target.value, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onPaste={handlePaste}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg text-center text-lg font-bold bg-[#E5E7EB]/40 dark:bg-surface-150 text-[#111827] dark:text-[#A1A8B3] border border-transparent dark:border-border-default focus:border-[#2F68C5] dark:focus:border-brand focus:bg-white dark:focus:bg-surface-100 outline-none transition-all ${
                    loading ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  aria-label={`Digit ${idx + 1}`}
                />
              ))}
            </div>
            {errorMsg && (
              <p className="text-xs text-[#EF4444] mt-3 font-medium text-center">{errorMsg}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 w-full mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-[#2F68C5] dark:text-brand border border-[#2F68C5] dark:border-brand hover:bg-gray-50 dark:hover:bg-surface-hover bg-white dark:bg-transparent transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isComplete || loading}
              className={`flex-1 py-3 rounded-full text-sm font-semibold text-white transition-colors text-center shadow-sm flex items-center justify-center gap-2 dark:text-black ${
                isComplete && !loading
                  ? 'bg-[#2F68C5] hover:bg-[#25529C]'
                  : 'bg-gray-300 cursor-not-allowed shadow-none'
              }`}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin dark:text-black"></span>
                  Verifying...
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
