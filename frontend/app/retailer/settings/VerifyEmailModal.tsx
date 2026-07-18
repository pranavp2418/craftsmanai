'use client';
 
import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { sendCancelSubscriptionOtp, resetCancelSubscriptionState } from '@/redux/slices/retailer/billing/cancelSubscriptionSlice';
import { isValidEmail } from '@/lib/formValidation';

interface VerifyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (email: string, message?: string) => void;
  userEmail?: string;
}

export default function VerifyEmailModal({
  isOpen,
  onClose,
  onContinue,
  userEmail = '',
}: VerifyEmailModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const dispatch = useAppDispatch();
  const { sendOtpStatus } = useAppSelector((state) => state.retailerCancelSubscription);

  useEffect(() => {
    if (isOpen) {
      dispatch(resetCancelSubscriptionState());
    }
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email address is required.');
      return;
    }
    // Simple email regex validation
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');

    const result = await dispatch(sendCancelSubscriptionOtp({ email }));
    if (sendCancelSubscriptionOtp.fulfilled.match(result)) {
      dispatch(resetCancelSubscriptionState());
      onContinue(email, result.payload?.message);
    } else if (sendCancelSubscriptionOtp.rejected.match(result)) {
      setError(result.payload || 'Failed to send verification code. Please try again.');
    }
  };

  const isSending = sendOtpStatus === 'loading';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[480px] rounded-[24px] p-6 sm:p-8 bg-white dark:bg-surface-100 border border-gray-100 dark:border-border-default shadow-xl flex flex-col items-center">
        
        {/* Title */}
        <h3 className="text-2xl sm:text-3xl font-bold text-[#111827] dark:text-white text-center mb-1">Verify Yourself</h3>
        <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#A1A8B3] text-center mb-6">
          enter your credentials to cancel your subscription.
        </p>

        <form onSubmit={handleContinue} className="w-full flex flex-col gap-5">
          {/* Email input field */}
          <div className="w-full">
            <label className="block text-sm font-semibold text-[#1F2937] dark:text-[#D1D5DB] mb-2">
              Registered Email Address
            </label>
            <div className="relative w-full">
              <input
                type="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                disabled={isSending}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                className={`w-full pr-10 pl-4 py-3 rounded-xl bg-[#F3F4F6] dark:bg-surface-150 text-sm text-[#111827] dark:text-white placeholder:text-[#9CA3AF] outline-none border transition-all ${
                  error ? 'border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]' : 'border-transparent focus:border-[#2F68C5] dark:focus:border-brand'
                } ${isSending ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 ri-mail-line text-lg text-[#9CA3AF]"></span>
            </div>
            {error && (
              <p className="text-xs text-[#EF4444] mt-1.5 font-medium">{error}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 mt-2">
            <button
              type="submit"
              disabled={isSending}
              className={`w-full py-3 rounded-full text-sm font-semibold text-white bg-[#2F68C5] hover:bg-[#25529C] transition-colors shadow-sm flex items-center justify-center gap-2 dark:text-black ${
                isSending ? 'opacity-60 cursor-not-allowed bg-[#25529C]' : ''
              }`}
            >
              {isSending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Sending...
                </>
              ) : (
                'Continue'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="w-full py-3 rounded-full text-sm font-semibold text-[#2F68C5] dark:text-brand border border-[#2F68C5] dark:border-brand hover:bg-gray-50 dark:hover:bg-surface-hover bg-white dark:bg-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Return To Dashboard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
