"use client";

import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchUserProfile, updateUserProfile, updateProfilePicture } from '@/redux/slices/retailer/settings/profileSlice';
import CountryCodeSelect, { OPTIONS } from '@/src/utils/components/CountryCodeSelect';
import { toast } from 'react-toastify';
import { getPhoneMaxLength, getPhoneLengthMessage, looksLikeEmail, sanitizePhoneDigits } from '@/lib/formValidation';

export default function ProfileCard() {
  const dispatch = useAppDispatch();
  const { profileStatus, profileError, profileItem, updateStatus, updateError } = useAppSelector(
    (s) => s.retailerProfile
  );


  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', businessName: '' });
  const [saved, setSaved] = useState({ firstName: '', lastName: '', email: '', phone: '', businessName: '' });
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [savedCountryCode, setSavedCountryCode] = useState('+1');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const isDirty =
    form.firstName !== saved.firstName ||
    form.lastName !== saved.lastName ||
    form.phone !== saved.phone ||
    form.businessName !== saved.businessName ||
    phoneCountryCode !== savedCountryCode;

  useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profileItem && (!initialized || !isDirty)) {
      const fullPhone = profileItem.whatsapp_number || '';
      const matched = [...OPTIONS].sort((a, b) => b.value.length - a.value.length).find((opt) => fullPhone.startsWith(opt.value));
      const countryCode = matched ? matched.value : '+1';
      const localPhone = matched ? fullPhone.slice(matched.value.length) : fullPhone;

      setForm({
        firstName: profileItem.first_name || '',
        lastName: profileItem.last_name || '',
        email: profileItem.email || '',
        phone: localPhone,
        businessName: profileItem.business_name || '',
      });
      setSaved({
        firstName: profileItem.first_name || '',
        lastName: profileItem.last_name || '',
        email: profileItem.email || '',
        phone: localPhone,
        businessName: profileItem.business_name || '',
      });
      setPhoneCountryCode(countryCode);
      setSavedCountryCode(countryCode);
      setInitialized(true);
    }
  }, [profileItem, initialized, isDirty]);

  const phoneMaxLength = getPhoneMaxLength(phoneCountryCode);
  const normalizedPhone = sanitizePhoneDigits(form.phone, phoneMaxLength);
  const phoneIsValid = normalizedPhone.length === phoneMaxLength;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required.';
    else if (looksLikeEmail(form.firstName)) e.firstName = 'First name cannot be an email address.';
    if (!form.lastName.trim()) e.lastName = 'Last name is required.';
    else if (looksLikeEmail(form.lastName)) e.lastName = 'Last name cannot be an email address.';
    if (!form.businessName.trim()) e.businessName = 'Business name is required.';
    else if (looksLikeEmail(form.businessName)) e.businessName = 'Business name cannot be an email address.';
    
    if (!normalizedPhone) {
      e.phone = 'Phone number is required.';
    } else if (!phoneIsValid) {
      e.phone = getPhoneLengthMessage(phoneCountryCode);
    }
    return e;
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setSuccess(false);
  };

  const handleCountryCodeChange = (code: string) => {
    const maxLen = getPhoneMaxLength(code);
    setPhoneCountryCode(code);
    const nextPhone = sanitizePhoneDigits(form.phone, maxLen);
    setForm((prev) => ({ ...prev, phone: nextPhone }));
    if (nextPhone && nextPhone.length !== maxLen) {
      setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(code) }));
    } else {
      setErrors((prev) => ({ ...prev, phone: '' }));
    }
    setSuccess(false);
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    try {
      const combinedPhone = form.phone.trim() ? `${phoneCountryCode}${form.phone.trim()}` : '';
      const payload = {
        first_name: form.firstName,
        last_name: form.lastName,
        whatsapp_number: combinedPhone,
        business_name: form.businessName,
      };
      const result = await dispatch(updateUserProfile(payload)).unwrap();

      const fullPhone = result.whatsapp_number || '';
      const matched = [...OPTIONS].sort((a, b) => b.value.length - a.value.length).find((opt) => fullPhone.startsWith(opt.value));
      const countryCode = matched ? matched.value : '+1';
      const localPhone = matched ? fullPhone.slice(matched.value.length) : fullPhone;

      setSaved({
        firstName: result.first_name || '',
        lastName: result.last_name || '',
        email: result.email || '',
        phone: localPhone,
        businessName: result.business_name || '',
      });
      setSavedCountryCode(countryCode);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      toast.success('Profile updated successfully');
    } catch (err) {
      // updateError will be set from slice; keep local handling minimal
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file (PNG, JPEG, GIF, or WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    try {
      await dispatch(updateProfilePicture(file)).unwrap();
      toast.success('Profile picture updated successfully!');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to upload profile picture.');
    }
  };

  const initials = `${(form.firstName || '').charAt(0)}${(form.lastName || '').charAt(0)}`.toUpperCase();

  const loading = profileStatus === 'loading' || !initialized;

  return (
    <div className="flex-1 rounded-sheet p-4 sm:p-6 lg:p-10 shadow-glow-indigo-soft bg-glass-72 backdrop-blur-xl border border-glass-strong">
      <div className="mb-8">
        <h2 className="text-heading font-bold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Profile</h2>
        <p className="text-body-sm text-ink-400 mt-1">Manage your account details.</p>
      </div>

      {loading ? (
        <div>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-10 pb-8 border-b border-black/[0.05]">
            <div className="w-[72px] h-[72px] rounded-full skeleton-shimmer flex-shrink-0" />
            <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left space-y-2 w-full">
              <div className="h-5 w-48 rounded-card skeleton-shimmer" />
              <div className="h-4 w-40 rounded-card skeleton-shimmer" />
              <div className="h-5 w-24 rounded-card skeleton-shimmer" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-5">
            <div className="h-12 rounded-card skeleton-shimmer" />
            <div className="h-12 rounded-card skeleton-shimmer" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-5">
            <div className="h-12 rounded-card skeleton-shimmer" />
            <div className="h-12 rounded-card skeleton-shimmer" />
          </div>

          <div className="mb-8">
            <div className="h-12 rounded-card skeleton-shimmer" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-10 pb-8 border-b border-black/[0.05]">
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="relative w-[72px] h-[72px] rounded-full">
                {profileItem?.profile_picture_url ? (
                  <img
                    src={profileItem.profile_picture_url}
                    alt="Profile"
                    className="w-full h-full object-cover rounded-full ring-2 ring-white dark:ring-border-default shadow-sm"
                  />
                ) : (
                  <div className="w-full h-full rounded-full flex items-center justify-center text-heading-lg font-bold text-white bg-gradient-indigo">
                    {initials}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white dark:bg-[#171C22] shadow-md border border-sand-strong flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-[#212730] transition-colors">
                  <input type="file" accept="image/png, image/jpeg, image/jpg, image/gif, image/webp" className="hidden" onChange={handleImageUpload} />
                  <span className="w-3.5 h-3.5 flex items-center justify-center ri-camera-line text-ink-500 dark:text-[#A1A8B3]" />
                </label>
              </div>
              <span className="text-[10px] text-ink-400 text-center max-w-[125px] leading-tight font-medium">
                Accepted: PNG, JPEG, GIF, WEBP (Max 5MB)
              </span>
            </div>
            <div className="text-center sm:text-left flex flex-col items-center sm:items-start min-w-0 w-full">
              <p className="text-ui-md font-semibold text-ink-900 font-satoshi truncate w-full">{form.firstName} {form.lastName}</p>
              <p className="text-body-sm text-ink-400 mt-0.5 truncate w-full">{form.email}</p>
              <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-label-xs font-semibold text-[#3B82F6] bg-tint-brand">
                <span className="w-3 h-3 flex items-center justify-center ri-shield-check-line text-label" />
                {profileItem?.role || 'User'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-5">
            <Field
              label={
                <>
                  First Name <span className="text-red-500">*</span>
                </>
              }
              value={form.firstName}
              error={errors.firstName}
              onChange={(v) => handleChange('firstName', v)}
              placeholder="First Name"
            />
            <Field
              label={
                <>
                  Last Name <span className="text-red-500">*</span>
                </>
              }
              value={form.lastName}
              error={errors.lastName}
              onChange={(v) => handleChange('lastName', v)}
              placeholder="Last Name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-5">
            <div>
              <label className="block text-label font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">Email Address</label>
              <div className="w-full px-4 py-3 rounded-xl text-body text-ink-400 flex items-center gap-2 bg-muted-bg-soft border border-sand-strong">
                <span className="w-4 h-4 flex items-center justify-center ri-lock-2-line text-body-md text-ink-250" />
                {form.email}
              </div>
              <p className="text-label-xs text-ink-250 mt-1.5">Used for login and communication.</p>
            </div>
            <Field
              label={
                <>
                  Business name <span className="text-red-500">*</span>
                </>
              }
              value={form.businessName}
              error={errors.businessName}
              onChange={(v) => handleChange('businessName', v)}
              placeholder="Business name"
            />
          </div>

          <div className="mb-8">
            <label className="block text-label font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 sm:gap-3">
              <CountryCodeSelect
                value={phoneCountryCode}
                onChange={handleCountryCodeChange}
                className="!bg-glass-85 !border-sand-firm rounded-xl text-body text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 font-inter !px-4 !py-3 shrink-0 !h-[46px]"
              />
              <input
                aria-label="Phone Number"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => handleChange('phone', sanitizePhoneDigits(e.target.value, getPhoneMaxLength(phoneCountryCode)))}
                placeholder="Phone Number"
                maxLength={getPhoneMaxLength(phoneCountryCode)}
                className={`flex-1 px-4 py-3 rounded-xl text-body text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 transition-all duration-150 font-inter bg-glass-85 min-w-0 h-[46px] ${errors.phone ? 'border-1.5 border-danger-bright' : 'border-1.5 border-sand-firm'} ${errors.phone ? 'shadow-glow-danger-ring' : 'shadow-none'}`}
                onFocus={(e) => {
                  if (!errors.phone) {
                    e.currentTarget.style.border = '1.5px solid rgba(99,102,241,0.5)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)';
                  }
                }}
                onBlur={(e) => {
                  const maxLength = getPhoneMaxLength(phoneCountryCode);
                  const nextPhone = sanitizePhoneDigits(form.phone, maxLength);
                  if (!nextPhone) {
                    setErrors((prev) => ({ ...prev, phone: 'Phone number is required.' }));
                  } else if (nextPhone.length !== maxLength) {
                    setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(phoneCountryCode) }));
                  }
                  if (!errors.phone) {
                    e.currentTarget.style.border = '1.5px solid rgba(229,231,235,0.9)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              />
            </div>
            {errors.phone && <p className="text-label-xs text-red-400 mt-1.5">{errors.phone}</p>}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button type="button" onClick={handleSave} disabled={!isDirty || updateStatus === 'loading'} className={`w-full sm:w-auto px-7 py-2.5 rounded-xl text-body font-semibold  transition-all duration-200 whitespace-nowrap ${isDirty ? 'bg-gradient-indigo shadow-glow-indigo-pill-lg text-white dark:text-black' : 'bg-muted-bg-70 cursor-not-allowed text-white dark:text-gray-500'}`}>
              {updateStatus === 'loading' ? 'Saving...' : 'Save Changes'}
            </button>

            {success && (
              <div className="flex items-center gap-2 text-body-sm font-medium text-emerald-600">
                <span className="w-4 h-4 flex items-center justify-center ri-checkbox-circle-line text-ui-md" />
                Profile updated successfully
              </div>
            )}

            {updateError && <div className="text-red-500 ml-2">{updateError}</div>}
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  error,
  onChange,
  placeholder,
}: {
  label: React.ReactNode;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-label font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">{label}</label>
      <input aria-label={placeholder} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`w-full px-4 py-3 rounded-xl text-body text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 transition-all duration-150 font-inter bg-glass-85 ${error ? 'border-1.5 border-danger-bright' : 'border-1.5 border-sand-firm'} ${error ? 'shadow-glow-danger-ring' : 'shadow-none'}`} onFocus={(e) => { if (!error) e.currentTarget.style.border = '1.5px solid rgba(99,102,241,0.5)'; if (!error) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'; }} onBlur={(e) => { if (!error) e.currentTarget.style.border = '1.5px solid rgba(229,231,235,0.9)'; if (!error) e.currentTarget.style.boxShadow = 'none'; }} />
      {error && <p className="text-label-xs text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
