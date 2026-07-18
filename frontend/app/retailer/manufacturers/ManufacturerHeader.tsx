'use client';

import { useState, useEffect, useMemo } from 'react';
import { Manufacturer, SPECIALTIES } from '@/lib/manufacturersData';
import { useAppSelector } from '@/redux/hooks';
import CountryCodeSelect from '@/src/utils/components/CountryCodeSelect';
import { getPhoneMaxLength, getPhoneLengthMessage, sanitizePhoneDigits } from '@/lib/formValidation';
import { intlTelInput } from '@intl-tel-input/react/with-utils';

const parsePhoneNumber = (phone: string) => {
  if (!phone) return { countryCode: '+1', digits: '' };
  const cleanPhone = phone.startsWith('+') ? phone : `+${phone}`;
  let list: any[] = [];
  try {
    list = intlTelInput.getAllCountries();
  } catch (e) {}
  if (!list || list.length === 0) {
    const commonPrefixes = ['+91', '+44', '+61', '+1'];
    for (const prefix of commonPrefixes) {
      if (cleanPhone.startsWith(prefix)) {
        return { countryCode: prefix, digits: cleanPhone.slice(prefix.length) };
      }
    }
    return { countryCode: '+1', digits: cleanPhone.replace(/^\+1/, '') };
  }
  const sorted = [...list].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const c of sorted) {
    const prefix = `+${c.dialCode}`;
    if (cleanPhone.startsWith(prefix)) {
      return {
        countryCode: prefix,
        digits: cleanPhone.slice(prefix.length),
      };
    }
  }
  return { countryCode: '+1', digits: cleanPhone.replace(/^\+1/, '') };
};

interface Props {
  manufacturer: Manufacturer;
  onEdit: (updated: Manufacturer) => void;
  onDelete: (id: string) => void;
}

const statusStyle: Record<Manufacturer['status'], { bg: string; color: string; dot: string; label: string }> = {
  Active: { bg: 'bg-tint-emerald', color: 'text-success-deep', dot: 'bg-success-medium', label: 'Active' },
  Inactive: { bg: 'bg-tint-gray', color: 'text-ink-500', dot: 'bg-ink-400', label: 'Inactive' },
};

function getSpecialtyStyle(label: string) {
  const found = SPECIALTIES.find((s) => s.label === label);
  return found ?? { label, color: 'text-ink-500', bg: 'bg-tint-gray-soft' };
}

const kpis = (m: Manufacturer) => [
  {
    label: 'Total Requests',
    value: String(m.totalRequests),
    icon: 'ri-file-list-3-line',
    iconColor: 'text-brand',
    iconBg: 'bg-tint-brand',
  },
  {
    label: 'Completed',
    value: String(m.completedRequests),
    icon: 'ri-checkbox-circle-line',
    iconColor: 'text-success',
    iconBg: 'bg-tint-success',
  },
  {
    label: 'Total Profit',
    value: m.totalProfit,
    icon: 'ri-money-dollar-circle-line',
    iconColor: 'text-warning-medium',
    iconBg: 'bg-tint-warning',
  },
  {
    label: 'Pending',
    value: String(m.pendingRequests),
    icon: 'ri-time-line',
    iconColor: 'text-violet-deep',
    iconBg: 'bg-tint-violet',
  },
];

export default function ManufacturerHeader({ manufacturer: m, onEdit, onDelete }: Props) {
  const { updateStatus, updateError, deleteStatus, deleteError } = useAppSelector(
    (state) => state.retailerManufacturer
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(m.name);
  const [editPhone, setEditPhone] = useState(m.phone);
  const [editLocation, setEditLocation] = useState(m.location);
  const [editSpecialty, setEditSpecialty] = useState(m.specialty);
  const [editStatus, setEditStatus] = useState<Manufacturer['status']>(m.status);
  const [editEmails, setEditEmails] = useState<{ label: string; value: string }[]>(m.emails?.length ? m.emails : [{ label: 'Work', value: m.email }]);
  const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');

  const specialtyStyle = useMemo(() => getSpecialtyStyle(editSpecialty), [editSpecialty]);

  useEffect(() => {
    setEditName(m.name);
    setEditLocation(m.location);
    setEditSpecialty(m.specialty);
    setEditStatus(m.status);
    setEditEmails(m.emails?.length ? m.emails : [{ label: 'Work', value: m.email }]);
    setErrors({});
    const parsed = parsePhoneNumber(m.phone);
    setPhoneCountryCode(parsed.countryCode);
    setEditPhone(parsed.digits);
  }, [m]);

  const validate = () => {
    const nextErrors: { name?: string; email?: string; phone?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\d\s()+-]{7,20}$/;
    const validEmails = editEmails
      .map((entry) => entry.value.trim())
      .filter(Boolean);

    if (!editName.trim()) {
      nextErrors.name = 'Manufacturer name is required.';
    }
    if (validEmails.length === 0) {
      nextErrors.email = 'At least one email address is required.';
    } else if (!validEmails.every((email) => emailRegex.test(email))) {
      nextErrors.email = 'Enter a valid email address.';
    }
    const phoneMaxLength = getPhoneMaxLength(phoneCountryCode);
    const normalizedPhone = sanitizePhoneDigits(editPhone, phoneMaxLength);
    if (!normalizedPhone) {
      nextErrors.phone = 'Phone number is required.';
    } else if (normalizedPhone.length !== phoneMaxLength) {
      nextErrors.phone = getPhoneLengthMessage(phoneCountryCode);
    }

    return nextErrors;
  };

  const s = statusStyle[m.status];

  const handleSave = () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const primaryEmail =
      editEmails.map((entry) => entry.value.trim()).find(Boolean) ?? m.email;
    onEdit({
      ...m,
      name: editName.trim(),
      phone: `${phoneCountryCode}${sanitizePhoneDigits(editPhone, getPhoneMaxLength(phoneCountryCode))}`,
      location: editLocation,
      specialty: editSpecialty,
      status: editStatus,
      email: primaryEmail,
      emails: editEmails
        .map((entry) => ({ label: entry.label.trim(), value: entry.value.trim() }))
        .filter((entry) => entry.value),
    });
  };

  useEffect(() => {
    if (updateStatus === 'succeeded') setShowEdit(false);
  }, [updateStatus]);

  useEffect(() => {
    if (deleteStatus === 'succeeded') setShowConfirm(false);
  }, [deleteStatus]);

  const allEmails = m.emails?.length ? m.emails : [{ label: 'Work', value: m.email }];

  return (
    <>
      <div className="mb-5">
        <div
          className="rounded-sheet p-4 sm:p-6 mb-4 bg-gradient-surface dark:bg-none dark:bg-surface-100 shadow-card-lg backdrop-blur-md border border-glass dark:border-border-default">
          <div className="flex flex-col xl:flex-row xl:items-start gap-4 xl:gap-5">
            <div
              className={`w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] rounded-full flex items-center justify-center text-brand-deep text-heading-xs sm:text-heading font-bold flex-shrink-0 shadow-glow-avatar ${m.avatarColor}`}

            >
              {m.initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                <h2
                  className="text-heading-xs sm:text-heading font-semibold text-ink truncate font-satoshi tracking-[-0.3px]">
                  {m.name}
                </h2>
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption font-semibold flex-shrink-0 ${s.bg} ${s.color}`}

                >
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-caption font-semibold flex-shrink-0 ${getSpecialtyStyle(m.specialty).bg} ${getSpecialtyStyle(m.specialty).color}`}

                >
                  {m.specialty}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1">
                <span className="flex items-center gap-1.5 text-label-md text-ink-500">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-map-pin-line text-label" /></span>
                  {m.location}
                </span>
                <span className="flex items-center gap-1.5 text-label-md text-ink-500">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-phone-line text-label" /></span>
                  {m.phone}
                </span>
              </div>
              <div className="flex flex-col gap-y-1.5 sm:flex-row sm:flex-wrap sm:items-center gap-x-3 mt-1.5">
                {allEmails.map((e, idx) => (
                  <span key={idx} className="flex items-start gap-1.5 text-label-md text-ink-500 min-w-0 max-w-full">
                    <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5"><i className="ri-mail-line text-label" /></span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-x-1 min-w-0 flex-1">
                      <span className="text-caption text-ink-400 dark:text-ink-400 font-medium whitespace-nowrap truncate max-w-[120px] sm:max-w-none" title={e.label}>{e.label}:</span>
                      <span className="truncate dark:text-ink" title={e.value}>{e.value}</span>
                    </div>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 xl:flex-shrink-0 w-full xl:w-auto mt-2 sm:mt-0">
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="flex items-center justify-center gap-1.5 px-3.5 min-h-touch rounded-card text-label font-semibold transition-all whitespace-nowrap hover:opacity-90 text-brand bg-tint-brand-soft border border-brand-mid w-full sm:w-auto">
                <i className="ri-edit-line text-body-sm" />
                Edit Manufacturer
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="flex items-center justify-center gap-1.5 px-3.5 min-h-touch rounded-card text-label font-semibold transition-all whitespace-nowrap hover:opacity-90 text-danger bg-tint-danger-soft border border-tint-danger w-full sm:w-auto"
              >
                <i className="ri-building-4-line text-body-sm" />
                Remove Manufacturer
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border-default flex items-center gap-2 text-label-sm text-ink-400 flex-wrap">
            <i className="ri-time-line text-label" />
            Avg response time: <span className="font-semibold text-ink-500">{m.avgResponseTime}</span>
            <span className="w-1 h-1 rounded-full bg-ink-200 mx-1" />
            <i className="ri-calendar-line text-label" />
            Last activity: {m.lastActivity}
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {kpis(m).map((k) => (
            <div
              key={k.label}
              className="rounded-panel p-4 flex items-center gap-3 bg-glass-90 dark:bg-surface-100 border border-glass dark:border-border-default shadow-card-elev"

            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${k.iconBg}`}

              >
                <i className={`${k.icon} text-ui-md ${k.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-heading-xs font-bold text-ink leading-none font-satoshi truncate" title={k.value}>
                  {k.value}
                </div>
                <div className="text-label-xs text-ink-400 mt-0.5 truncate" title={k.label}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <div
            className="relative w-[calc(100vw-2rem)] max-w-[420px] mx-4 rounded-sheet-lg p-5 sm:p-6 max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-100 shadow-modal-light border border-hairline dark:border-border-default">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-ui font-semibold text-ink font-satoshi">Edit Manufacturer</h3>
              <button onClick={() => setShowEdit(false)} className="touch-target rounded-full hover:bg-surface-200" aria-label="Close">
                <i className="ri-close-line text-ui-md text-ink-400" />
              </button>
            </div>

            <div className="flex flex-col gap-4 sm:gap-3">
              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                  Manufacturer Name <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Name"
                  type="text"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  className={`w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border ${errors.name ? 'border-danger-ring' : 'border-hairline'}`}
                />
                {errors.name && <p className="mt-1 text-label-xs text-red-400">{errors.name}</p>}
              </div>

              {updateError && (
                <div className="rounded-card border border-danger/20 bg-tint-danger-soft px-3 py-2 text-label-sm text-danger">
                  {updateError}
                </div>
              )}
              {deleteError && (
                <div className="rounded-card border border-danger/20 bg-tint-danger-soft px-3 py-2 text-label-sm text-danger">
                  {deleteError}
                </div>
              )}

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Specialty</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpecialtyDropdown((prev) => !prev)}
                    className="w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 flex items-center justify-between cursor-pointer bg-surface-100 font-inter border border-hairline">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-label-xs font-semibold ${specialtyStyle.bg} ${specialtyStyle.color}`}
                    >
                      {specialtyStyle.label}
                    </span>
                    <i className={`ri-arrow-down-s-line text-body-md text-ink-400 transition-transform ${showSpecialtyDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showSpecialtyDropdown && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 rounded-card-lg p-1.5 z-10 bg-white dark:bg-surface-150 shadow-pop-md border border-hairline dark:border-border-default max-h-[200px] overflow-y-auto">
                      {SPECIALTIES.map((spec) => (
                        <button
                          type="button"
                          key={spec.label}
                          onClick={() => { setEditSpecialty(spec.label); setShowSpecialtyDropdown(false); }}
                          className={`w-full text-left px-3 min-h-touch sm:min-h-0 sm:py-2 rounded text-[16px] sm:text-label font-medium flex items-center gap-2 cursor-pointer hover:bg-surface-200 transition-colors ${spec.color}`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-current" />
                          <span>{spec.label}</span>
                          {editSpecialty === spec.label && (
                            <i className="ri-check-line text-label ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                  Email Addresses <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-2">
                  {editEmails.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input aria-label="Label"
                        type="text"
                        placeholder="Label"
                        value={entry.label}
                        onChange={(e) => {
                          const next = [...editEmails];
                          next[idx].label = e.target.value;
                          setEditEmails(next);
                          setErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        className="w-[90px] sm:w-[100px] px-2 sm:px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border border-hairline"/>
                      <input aria-label="Email address"
                        type="email"
                        placeholder="Email address"
                        value={entry.value}
                        onChange={(e) => {
                          const next = [...editEmails];
                          next[idx].value = e.target.value;
                          setEditEmails(next);
                          setErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        className="flex-1 min-w-0 px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border border-hairline"/>
                      {editEmails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEditEmails(editEmails.filter((_, i) => i !== idx))}
                          className="touch-target flex items-center justify-center rounded-full hover:bg-surface-200 cursor-pointer flex-shrink-0"
                          aria-label="Remove email"
                        >
                          <i className="ri-close-line text-body-md text-ink-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEditEmails([...editEmails, { label: '', value: '' }])}
                  className="mt-2 min-h-touch flex items-center gap-1.5 px-2 -ml-2 rounded-lg text-body-sm sm:text-label-xs font-medium text-brand cursor-pointer hover:bg-brand-light transition-colors"
                >
                  <i className="ri-add-line text-body-sm" /> Add another email
                </button>
                {errors.email && <p className="mt-1 text-label-xs text-red-400">{errors.email}</p>}
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                 Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 sm:gap-3">
                  <CountryCodeSelect
                    value={phoneCountryCode}
                    onChange={(code) => {
                      setPhoneCountryCode(code);
                      const maxLen = getPhoneMaxLength(code);
                      const nextPhone = sanitizePhoneDigits(editPhone, maxLen);
                      setEditPhone(nextPhone);
                      if (nextPhone && nextPhone.length !== maxLen) {
                        setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(code) }));
                      } else {
                        setErrors((prev) => ({ ...prev, phone: undefined }));
                      }
                    }}
                    className="!bg-surface-100 !border-hairline rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 font-inter !px-3 !py-2.5"
                  />
                  <input
                    aria-label="Phone Number"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Phone Number"
                    value={editPhone}
                    maxLength={getPhoneMaxLength(phoneCountryCode)}
                    onChange={(e) => {
                      const maxLen = getPhoneMaxLength(phoneCountryCode);
                      const nextPhone = sanitizePhoneDigits(e.target.value, maxLen);
                      setEditPhone(nextPhone);
                      if (nextPhone && nextPhone.length !== maxLen) {
                        setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(phoneCountryCode) }));
                      } else {
                        setErrors((prev) => ({ ...prev, phone: undefined }));
                      }
                    }}
                    className={`flex-1 px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border min-w-0 ${errors.phone ? 'border-danger-ring' : 'border-hairline'}`}
                  />
                </div>
                {errors.phone && <p className="mt-1 text-label-xs text-red-400">{errors.phone}</p>}
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Location</label>
                <input
                  aria-label="Location"
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border border-hairline"/>
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Status</label>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                  {(['Active', 'Inactive'] as const).map((st) => {
                    const active = editStatus === st;
                    const colorMap: Record<typeof st, string> = {
                      Active: 'bg-tint-emerald-soft text-success-deep border border-emerald-ring',
                      Inactive: 'bg-tint-danger-soft text-danger border border-danger-ring',
                    };
                    return (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setEditStatus(st)}
                        className={`w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label font-medium transition-all whitespace-nowrap ${
                          active ? colorMap[st] : 'bg-surface-100 text-ink-400 border border-hairline'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-2.5 mt-6 sm:mt-5">
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card-lg text-[16px] sm:text-body-sm font-semibold text-ink-500 cursor-pointer hover:bg-surface-200 transition-colors border border-hairline-light">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateStatus === 'loading'}
                className="w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card-lg text-[16px] dark:text-black sm:text-body-sm font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity bg-gradient-brand-violet shadow-glow-brand-deep disabled:opacity-60 disabled:cursor-not-allowed">
                {updateStatus === 'loading' ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div
            className="relative w-[calc(100vw-2rem)] max-w-[380px] mx-4 rounded-sheet-lg p-5 sm:p-6 bg-white dark:bg-surface-100 shadow-modal-light border border-hairline dark:border-border-default">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-tint-danger-soft">
              <i className="ri-building-4-line text-heading-md text-danger" />
            </div>
            <h3 className="text-ui font-semibold text-ink text-center mb-1.5 font-satoshi">
              Remove Manufacturer?
            </h3>
            <p className="text-label-md text-ink-400 text-center mb-5 leading-relaxed">
              Are you sure you want to remove{' '}
              <span className="font-semibold text-ink-500">{m.name}</span> from your manufacturer list? This action cannot be undone.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleteStatus === 'loading'}
                className="flex-1 py-2.5 rounded-card-lg text-body-sm font-semibold text-ink-500 cursor-pointer hover:bg-surface-200 transition-colors border border-hairline-light disabled:opacity-60 disabled:cursor-not-allowed">
                Cancel
              </button>
              <button
                onClick={() => onDelete(m.id)}
                disabled={deleteStatus === 'loading'}
                className="flex-1 py-2.5 rounded-card-lg text-body-sm font-semibold text-white dark:text-black cursor-pointer hover:opacity-90 transition-opacity bg-danger shadow-glow-danger disabled:opacity-60 disabled:cursor-not-allowed">
                {deleteStatus === 'loading' ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
