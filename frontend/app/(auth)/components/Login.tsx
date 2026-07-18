'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { loginUser, resetLogin, resetLoginStatus } from '@/redux/slices/login/loginSlice';
import { requestPasswordReset, resetRequestState } from '@/redux/slices/forgotPassword/resetRequestSlice';
import { verifyResetPasswordOtp, resetOtpVerifyState } from '@/redux/slices/forgotPassword/otpVerify';
import { confirmPasswordReset, resetPasswordState } from '@/redux/slices/forgotPassword/resetPasswordSlice';
import { verifyOtp, resetSignup } from '@/redux/slices/signup/signupSlice';
import { isValidEmail } from '@/lib/formValidation';

type LoginView = 'login' | 'forgot' | 'otp' | 'otp-verified' | 'reset-password' | 'completed';

interface Props {
  onSwitchToSignup: () => void;
  onHeaderChange?: (meta: { title: string; subtitle: string }) => void;
}

export default function Login({ onHeaderChange }: Props) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { loading: loginLoading, success: loginSuccess, error: loginError, user, twoFactorRequired } = useAppSelector(
    (state) => state.login,
  );
  const { loading: resetRequestLoading, success: resetRequestSuccess } = useAppSelector(
    (state) => state.resetRequest,
  );
  const { loading: otpVerifyLoading, success: otpVerifySuccess, resetToken } = useAppSelector(
    (state) => state.otpVerify,
  );
  const { loading: resetPasswordLoading, success: resetPasswordSuccess } = useAppSelector(
    (state) => state.resetPassword,
  );
  const { otpVerified, otpLoading } = useAppSelector(
    (state) => state.signup,
  );
  const { profileItem } = useAppSelector(
    (state) => state.retailerProfile,
  );

  const [view, setView] = useState<LoginView>('login');
  const [is2FA, setIs2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(58);
  const [canResend, setCanResend] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setErrors({});
  }, [view]);

  useEffect(() => {
    if (!onHeaderChange) return;

    if (view === 'login') {
      onHeaderChange({ title: 'Welcome back', subtitle: 'enter your credentials to log into your dashboard!' });
      return;
    }
    if (view === 'forgot') {
      onHeaderChange({ title: 'Forget Password?', subtitle: 'enter your credentials to reset password of your account.' });
      return;
    }
    if (view === 'otp') {
      onHeaderChange({ title: 'Enter OTP', subtitle: `Enter 6-digit code sent to ${forgotEmail || 'lorem666@gmail.com'}` });
      return;
    }
    if (view === 'otp-verified') {
      onHeaderChange({ title: 'OTP Verified', subtitle: 'Your OTP has been verified successfully.' });
      return;
    }
    if (view === 'reset-password') {
      onHeaderChange({ title: 'Reset Password', subtitle: 'enter your credentials to reset password of your account.' });
      return;
    }
    onHeaderChange({ title: 'Completed!', subtitle: 'Your new password has been updated, return to login again.' });
  }, [view, forgotEmail, onHeaderChange]);

  useEffect(() => {
    if (view !== 'otp') return;
    if (countdown === 0) { setCanResend(true); return; }
    const t = window.setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, view]);

  useEffect(() => {
    if (loginSuccess && user) {
      dispatch(resetLoginStatus());
      router.push(user.is_superuser ? '/admin/dashboard' : '/retailer');
    }
  }, [loginSuccess, user, dispatch, router]);

  useEffect(() => {
    if (loginError) { dispatch(resetLogin()); }
  }, [loginError, dispatch]);

  useEffect(() => {
    if (twoFactorRequired) {
      setIs2FA(true);
      setForgotEmail(email);
      setOtp(['', '', '', '', '', '']);
      setView('otp');
      dispatch(resetLoginStatus());
    }
  }, [twoFactorRequired, email, dispatch]);

  useEffect(() => {
    if (otpVerified && is2FA) {
      setView('otp-verified');
      dispatch(resetSignup());
    }
  }, [otpVerified, is2FA, dispatch]);

  useEffect(() => {
    if (view === 'otp-verified' && is2FA && profileItem) {
      const timer = setTimeout(() => {
        router.push(profileItem.is_superuser ? '/admin/dashboard' : '/retailer');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [view, is2FA, profileItem, router]);

  useEffect(() => {
    if (!resetRequestSuccess) return;
    setOtp(['', '', '', '', '', '']); setCountdown(58); setCanResend(false);
    setView('otp'); dispatch(resetRequestState());
  }, [resetRequestSuccess, dispatch]);

  useEffect(() => {
    if (!otpVerifySuccess) return;
    setView('otp-verified');
  }, [otpVerifySuccess]);

  useEffect(() => {
    if (!resetPasswordSuccess) return;
    setView('completed'); setNewPassword(''); setConfirmPassword('');
    dispatch(resetOtpVerifyState());
    dispatch(resetPasswordState());
  }, [resetPasswordSuccess, dispatch]);

  const handleLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    const emailValue = email.trim();
    const passwordValue = password.trim();
    if (!emailValue) {
      errs.email = 'Email address is required';
    } else if (!isValidEmail(emailValue)) {
      errs.email = 'Please enter a valid email address';
    }
    if (!passwordValue) {
      errs.password = 'Password is required';
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    dispatch(loginUser({ email: emailValue, password: passwordValue, remember_me: rememberMe }));
  };

  const handleForgotContinue = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    const emailValue = forgotEmail.trim();
    if (!emailValue) {
      errs.forgotEmail = 'Email address is required';
    } else if (!isValidEmail(emailValue)) {
      errs.forgotEmail = 'Please enter a valid email address';
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    dispatch(resetOtpVerifyState());
    dispatch(requestPasswordReset({ email: emailValue }));
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setErrors((prev) => ({ ...prev, otp: '' }));

    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6 - index).split('');
      if (digits.length === 0) return;

      const next = [...otp];
      digits.forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      setOtp(next);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    const next = [...otp]; next[index] = value; setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6 - index);
    if (!pasted) return;

    e.preventDefault();
    setErrors((prev) => ({ ...prev, otp: '' }));
    const next = [...otp];
    pasted.split('').forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    setOtp(next);
    const nextIndex = Math.min(index + pasted.length, 5);
    otpRefs.current[nextIndex]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      setErrors((prev) => ({ ...prev, otp: '' }));
    }
  };

  const handleOtpSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setErrors({ otp: 'Please enter a valid 6-digit OTP' });
      return;
    }
    if (is2FA) {
      dispatch(verifyOtp({ email: forgotEmail, otp: otpValue, remember_me: rememberMe, otp_type: 'login_2fa' }));
    } else {
      dispatch(verifyResetPasswordOtp({ email: forgotEmail, otp: otpValue }));
    }
  };

  const handleResend = () => {
    const emailValue = forgotEmail.trim();
    if (!isValidEmail(emailValue)) {
      setErrors({ forgotEmail: 'Please enter a valid email address' });
      setView('forgot');
      return;
    }
    dispatch(requestPasswordReset({ email: emailValue }));
    setOtp(['', '', '', '', '', '']); setCountdown(58); setCanResend(false);
  };

  const handleResetPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    const emailValue = forgotEmail.trim();
    if (!isValidEmail(emailValue)) {
      errs.email = 'Please enter a valid email address';
    }
    if (newPassword.length < 8) {
      errs.newPassword = 'Password must be at least 8 characters long';
    }
    if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (!resetToken) {
      toast.error('Reset token not found. Please restart the process.');
      setView('forgot');
      return;
    }
    dispatch(confirmPasswordReset({ email: emailValue, token: resetToken, new_password: newPassword }));
  };

  const formatTime = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmitReset = newPassword.length >= 8 && passwordsMatch;

  // ── Shared class tokens ──────────────────────────────────────────────────────
  const inputCls = 'h-9 w-full rounded-[0.625rem] border border-[#D5D5D5] bg-[#F0F2F4] p-3 pr-10 text-[0.8125rem] text-[#1E1E1E] placeholder:text-[#A2A7AF] focus:border-[#3676E0] focus:outline-none dark:border-[#2E3A52] dark:bg-[#1E2535] dark:text-[#E4E9F0] dark:placeholder:text-[#4A5268] dark:focus:border-[#5B9BFF] lg:h-10 lg:text-[0.875rem]';
  const labelCls = 'mb-1 block text-base text-[#1E1E1E] dark:text-[#C8CDD8]';
  const iconCls  = 'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A] dark:text-[#5A6A7E]';
  const primaryBtn = 'mt-4 w-full cursor-pointer rounded-full bg-[#3676E0] py-2 text-[0.8125rem] font-medium tracking-wider text-white dark:text-black dark:bg-[#60A5FA] transition-colors hover:bg-[#2A66CA] disabled:cursor-not-allowed disabled:opacity-50 lg:mt-6 lg:py-2.5 lg:text-[0.875rem]';
  const secondaryBtn = 'w-full cursor-pointer rounded-full border border-[#DFE4ED] bg-[#F4F6F8] py-2 text-[0.8125rem] font-medium text-[#3676E0] transition-colors hover:bg-[#EEF2FA] dark:border-[#2E3A52] dark:bg-[#1E2535] dark:text-[#5B9BFF] dark:hover:bg-[#252D3D] lg:py-2.5 lg:text-[0.875rem]';
  // ────────────────────────────────────────────────────────────────────────────

  if (view === 'login') {
    return (
      <div className="w-full">
        <form onSubmit={handleLoginSubmit} className="space-y-2.5 lg:space-y-2">
          <div>
            <label htmlFor="login-email" className={labelCls}>Email Address <span className="text-[#EF4444]">*</span></label>
            <div className="relative">
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value.replace(/\s/g, ''));
                  setErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="Enter your email address"
                className={`${inputCls} ${errors.email ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}`}
              />
              <Mail className={iconCls} />
            </div>
            {errors.email && (
              <p className="text-[0.75rem] text-[#EF4444] mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className={labelCls}>Password <span className="text-[#EF4444]">*</span></label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value.replace(/\s/g, ''));
                  setErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Enter your password"
                className={`${inputCls} ${errors.password ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}`}
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#8A8A8A] dark:text-[#5A6A7E] hover:text-[#8A8A8A]">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[0.75rem] text-[#EF4444] mt-1">{errors.password}</p>
            )}
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center">
              <input id="remember" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="sr-only" />
              <label htmlFor="remember" className="inline-flex cursor-pointer select-none items-center">
                <span className="flex h-4 w-4 items-center justify-center overflow-hidden rounded border border-[#515151] bg-transparent p-0 dark:border-[#4A5268]">
                  {rememberMe && (
                    <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full bg-white p-px text-[#3676E0] dark:bg-[#1E2535]">
                      <path d="M1 5L4 8L11 1" stroke="#3676E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="ml-2 text-base text-gray-700 dark:text-gray-400">Remember Me</span>
              </label>
            </div>
            <button type="button" onClick={() => { setForgotEmail(email); setView('forgot'); }} className="cursor-pointer text-sm text-[#2E3340] hover:underline dark:text-[#8A94A6]">
              Forget password?
            </button>
          </div>

          <button type="submit" disabled={loginLoading} className={`${primaryBtn} !mt-8`}>
            {loginLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <div className="w-full">
        <form onSubmit={handleForgotContinue} className="space-y-3 lg:space-y-2.5">
          <div>
            <label htmlFor="forgot-email" className={labelCls}>Registered Email Address <span className="text-[#EF4444]">*</span></label>
            <div className="relative">
               <input
                 id="forgot-email"
                 type="email"
                 autoComplete="email"
                 value={forgotEmail}
                 onChange={(e) => {
                   setForgotEmail(e.target.value.replace(/\s/g, ''));
                   setErrors((prev) => ({ ...prev, forgotEmail: '' }));
                 }}
                 placeholder="Enter your email address"
                 className={`${inputCls} ${errors.forgotEmail ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}`}
               />
              <Mail className={iconCls} />
            </div>
            {errors.forgotEmail && (
              <p className="text-[0.75rem] text-[#EF4444] mt-1">{errors.forgotEmail}</p>
            )}
          </div>

          <button type="submit" disabled={resetRequestLoading} className={primaryBtn}>
            {resetRequestLoading ? 'Sending...' : 'Send OTP'}
          </button>

          <button type="button" onClick={() => setView('login')} className={`${secondaryBtn} backdrop-blur-xl`}>
            Return to Log In
          </button>

          <p className="mt-2 pt-1 text-center text-[0.75rem] text-[#7A7A7A] dark:text-[#8A94A6] lg:text-sm">
            Need additional help?{' '}
            <a href="/#contact-us" className="font-medium text-[#3676E0] hover:underline">Contact Support</a>
          </p>
        </form>
      </div>
    );
  }

  if (view === 'otp') {
    return (
      <div className="w-full">
        <form onSubmit={handleOtpSubmit} className="space-y-3 lg:space-y-2.5">
          <p className="mb-1 text-center text-[0.8125rem] text-[#4B535F] dark:text-[#8A94A6] lg:text-base">Enter code here</p>

          <div className="mb-4 text-center text-xs text-[#7A7A7A] dark:text-[#8A94A6]">
            Enter 6-digit code sent to <span className="font-semibold text-[#1E1E1E] dark:text-[#E4E9F0]">{forgotEmail}</span>{' '}
            <button type="button" onClick={() => setView('forgot')} className="cursor-pointer font-medium text-[#3676E0] hover:underline">Change</button>
          </div>

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

          <button type="submit" disabled={is2FA ? otpLoading : otpVerifyLoading} className="mt-3 w-full cursor-pointer rounded-full bg-[#3676E0] py-2 text-[0.8125rem] font-medium text-white dark:text-black dark:bg-[#60A5FA] transition-colors hover:bg-[#2A66CA] disabled:cursor-not-allowed disabled:opacity-50 lg:py-2.5 lg:text-sm">
            {is2FA ? (otpLoading ? 'Verifying...' : 'Submit') : (otpVerifyLoading ? 'Verifying...' : 'Submit')}
          </button>

          <div className="text-center">
            {canResend ? (
              <button type="button" onClick={handleResend} disabled={resetRequestLoading} className="cursor-pointer text-[0.8125rem] font-medium text-[#3676E0] hover:underline disabled:cursor-not-allowed disabled:opacity-50 lg:text-base">
                {resetRequestLoading ? 'Resending...' : 'Resend OTP'}
              </button>
            ) : (
              <p className="text-[0.8125rem] text-[#7A7A7A] dark:text-[#8A94A6] lg:text-base">
                Resend OTP in <span className="font-medium text-[#3676E0]">{formatTime(countdown)}</span>
              </p>
            )}
          </div>
        </form>
      </div>
    );
  }

  if (view === 'otp-verified') {
    return (
      <div className="w-full py-2 text-center">
        <p className="mb-3 text-[0.8125rem] text-[#1E1E1E] tracking-wide dark:text-[#E4E9F0] lg:text-base">OTP submitted successfully</p>
        <div className="mb-4 flex justify-center lg:mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1D8C1D] bg-[#DCFCE7] dark:bg-[#0F2A1A] lg:h-12 lg:w-12">
            <Check className="h-5 w-5 text-[#1D8C1D] lg:h-7 lg:w-7" strokeWidth={1.8} />
          </div>
        </div>
        {is2FA ? (
          <button
            type="button"
            onClick={() => {
              if (profileItem) {
                router.push(profileItem.is_superuser ? '/admin/dashboard' : '/retailer');
              }
            }}
            className="w-full cursor-pointer rounded-full bg-[#3676E0] py-2 text-[0.8125rem] font-medium tracking-wider text-white transition-colors dark:text-black dark:bg-[#60A5FA] hover:bg-[#2A66CA] lg:py-2.5 lg:text-sm"
          >
            Go to Dashboard
          </button>
        ) : (
          <button type="button" onClick={() => setView('reset-password')} className="w-full cursor-pointer rounded-full bg-[#3676E0] dark:text-black dark:bg-[#60A5FA] py-2 text-[0.8125rem] font-medium tracking-wider text-white transition-colors hover:bg-[#2A66CA] lg:py-2.5 lg:text-sm">
            Create New Password
          </button>
        )}
      </div>
    );
  }

  if (view === 'reset-password') {
    return (
      <div className="w-full">
        <form onSubmit={handleResetPassword} className="space-y-2.5 lg:space-y-2">
          <div>
            <label htmlFor="new-password" className={labelCls}>New Password <span className="text-[#EF4444]">*</span></label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value.replace(/\s/g, ''));
                  setErrors((prev) => ({ ...prev, newPassword: '', confirmPassword: '' }));
                }}
                placeholder="Enter your new password here"
                className={`${inputCls} ${errors.newPassword ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}`}
              />
              <button type="button" onClick={() => setShowNewPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#8A8A8A] dark:text-[#5A6A7E] hover:text-[#8A8A8A]">
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-[0.75rem] text-[#EF4444] mt-1">{errors.newPassword}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirm-password" className={labelCls}>Re-enter New Password <span className="text-[#EF4444]">*</span></label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value.replace(/\s/g, ''));
                  setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder="Re-enter your new password here"
                className={`${inputCls} ${errors.confirmPassword ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}`}
              />
              <button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#8A8A8A] dark:text-[#5A6A7E] hover:text-[#8A8A8A]">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-[0.75rem] text-[#EF4444] mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <button type="submit" disabled={resetPasswordLoading || !canSubmitReset} className={primaryBtn}>
            {resetPasswordLoading ? 'Submitting...' : 'Submit New Password'}
          </button>

          <button type="button" onClick={() => setView('login')} className={secondaryBtn}>
            Return to Log In
          </button>

          <p className="mt-2 pt-1 text-center text-[0.75rem] text-[#7A7A7A] dark:text-[#8A94A6] lg:text-sm">
            Need additional help?{' '}
            <a href="/#contact-us" className="font-medium text-[#3676E0] hover:underline">Contact Support</a>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full py-2 text-center">
      <p className="mb-3 text-[0.8125rem] text-[#1E1E1E] tracking-wide dark:text-[#E4E9F0] lg:text-base">Password Updated successfully</p>
      <div className="mb-4 flex justify-center lg:mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1D8C1D] bg-[#DCFCE7] dark:bg-[#0F2A1A] lg:h-12 lg:w-12">
          <Check className="h-5 w-5 text-[#1D8C1D] lg:h-7 lg:w-7" strokeWidth={1.8} />
        </div>
      </div>
      <button type="button" onClick={() => setView('login')} className="w-full cursor-pointer rounded-full bg-[#3676E0] py-2 text-[0.8125rem] font-medium tracking-wider text-white dark:text-black dark:bg-[#60A5FA] transition-colors hover:bg-[#2A66CA] lg:py-2.5 lg:text-sm">
        Return to login
      </button>
    </div>
  );
}
