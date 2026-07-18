'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchMyPlan } from '@/redux/slices/retailer/billing/myPlanSlice';
import { toast } from 'react-toastify';

import VerifyEmailModal from './VerifyEmailModal';
import OtpSentModal from './OtpSentModal';
import OtpVerificationModal from './OtpVerificationModal';
import CancelSubscriptionModal from './CancelSubscriptionModal';

interface SubscriptionCancellationFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpgradePlan: (isDowngrade?: boolean) => void;
  userEmail?: string;
}

type FlowStep = 'verify' | 'sent' | 'otp' | 'cancel' | null;

export default function SubscriptionCancellationFlow({
  isOpen,
  onClose,
  onOpenUpgradePlan,
  userEmail = '',
}: SubscriptionCancellationFlowProps) {
  const [step, setStep] = useState<FlowStep>('verify');
  const [email, setEmail] = useState('');
  const [otpSentMessage, setOtpSentMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatch = useAppDispatch();

  
  const { plan: myPlan } = useAppSelector((state) => state.retailerMyPlan);
  const nextBillingDateVal = myPlan?.end_date 
    ? new Date(myPlan.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'August 12, 2026';

  if (!isOpen || !step || typeof document === 'undefined') return null;

  const handleClose = () => {
    setStep('verify');
    setOtpSentMessage('');
    onClose();
  };

  const handleCancelClicked = () => {
    setStep('verify');
  };

  const handleEmailSubmitted = (submittedEmail: string, message?: string) => {
    setEmail(submittedEmail);
    setOtpSentMessage(message || 'If the email is registered, an OTP has been sent.');
    setStep('sent');
  };

  const handleOtpSubmitted = async (otp: string) => {
    setLoading(true);
    // Simulate verifying OTP static flow
    setTimeout(() => {
      setLoading(false);
      setStep('cancel');
    }, 800);
  };

  const handleConfirmCancel = async () => {
    dispatch(fetchMyPlan());
    handleClose();
  };

  const handleDowngrade = () => {
    // Open the upgrade/downgrade plan modal
    onOpenUpgradePlan(true);
  };

  const handlePause = () => {
    toast.success('Your pause request has been registered.');
    handleClose();
  };

  return createPortal(
    <>
      {/* Step 1: Verify Yourself input */}
      <VerifyEmailModal
        isOpen={step === 'verify'}
        onClose={handleClose}
        onContinue={handleEmailSubmitted}
        userEmail={userEmail}
      />

      {/* Step 3: Success state - OTP Sent */}
      <OtpSentModal
        isOpen={step === 'sent'}
        onContinue={() => setStep('otp')}
        message={otpSentMessage}
      />

      {/* Step 4: Enter Verification Code */}
      <OtpVerificationModal
        isOpen={step === 'otp'}
        onClose={handleClose}
        onSubmit={handleOtpSubmitted}
        email={email}
      />

      {/* Step 5 & 6: Pause/Downgrade Offer followed by warning checklist */}
      <CancelSubscriptionModal
        isOpen={step === 'cancel'}
        onClose={handleClose}
        onConfirmCancel={handleConfirmCancel}
        onDowngrade={handleDowngrade}
        onPause={handlePause}
        nextBillingDate={nextBillingDateVal}
      />

      {/* Loading Overlay spinner */}
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 backdrop-blur-xs">
          <div className="w-12 h-12 border-4 border-[#2F68C5] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </>,
    document.body
  );
}

