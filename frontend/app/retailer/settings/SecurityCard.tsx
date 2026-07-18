'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { changePassword, resetChangePasswordState } from '@/redux/slices/retailer/settings/changePasswordSlice';
import { toggle2FA, fetch2FAStatus } from '@/redux/slices/retailer/settings/toggle2faSlice';
import { fetchSessions } from '@/redux/slices/retailer/settings/sessionsSlice';

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#EF4444' };
  if (score <= 3) return { score, label: 'Fair', color: 'text-warning' };
  if (score === 4) return { score, label: 'Good', color: 'text-brand' };
  return { score, label: 'Strong', color: 'text-success-medium' };
}

const formatSessionDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    // Parse ISO string to extract exact time from API without timezone conversion
    // Format: 2026-07-10T15:43:06.123426-05:00
    const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!dateMatch) return 'N/A';
    
    const [, year, month, day, hourStr, minuteStr] = dateMatch;
    const dayNum = parseInt(day, 10);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(month, 10) - 1];
    const hours = parseInt(hourStr, 10);
    const minutes = minuteStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    
    return `${dayNum} ${monthName} ${year} at ${displayHour}:${minutes} ${ampm}`;
  } catch {
    return 'N/A';
  }
};

export default function SecurityCard() {
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' });
  const [show, setShow] = useState({ current: false, newPw: false, confirm: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [twoFA, setTwoFA] = useState(false);


  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((state) => state.retailerChangePassword);
  const { sessions, status: sessionsStatus } = useAppSelector((state) => state.retailerSessions);
  const { is2FAEnabled } = useAppSelector((state) => state.retailerToggle2FA);

  useEffect(() => {
    dispatch(fetchSessions());
    dispatch(fetch2FAStatus());
  }, [dispatch]);

  useEffect(() => {
    setTwoFA(is2FAEnabled);
  }, [is2FAEnabled]);

  const strength = getStrength(form.newPw);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.current) e.current = 'Current password is required.';
    if (!form.newPw) e.newPw = 'New password is required.';
    else if (form.newPw.length < 8) e.newPw = 'Password must be at least 8 characters.';
    else if (strength.score <= 1) e.newPw = 'Password is too weak.';
    if (!form.confirm) e.confirm = 'Please confirm your new password.';
    else if (form.newPw !== form.confirm) e.confirm = 'Passwords do not match.';
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    
    dispatch(changePassword({
      current_password: form.current,
      new_password: form.newPw,
      confirm_new_password: form.confirm
    }));
  };

  useEffect(() => {
    if (status === 'succeeded') {
      setForm({ current: '', newPw: '', confirm: '' });
      setErrors({});
      toast.success('Password updated successfully');
      dispatch(resetChangePasswordState());
    } else if (status === 'failed') {
      toast.error(error || 'Failed to change password');
      dispatch(resetChangePasswordState());
    }
  }, [status, error, dispatch]);

  const handleToggle2FA = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const next = !twoFA;
    setTwoFA(next);
    try {
      await dispatch(toggle2FA({ enable_2fa: next })).unwrap();
      toast.success(next ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled');
    } catch (err: any) {
      setTwoFA(!next);
      toast.error(err || 'Failed to update Two-Factor Authentication');
    }
  };

  const isDirty = form.current || form.newPw || form.confirm;

  return (
    <div
      className="rounded-sheet p-4 sm:p-6 lg:p-8 shadow-glow-indigo-soft bg-glass-72 backdrop-blur-xl border border-glass-strong">
      <div className="mb-8">
        <h2 className="text-heading font-bold text-ink-900 font-satoshi dark:text-[#E7EAEE]">
          Security
        </h2>
        <p className="text-body-sm text-ink-400 mt-1">Manage your account security and access settings.</p>
      </div>

      <div className="flex flex-col gap-5">

        <div
          className="rounded-2xl p-6 bg-section border border-sand">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-tint-indigo">
              <span className="ri-lock-password-line text-ui-md text-indigo-accent w-4 h-4 flex items-center justify-center"></span>
            </div>
            <div>
              <p className="text-body font-semibold text-ink-900 font-satoshi">Change Password</p>
              <p className="text-label-sm text-ink-400">Use a strong password to keep your account secure.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <PasswordField
              label="Current Password"
              value={form.current}
              show={show.current}
              error={errors.current}
              placeholder="Enter current password"
              onToggle={() => setShow((p) => ({ ...p, current: !p.current }))}
              onChange={(v) => { setForm((p) => ({ ...p, current: v })); setErrors((p) => ({ ...p, current: '' })); }}
            />

            <div>
              <PasswordField
                label="New Password"
                value={form.newPw}
                show={show.newPw}
                error={errors.newPw}
                placeholder="Enter new password"
                onToggle={() => setShow((p) => ({ ...p, newPw: !p.newPw }))}
                onChange={(v) => { setForm((p) => ({ ...p, newPw: v })); setErrors((p) => ({ ...p, newPw: '' })); }}
              />
              {form.newPw && (
                <div className="mt-2.5">
                  <div className="flex gap-1 mb-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full transition-all duration-300 bg-[${i <= strength.score ? strength.color : 'rgba(209,213,219,0.5)'}]`}

                      />
                    ))}
                  </div>
                  <p className={`text-label-xs font-medium ${strength.color}`}>
                    {strength.label} password
                  </p>
                </div>
              )}
            </div>

            <PasswordField
              label="Confirm New Password"
              value={form.confirm}
              show={show.confirm}
              error={errors.confirm}
              placeholder="Re-enter new password"
              onToggle={() => setShow((p) => ({ ...p, confirm: !p.confirm }))}
              onChange={(v) => { setForm((p) => ({ ...p, confirm: v })); setErrors((p) => ({ ...p, confirm: '' })); }}
            />
          </div>
        </div>

        <div
          className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-section border border-sand">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${twoFA ? "bg-tint-emerald" : "bg-tint-indigo"}`}

            >
              <span
                className={`ri-shield-check-line text-heading-xs w-5 h-5 flex items-center justify-center ${twoFA ? 'text-success-medium' : 'text-indigo-accent'}`}

              ></span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-ink-900 font-satoshi truncate">
                Two-Factor Authentication
              </p>
              <p className="text-label text-ink-400 mt-0.5 text-xs sm:text-sm">
                {twoFA ? 'Your account has an extra layer of protection.' : 'Add an extra layer of security to your account.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle2FA}
            className="relative flex-shrink-0 cursor-pointer transition-all duration-200 w-[44px] h-[24px] self-start sm:self-auto"

          >
            <div
              className={`absolute inset-0 rounded-full transition-all duration-300 ${twoFA ? "bg-gradient-success-light" : "bg-muted-bg-70"} ${twoFA ? "shadow-glow-emerald-pill" : "shadow-none"}`}

            />
            <div
              className={`absolute top-[3px] rounded-full bg-white transition-all duration-300 w-[18px] h-[18px] ${twoFA ? "left-[23px]" : "left-[3px]"} shadow-card-tiny`}

            />
          </button>
        </div>

        {sessionsStatus === 'loading' ? (
          <div className="rounded-2xl p-5 flex items-center gap-4 bg-section border border-sand animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
            <div className="flex-1 min-w-0">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ) : sessions && sessions.length > 0 ? (
          sessions.map((session, index) => (
            <div
              key={session?.id ?? index}
              className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-section border border-sand">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-tint-brand">
                  <span className="ri-computer-line text-heading-xs text-brand w-5 h-5 flex items-center justify-center"></span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-ink-900 font-satoshi truncate">
                    Session ID: {session?.id ?? 'N/A'}
                  </p>
                </div>
                <div className={`sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 ${session?.is_revoked ? 'bg-red-50 dark:bg-red-900/20' : 'bg-tint-emerald'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${session?.is_revoked ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                  <span className={`text-label-sm font-semibold whitespace-nowrap ${session?.is_revoked ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'}`}>
                    {session?.is_revoked ? 'Revoked' : 'Active'}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <p className="text-label text-ink-400 mt-0.5 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-start sm:gap-2">
                  <span>Created: {formatSessionDate(session?.created_at)}</span>
                  <span className="hidden sm:inline">|</span>
                  <span>Expires: {formatSessionDate(session?.expires_at)}</span>
                </p>
              </div>
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 ${session?.is_revoked ? 'bg-red-50 dark:bg-red-900/20' : 'bg-tint-emerald'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${session?.is_revoked ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                <span className={`text-label-sm font-semibold whitespace-nowrap ${session?.is_revoked ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'}`}>
                  {session?.is_revoked ? 'Revoked' : 'Active'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl p-5 flex items-center gap-4 bg-section border border-sand">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-tint-brand">
              <span className="ri-computer-line text-heading-xs text-brand w-5 h-5 flex items-center justify-center"></span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold text-ink-900 font-satoshi">
                Active Session
              </p>
              <p className="text-label text-ink-400 mt-0.5">No active sessions found.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-7 pt-6 border-t border-black/[0.05]">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || status === 'loading'}
          className={`w-full sm:w-auto px-7 py-2.5 rounded-xl text-body font-semibold  transition-all duration-200 whitespace-nowrap ${
            isDirty && status !== 'loading'
              ? 'bg-gradient-indigo shadow-glow-indigo-pill-lg text-white dark:text-black'
              : 'bg-muted-bg-70 cursor-not-allowed text-white dark:text-gray-500'
          }`}
        >
          {status === 'loading' ? 'Updating...' : 'Update Security'}
        </button>
        {errors.api && (
          <div className="flex items-center gap-2 text-body-sm font-medium text-red-500">
            {errors.api}
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordField({
  label, value, show, error, placeholder, onToggle, onChange,
}: {
  label: string; value: string; show: boolean; error?: string;
  placeholder?: string; onToggle: () => void; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-label-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative">
        <input
      aria-label={placeholder}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-4 pr-11 py-3 rounded-xl text-body text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 transition-all duration-150 font-inter bg-glass-90 ${error ? "border-1.5 border-danger-bright" : "border-1.5 border-sand-firm"} ${error ? "shadow-glow-danger-ring" : "shadow-none"}`}

          onFocus={(e) => {
            if (!error) { e.currentTarget.style.border = '1.5px solid rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'; }
          }}
          onBlur={(e) => {
            if (!error) { e.currentTarget.style.border = '1.5px solid rgba(229,231,235,0.9)'; e.currentTarget.style.boxShadow = 'none'; }
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer"
        >
          <span className={`${show ? 'ri-eye-off-line' : 'ri-eye-line'} text-ui text-ink-400`}></span>
        </button>
      </div>
      {error && <p className="text-label-xs text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
