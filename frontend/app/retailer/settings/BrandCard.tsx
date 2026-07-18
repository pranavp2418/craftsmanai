'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchBrandSettings,
  updateBrandSettings,
} from '@/redux/slices/retailer/settings/brandSlice';
import CountryCodeSelect, { OPTIONS } from '@/src/utils/components/CountryCodeSelect';
import {
  getPhoneMaxLength,
  getPhoneLengthMessage,
  isValidEmail,
  looksLikeEmail,
  sanitizePhoneDigits,
} from '@/lib/formValidation';

const PRESET_COLORS = ['#2C62B9', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#1A1A2E'];

const FALLBACK_COLOR = '#3B82F6';

const INITIAL = {
  brandName: 'Craftsman AI',
  email: 'hello@craftsmanai.com',
  phone: '+1 (415) 555-0192',
  primaryColor: FALLBACK_COLOR,
  logoUrl: '',
};

function resolveBrandColor(value?: string) {
  const color = (value || '').trim();
  if (!color) return FALLBACK_COLOR;
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)) return color;

  const tokenMap: Record<string, string> = {
    'text-indigo-accent': '#3B82F6',
    'bg-indigo-accent': '#3B82F6',
    'indigo-accent': '#3B82F6',
    'text-brand': '#2C62B9',
    'brand': '#2C62B9',
    'text-success-medium': '#10B981',
    'text-warning': '#F59E0B',
    'text-violet-accent': '#8B5CF6',
  };

  return tokenMap[color] || FALLBACK_COLOR;
}

function ensureFullHex(color: string) {
  const resolved = resolveBrandColor(color);
  if (resolved.startsWith('#') && resolved.length === 4) {
    return '#' + resolved[1] + resolved[1] + resolved[2] + resolved[2] + resolved[3] + resolved[3];
  }
  return resolved;
}

function withAlpha(hexColor: string, alpha: number) {
  const hex = resolveBrandColor(hexColor).replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  const int = Number.parseInt(normalized, 16);
  const red = (int >> 16) & 255;
  const green = (int >> 8) & 255;
  const blue = int & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function mapBrandSettingsToForm(settings?: {
  brand_name?: string;
  logo_url?: string;
  logo?: string;
  brand_logo_url?: string;
  business_email?: string;
  phone_number?: string;
  primary_color?: string;
}) {
  return {
    brandName: settings?.brand_name || INITIAL.brandName,
    email: settings?.business_email || INITIAL.email,
    phone: settings?.phone_number || INITIAL.phone,
    primaryColor: resolveBrandColor(settings?.primary_color) || FALLBACK_COLOR,
    logoUrl: settings?.logo_url || settings?.logo || settings?.brand_logo_url || '',
  };
}

function splitPhoneNumber(phoneNumber?: string) {
  const rawPhone = (phoneNumber || '').trim();
  if (!rawPhone) {
    return { countryCode: '+1', phone: '' };
  }

  const sortedOptions = [...OPTIONS].sort((a, b) => b.value.length - a.value.length);
  const matched = sortedOptions.find((opt) => rawPhone.startsWith(opt.value));
  if (!matched) {
    return { countryCode: '+1', phone: sanitizePhoneDigits(rawPhone, getPhoneMaxLength('+1')) };
  }

  return {
    countryCode: matched.value,
    phone: sanitizePhoneDigits(rawPhone.slice(matched.value.length), getPhoneMaxLength(matched.value)),
  };
}

function formatBrandError(error: string | null): string | null {
  if (!error) return null;
  if (error === 'Access forbidden') {
    return 'Custom branding is not available on your current plan. Please upgrade to Pro or Business.';
  }
  return error;
}

export default function BrandCard() {
  const dispatch = useAppDispatch();
  const { settingsStatus, settingsError, settingsItem, updateStatus, updateError } = useAppSelector(
    (state) => state.retailerBrand
  );

  const canUseLogo = settingsItem?.can_use_logo ?? true;
  const canUseBrandName = settingsItem?.can_use_brand_name ?? true;
  const canUseCustomColor = settingsItem?.can_use_custom_color ?? true;

  const [form, setForm] = useState(INITIAL);
  const [saved, setSaved] = useState(INITIAL);
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [savedCountryCode, setSavedCountryCode] = useState('+1');
  const [dragOver, setDragOver] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty =
    form.brandName !== saved.brandName ||
    form.email !== saved.email ||
    form.phone !== saved.phone ||
    phoneCountryCode !== savedCountryCode ||
    form.primaryColor !== saved.primaryColor ||
    form.logoUrl !== saved.logoUrl;

  useEffect(() => {
    dispatch(fetchBrandSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settingsItem && (!initialized || !isDirty)) {
      const next = mapBrandSettingsToForm(settingsItem);
      const splitPhone = splitPhoneNumber(settingsItem.phone_number);
      setForm(next);
      setSaved(next);
      setPhoneCountryCode(splitPhone.countryCode);
      setSavedCountryCode(splitPhone.countryCode);
      setForm((prev) => ({ ...prev, phone: splitPhone.phone }));
      setSaved((prev) => ({ ...prev, phone: splitPhone.phone }));
      setLogoLoadFailed(false);
      setInitialized(true);
    }
  }, [settingsItem, initialized, isDirty]);

  const phoneMaxLength = getPhoneMaxLength(phoneCountryCode);
  const normalizedPhone = sanitizePhoneDigits(form.phone, phoneMaxLength);
  const phoneIsValid = normalizedPhone.length === phoneMaxLength;

  const brandColor = resolveBrandColor(form.primaryColor);
  const brandTint = withAlpha(brandColor, 0.12);
  const brandBorder = withAlpha(brandColor, 0.22);
  const buttonGradient = `linear-gradient(98deg, ${brandColor} 0%, #3B82F6 100%)`;

  const handleFile = useCallback((file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, logoUrl: 'Logo must be a PNG or JPEG/JPG image.' }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, logoUrl: 'Logo size must be 2MB or less.' }));
      return;
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (img.width !== 200 || img.height !== 200) {
        setErrors((prev) => ({ ...prev, logoUrl: 'Logo dimensions must be exactly 200x200px.' }));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setForm((prev) => ({ ...prev, logoUrl: String(event.target?.result || '') }));
        setLogoLoadFailed(false);
        setErrors((prev) => ({ ...prev, logoUrl: '' }));
      };
      reader.readAsDataURL(file);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      setErrors((prev) => ({ ...prev, logoUrl: 'Invalid image file.' }));
    };
  }, []);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (form.brandName.trim()) {
      if (form.brandName.trim().length > 100) {
        nextErrors.brandName = 'Brand name must be 100 characters or less.';
      } else if (looksLikeEmail(form.brandName)) {
        nextErrors.brandName = 'Brand name cannot be an email address.';
      }
    }
    if (form.email && !isValidEmail(form.email)) {
      nextErrors.email = 'Enter a valid email.';
    }
    if (normalizedPhone && !phoneIsValid) {
      nextErrors.phone = getPhoneLengthMessage(phoneCountryCode);
    }
    if (form.primaryColor.trim() && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(form.primaryColor.trim())) {
      nextErrors.primaryColor = 'Must be a valid hex color code (e.g., #3B82F6).';
    }
    return nextErrors;
  };

  const handleSave = async () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      const payload: Record<string, string> = {};
      if (form.brandName.trim() !== saved.brandName.trim()) {
        payload.brand_name = form.brandName.trim();
      }
      if (form.logoUrl.trim() !== saved.logoUrl.trim()) {
        payload.logo_url = form.logoUrl.trim();
      }
      if (form.primaryColor.trim() !== saved.primaryColor.trim()) {
        payload.primary_color = form.primaryColor.trim();
      }
      const result = await dispatch(updateBrandSettings(payload)).unwrap();
      const next = mapBrandSettingsToForm(result);
      const splitPhone = splitPhoneNumber(result.phone_number);
      setForm(next);
      setSaved(next);
      setPhoneCountryCode(splitPhone.countryCode);
      setSavedCountryCode(splitPhone.countryCode);
      setForm((prev) => ({ ...prev, phone: splitPhone.phone }));
      setSaved((prev) => ({ ...prev, phone: splitPhone.phone }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // slice error is shown below
    }
  };

  const logoInitials = form.brandName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

  const loading = settingsStatus === 'loading' || (!initialized && settingsStatus !== 'failed');

  const renderSkeleton = () => (
    <div className="space-y-7 animate-pulse">
      <div>
        <div className="h-8 w-52 rounded-card skeleton-shimmer mb-2" />
        <div className="h-4 w-96 max-w-full rounded-card skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 lg:gap-8">
        <div className="flex flex-col gap-7">
          <div className="rounded-2xl p-5 bg-section-70 border border-sand">
            <div className="h-4 w-40 rounded-card skeleton-shimmer mb-5" />
            <div className="flex items-start gap-5">
              <div className="space-y-2">
                <div className="h-4 w-12 rounded-card skeleton-shimmer" />
                <div className="w-[120px] h-[120px] rounded-2xl skeleton-shimmer" />
                <div className="h-3 w-[120px] rounded-card skeleton-shimmer" />
              </div>
              <div className="flex-1 pt-6 space-y-3">
                <div className="h-4 w-28 rounded-card skeleton-shimmer" />
                <div className="h-11 w-full rounded-card skeleton-shimmer" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5 bg-section-70 border border-sand">
            <div className="h-4 w-44 rounded-card skeleton-shimmer mb-5" />
            <div className="space-y-4">
              <div className="h-11 w-full rounded-card skeleton-shimmer" />
              <div className="h-11 w-full rounded-card skeleton-shimmer" />
            </div>
          </div>

          <div className="rounded-2xl p-5 bg-section-70 border border-sand">
            <div className="h-4 w-36 rounded-card skeleton-shimmer mb-5" />
            <div className="space-y-4">
              <div className="h-4 w-44 rounded-card skeleton-shimmer" />
              <div className="flex items-center gap-3 flex-wrap">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="w-8 h-8 rounded-full skeleton-shimmer" />
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
                <div className="space-y-2">
                  <div className="h-4 w-20 rounded-card skeleton-shimmer" />
                  <div className="h-3 w-40 rounded-card skeleton-shimmer" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="h-3 w-32 rounded-card skeleton-shimmer mb-3" />
            <div className="rounded-[24px] overflow-hidden bg-white dark:bg-surface-100 border border-sand-mid dark:border-border-default p-5 space-y-4">
              <div className="h-2.5 w-full rounded-full skeleton-shimmer" />
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl skeleton-shimmer" />
                <div className="space-y-2">
                  <div className="h-4 w-28 rounded-card skeleton-shimmer" />
                  <div className="h-3 w-24 rounded-card skeleton-shimmer" />
                </div>
              </div>
              <div className="rounded-2xl p-4 space-y-3 border border-sand">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
                  <div className="space-y-2">
                    <div className="h-2 w-24 rounded-card skeleton-shimmer" />
                    <div className="h-2 w-14 rounded-card skeleton-shimmer" />
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full skeleton-shimmer" />
                <div className="h-1.5 w-4/5 rounded-full skeleton-shimmer" />
              </div>
              <div className="h-10 rounded-xl skeleton-shimmer" />
              <div className="space-y-2 border-t border-sand pt-3">
                <div className="h-3 w-40 rounded-card skeleton-shimmer" />
                <div className="h-3 w-32 rounded-card skeleton-shimmer" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="rounded-sheet p-5 sm:p-8 shadow-glow-indigo-soft bg-glass-72 backdrop-blur-xl border border-glass-strong">
        {renderSkeleton()}
      </div>
    );
  }

  if (settingsStatus === 'failed' && !settingsItem) {
    return (
      <div className="rounded-sheet p-5 sm:p-8 shadow-glow-indigo-soft bg-glass-72 backdrop-blur-xl border border-glass-strong">
        <div className="mb-8">
          <h2 className="text-heading font-bold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Brand Settings</h2>
          <p className="text-body-sm text-ink-400 mt-1">Customize how your brand appears across shared designs.</p>
        </div>
        <div className="rounded-2xl border border-danger/20 bg-tint-danger-soft px-4 py-3 text-label-sm text-danger mb-4">
          {formatBrandError(settingsError)}
        </div>
        <button
          type="button"
          onClick={() => dispatch(fetchBrandSettings())}
          className="px-5 py-2.5 rounded-xl text-body-sm font-semibold text-white bg-gradient-indigo shadow-glow-indigo-pill-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-sheet p-5 sm:p-8 shadow-glow-indigo-soft bg-glass-72 backdrop-blur-xl border border-glass-strong">
      <div className="mb-8">
        <h2 className="text-heading font-bold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Brand Settings</h2>
        <p className="text-body-sm text-ink-400 mt-1">Customize how your brand appears across shared designs.</p>
      </div>

      {settingsError && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-tint-danger-soft px-4 py-3 text-label-sm text-danger">
          {formatBrandError(settingsError)}
        </div>
      )}
      {updateError && !settingsError && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-tint-danger-soft px-4 py-3 text-label-sm text-danger">
          {formatBrandError(updateError)}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 lg:gap-8">
        <div className="flex flex-col gap-7">
          <Section title="Brand Identity" icon="ri-store-3-line">
            <div className="flex flex-col sm:flex-row items-start gap-5 w-full">
              <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-auto items-start">
                <label className="text-label-xs font-semibold text-ink-500 uppercase tracking-wide flex items-center gap-1">
                  Logo
                  {!canUseLogo && <span className="ri-lock-line text-amber-500 text-xs" title="Locked on current plan" />}
                </label>
                <div
                  onClick={() => {
                    if (canUseLogo) fileInputRef.current?.click();
                  }}
                  onDragOver={(event) => {
                    if (canUseLogo) {
                      event.preventDefault();
                      setDragOver(true);
                    }
                  }}
                  onDragLeave={() => {
                    if (canUseLogo) setDragOver(false);
                  }}
                  onDrop={(event) => {
                    if (canUseLogo) handleDrop(event);
                  }}
                  className={`w-[120px] h-[120px] rounded-2xl flex flex-col items-center justify-center transition-all duration-200 relative overflow-hidden border-2 border-dashed mx-auto sm:mx-0 ${
                    canUseLogo ? 'cursor-pointer' : 'cursor-not-allowed opacity-50 bg-muted-bg-70'
                  }`}
                  style={{
                    backgroundColor: dragOver ? brandTint : 'var(--surface-100)',
                    borderColor: dragOver ? brandColor : 'var(--border-strong)',
                  }}
                >
                  {form.logoUrl && !logoLoadFailed ? (
                    <>
                      <img
                        src={form.logoUrl}
                        alt="Logo"
                        className="absolute inset-0 w-full h-full object-contain p-2"
                        onError={() => setLogoLoadFailed(true)}
                      />
                      {canUseLogo && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setForm((prev) => ({ ...prev, logoUrl: '' }));
                            setErrors((prev) => ({ ...prev, logoUrl: '' }));
                            setLogoLoadFailed(false);
                          }}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60 transition-colors"
                        >
                          <span className="ri-close-line text-white text-label-xs" />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span
                        className="ri-upload-cloud-2-line text-display mb-1.5"
                        style={{ color: dragOver ? brandColor : '#BDBDBD' }}
                      />
                      <span
                        className="text-caption font-medium text-center px-2 leading-tight"
                        style={{ color: dragOver ? brandColor : '#9CA3AF' }}
                      >
                        {canUseLogo ? 'Drop or click' : 'Locked'}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-caption text-ink-250 text-center w-[120px] mx-auto sm:mx-0">Recommended: transparent PNG</p>
                {!canUseLogo ? (
                  <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-500 font-semibold leading-tight w-[120px] mx-auto sm:mx-0 justify-center shadow-sm">
                    <span className="ri-lock-line text-[9px] flex-shrink-0" />
                    <span className="text-center">Locked on plan</span>
                  </div>
                ) : (
                  errors.logoUrl && <p className="text-label-xs text-red-400 text-center mt-1 w-[120px] mx-auto sm:mx-0">{errors.logoUrl}</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>

              <div className="flex-1 w-full pt-0 sm:pt-6">
                <BrandField
                  label={
                    <span className="flex items-center gap-1">
                      Brand Name
                      {!canUseBrandName && <span className="ri-lock-line text-amber-500 text-xs" title="Locked on current plan" />}
                    </span>
                  }
                  value={form.brandName}
                  error={errors.brandName}
                  placeholder="e.g. Craftsman AI"
                  accentColor={brandColor}
                  maxLength={100}
                  disabled={!canUseBrandName}
                  onChange={(value) => {
                    setForm((prev) => ({ ...prev, brandName: value }));
                    setErrors((prev) => ({ ...prev, brandName: '' }));
                  }}
                />
                {!canUseBrandName && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-label-xs text-amber-500 font-medium shadow-sm">
                    <span className="ri-lock-line text-xs flex-shrink-0" />
                    <span>Upgrade your plan to customize brand name.</span>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* 
          <Section title="Contact Information" icon="ri-contacts-line">
            <div className="flex flex-col gap-4">
              <BrandField
                label={
                  <>
                    Business Email <span className="text-red-500">*</span>
                  </>
                }
                value={form.email}
                error={errors.email}
                placeholder="hello@yourbrand.com"
                accentColor={brandColor}
                type="email"
                onChange={(value) => {
                  setForm((prev) => ({ ...prev, email: value }));
                  setErrors((prev) => ({ ...prev, email: '' }));
                }}
              />
              <div>
                <label className="block text-label-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 sm:gap-3">
                  <CountryCodeSelect
                    value={phoneCountryCode}
                    onChange={(code) => {
                      const maxLength = getPhoneMaxLength(code);
                      setPhoneCountryCode(code);
                      const nextPhone = sanitizePhoneDigits(form.phone, maxLength);
                      setForm((prev) => ({ ...prev, phone: nextPhone }));
                      if (nextPhone && nextPhone.length !== maxLength) {
                        setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(code) }));
                      } else {
                        setErrors((prev) => ({ ...prev, phone: '' }));
                      }
                    }}
                    className="!bg-glass-90 !border-sand-firm rounded-xl text-body-sm text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 font-inter !px-4 !py-2.5 shrink-0"
                  />
                  <input
                    aria-label="Phone Number"
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(event) => {
                      const maxLength = getPhoneMaxLength(phoneCountryCode);
                      setForm((prev) => ({ ...prev, phone: sanitizePhoneDigits(event.target.value, maxLength) }));
                      setErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    placeholder="0000000000"
                    maxLength={getPhoneMaxLength(phoneCountryCode)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-body-sm text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 transition-all duration-150 font-inter bg-glass-90 min-w-0"
                    style={{
                      border: errors.phone ? '1.5px solid #F87171' : '1.5px solid var(--border-default)',
                      boxShadow: errors.phone ? '0 0 0 3px rgba(248,113,113,0.10)' : 'none',
                    }}
                    onFocus={(event) => {
                      if (!errors.phone) {
                        event.currentTarget.style.border = `1.5px solid ${brandColor}80`;
                        event.currentTarget.style.boxShadow = `0 0 0 3px ${brandColor}18`;
                      }
                    }}
                    onBlur={(event) => {
                      const maxLength = getPhoneMaxLength(phoneCountryCode);
                      const nextPhone = sanitizePhoneDigits(form.phone, maxLength);
                      if (!nextPhone) {
                        setErrors((prev) => ({ ...prev, phone: 'Phone number is required.' }));
                      } else if (nextPhone.length !== maxLength) {
                        setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(phoneCountryCode) }));
                      }
                      if (!errors.phone) {
                        event.currentTarget.style.border = '1.5px solid var(--border-default)';
                        event.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  />
                </div>
                {errors.phone && <p className="text-label-xs text-red-400 mt-1">{errors.phone}</p>}
              </div>
            </div>
          </Section>
          */}

          <Section title="Visual Theme" icon="ri-palette-line">
            <div>
              <label className="block text-label-xs font-semibold text-ink-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                Primary Brand Color
                {!canUseCustomColor && <span className="ri-lock-line text-amber-500 text-xs" title="Locked on current plan" />}
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                {PRESET_COLORS.map((color) => {
                  const active = resolveBrandColor(form.primaryColor) === color;
                  return (
                    <button
                      type="button"
                      key={color}
                      disabled={!canUseCustomColor}
                      onClick={() => setForm((prev) => ({ ...prev, primaryColor: color }))}
                      className="touch-target-hitbox w-8 h-8 rounded-full transition-all duration-150 flex-shrink-0 shadow-lift-micro"
                      style={{
                        backgroundColor: color,
                        transform: active ? 'scale(1.15)' : undefined,
                        boxShadow: active ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
                        opacity: canUseCustomColor ? 1 : 0.5,
                        cursor: canUseCustomColor ? 'pointer' : 'not-allowed',
                      }}
                      title={color}
                    />
                  );
                })}
                <div className="relative flex items-center">
                  <label
                    className={`touch-target-hitbox w-8 h-8 rounded-full border-2 border-dashed border-strong flex items-center justify-center overflow-hidden ${
                      canUseCustomColor ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    }`}
                    style={{ backgroundColor: PRESET_COLORS.includes(resolveBrandColor(form.primaryColor)) ? 'transparent' : brandColor }}
                    title="Custom color"
                  >
                    {PRESET_COLORS.includes(resolveBrandColor(form.primaryColor)) ? (
                      <span className="ri-add-line text-body-md text-ink-400" />
                    ) : (
                      <span className="ri-check-line text-body-md text-white" />
                    )}
                    <input
                      type="color"
                      disabled={!canUseCustomColor}
                      value={ensureFullHex(form.primaryColor)}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, primaryColor: event.target.value }));
                        setErrors((prev) => ({ ...prev, primaryColor: '' }));
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <div className="w-10 h-10 rounded-xl flex-shrink-0 shadow-sm" style={{ backgroundColor: brandColor, opacity: canUseCustomColor ? 1 : 0.5 }} />
                <div className="flex-1 min-w-[120px] max-w-[150px]">
                  <input
                    type="text"
                    disabled={!canUseCustomColor}
                    value={form.primaryColor}
                    onChange={(event) => {
                      const val = event.target.value;
                      setForm((prev) => ({ ...prev, primaryColor: val }));
                      setErrors((prev) => ({ ...prev, primaryColor: '' }));
                    }}
                    placeholder="#3B82F6"
                    className={`w-full px-3 py-1.5 rounded-lg text-body-sm text-ink-900 outline-none border border-sand-firm bg-glass-90 uppercase font-mono ${
                      !canUseCustomColor ? 'opacity-60 cursor-not-allowed bg-muted-bg-70' : ''
                    }`}
                    style={{
                      border: errors.primaryColor ? '1.5px solid #F87171' : '1.5px solid var(--border-default)',
                    }}
                  />
                </div>
                <div>
                  <p className="text-label-xs text-ink-400">Used for highlights and accents.</p>
                </div>
              </div>
              {!canUseCustomColor ? (
                <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-label-xs text-amber-500 font-medium shadow-sm">
                  <span className="ri-lock-line text-xs flex-shrink-0" />
                  <span>Upgrade your plan to customize brand colors.</span>
                </div>
              ) : (
                errors.primaryColor && <p className="text-label-xs text-red-400 mt-1">{errors.primaryColor}</p>
              )}
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-label-xs font-semibold text-ink-400 uppercase tracking-widest mb-3">Live Preview</p>
            <div className="max-w-[340px] lg:max-w-none w-full mx-auto lg:mx-0">
              <BrandPreviewCard
                logoUrl={form.logoUrl}
                brandName={form.brandName}
                email={form.email}
                phone={form.phone ? `${phoneCountryCode} ${form.phone}` : ''}
                primaryColor={brandColor}
                initials={logoInitials || 'CA'}
                onLogoError={() => setLogoLoadFailed(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-8 pt-6 border-t border-black/[0.05]">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || updateStatus === 'loading'}
          className={`px-7 py-2.5 rounded-xl text-body font-semibold  transition-all duration-200 whitespace-nowrap ${isDirty ? 'shadow-glow-indigo-pill-lg text-white dark:text-white' : 'bg-muted-bg-70 cursor-not-allowed text-white dark:text-gray-500'
            }`}
          style={{ background: isDirty ? buttonGradient : undefined }}
        >
          {updateStatus === 'loading' ? 'Saving...' : 'Save Changes'}
        </button>
        {success && (
          <div className="flex items-center gap-2 text-body-sm font-medium text-emerald-600">
            <span className="w-4 h-4 flex items-center justify-center ri-checkbox-circle-line text-ui-md" />
            Brand settings updated
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 bg-section-70 border border-sand">
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-4 h-4 flex items-center justify-center ${icon} text-ui text-indigo-accent`} />
        <p className="text-label-md font-semibold text-ink-900 font-satoshi">{title}</p>
      </div>
      {children}
    </div>
  );
}

function BrandField({
  label,
  value,
  error,
  placeholder,
  accentColor,
  onChange,
  maxLength,
  type = 'text',
  disabled,
}: {
  label: React.ReactNode;
  value: string;
  error?: string;
  placeholder?: string;
  accentColor: string;
  onChange: (v: string) => void;
  maxLength?: number;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-label-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">{label}</label>
      <input
        aria-label={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className={`w-full px-4 py-2.5 rounded-xl text-body-sm text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 transition-all duration-150 font-inter bg-glass-90 ${
          disabled ? 'opacity-60 cursor-not-allowed bg-muted-bg-70' : ''
        }`}
        style={{
          border: error ? '1.5px solid #F87171' : '1.5px solid var(--border-default)',
          boxShadow: error ? '0 0 0 3px rgba(248,113,113,0.10)' : 'none',
        }}
        onFocus={(event) => {
          if (!error && !disabled) {
            event.currentTarget.style.border = `1.5px solid ${accentColor}80`;
            event.currentTarget.style.boxShadow = `0 0 0 3px ${accentColor}18`;
          }
        }}
        onBlur={(event) => {
          if (!error && !disabled) {
            event.currentTarget.style.border = '1.5px solid var(--border-default)';
            event.currentTarget.style.boxShadow = 'none';
          }
        }}
      />
      {error && <p className="text-label-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function BrandPreviewCard({
  logoUrl,
  brandName,
  email,
  phone,
  primaryColor,
  initials,
  onLogoError,
}: {
  logoUrl: string;
  brandName: string;
  email: string;
  phone: string;
  primaryColor: string;
  initials: string;
  onLogoError: () => void;
}) {
  const headerGradient = `linear-gradient(90deg, ${primaryColor} 0%, #3B82F6 100%)`;
  const buttonGradient = `linear-gradient(98deg, ${primaryColor} 0%, #3B82F6 100%)`;

  return (
    <div className="rounded-[24px] overflow-hidden bg-white dark:bg-surface-100 shadow-pop-soft border border-sand-mid dark:border-border-default">
      <div className="h-2.5 w-full" style={{ background: headerGradient }} />

      <div className="p-5">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: logoUrl ? '#F9FAFB' : `${primaryColor}14`, border: `1.5px solid ${primaryColor}22` }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="logo"
                className="absolute inset-0 w-full h-full object-contain p-2"
                onError={onLogoError}
              />
            ) : (
              <span className="text-body-sm font-bold" style={{ color: primaryColor }}>{initials}</span>
            )}
          </div>
          <div>
            <p className="text-body-md font-bold text-ink-900 font-satoshi">{brandName || 'Your Brand'}</p>
            <p className="text-label-xs text-ink-400">Design Preview</p>
          </div>
        </div>

        <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: `${primaryColor}10`, border: `1px solid ${primaryColor}22` }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: `${primaryColor}20` }} />
            <div>
              <div className="h-2 w-24 rounded-full mb-1" style={{ backgroundColor: `${primaryColor}35` }} />
              <div className="h-1.5 w-14 rounded-full bg-tint-muted-strong" />
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full mb-1.5 bg-tint-muted" />
          <div className="h-1.5 w-4/5 rounded-full bg-tint-muted" />
        </div>

        <div className="w-full py-2.5 rounded-xl text-label-sm font-semibold text-white dark:text-black text-center" style={{ background: buttonGradient }}>
          View Design
        </div>

        {/* {(email || phone) && (
          <div className="mt-3 pt-3 border-t border-muted flex flex-col gap-1">
            {email && (
              <div className="flex items-center gap-1.5">
                <span className="ri-mail-line text-label-xs" style={{ color: primaryColor }} />
                <span className="text-caption text-ink-400 truncate">{email}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-1.5">
                <span className="ri-phone-line text-label-xs" style={{ color: primaryColor }} />
                <span className="text-caption text-ink-400">{phone}</span>
              </div>
            )}
          </div>
        )} */}
      </div>
    </div>
  );
}
