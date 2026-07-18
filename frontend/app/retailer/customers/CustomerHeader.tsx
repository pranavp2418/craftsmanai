'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Customer } from '@/lib/customersData';
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

const TAGS = [
  { label: 'New Customer', color: 'text-ink-600', bg: 'bg-tint-gray-mid' },
  { label: 'VIP Client', color: 'text-violet-deep', bg: 'bg-tint-violet-deep-soft' },
  { label: 'Price-Sensitive Customer', color: 'text-warning-medium', bg: 'bg-tint-warning-strong-soft' },
  { label: 'High-Ticket Buyer', color: 'text-success-deep', bg: 'bg-tint-success-deep-soft' },
  { label: 'Repeat Customer', color: 'text-blue-600', bg: 'bg-blue-500/10' },
  { label: 'Urgent Buyer', color: 'text-danger', bg: 'bg-tint-danger-soft' },
  { label: 'Custom Design Client', color: 'text-violet-deep', bg: 'bg-tint-violet-deep-soft' },
  { label: 'Bridal Client', color: 'text-violet-deep', bg: 'bg-tint-violet-deep-soft' },
  { label: 'Repair Services Customer', color: 'text-ink-600', bg: 'bg-tint-gray-mid' },
];

export default function CustomerHeader({
  customer,
  onEdit,
  onDelete,
}: {
  customer: Customer;
  onEdit: (c: Customer) => void;
  onDelete: (id: string) => void;
}) {
  const { updateStatus, updateError, deleteStatus, deleteError } = useAppSelector(
    (state) => state.retailerCustomer
  );
  const [mounted, setMounted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(customer.name);
  const [editPhone, setEditPhone] = useState(customer.phone);
  const [editLocation, setEditLocation] = useState(customer.location);
  const [editRole, setEditRole] = useState(customer.role);
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>(customer.status);
  const [editEmails, setEditEmails] = useState<{ label: string; value: string }[]>(customer.emails?.length ? customer.emails : [{ label: 'Work', value: customer.email }]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});

  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');

  useEffect(() => {
    setMounted(true);
  }, []);

  const roleColor = useMemo(() => {
    const found = TAGS.find((t) => t.label === editRole);
    if (found) {
      return { text: found.color, bg: found.bg };
    }
    return { text: 'text-ink-600', bg: 'bg-tint-gray-mid' };
  }, [editRole]);

  useEffect(() => {
    setEditName(customer.name);
    setEditLocation(customer.location);
    setEditRole(customer.role);
    setEditStatus(customer.status);
    setEditEmails(customer.emails?.length ? customer.emails : [{ label: 'Work', value: customer.email }]);
    setErrors({});
    const parsed = parsePhoneNumber(customer.phone);
    setPhoneCountryCode(parsed.countryCode);
    setEditPhone(parsed.digits);
  }, [customer]);

  const validate = () => {
    const nextErrors: { name?: string; email?: string; phone?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\d\s()+-]{7,20}$/;
    const validEmails = editEmails
      .map((entry) => entry.value.trim())
      .filter(Boolean);

    if (!editName.trim()) {
      nextErrors.name = 'Full name is required.';
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

  const handleSave = () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const primaryEmail =
      editEmails.map((entry) => entry.value.trim()).find(Boolean) ?? customer.email;
    onEdit({
      ...customer,
      name: editName.trim(),
      phone: `${phoneCountryCode}${sanitizePhoneDigits(editPhone, getPhoneMaxLength(phoneCountryCode))}`,
      location: editLocation,
      role: editRole,
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

  return (
    <>
      <div
        className="rounded-sheet p-4 sm:p-6 mb-5 bg-gradient-surface dark:bg-none dark:bg-surface-100 shadow-card-lg backdrop-blur-md border border-glass dark:border-border-default">
        <div className="flex flex-col xl:flex-row xl:items-start gap-4 xl:gap-5">
          <div className="relative flex-shrink-0">
            <div
              className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center text-brand-deep text-heading sm:text-heading-md font-bold shadow-glow-avatar bg-surface-avatar-blue"

            >
              {customer.initials}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-gradient-brand-violet shadow-glow-brand-pin"

            >
              <i className="ri-vip-crown-line text-caption-2xs text-white" />
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h2 className="text-heading-xs sm:text-heading font-semibold text-ink truncate font-satoshi tracking-[-0.3px]">
                {customer.name}
              </h2>
              <span
                className="px-2.5 py-0.5 rounded-full text-caption font-semibold flex-shrink-0 text-brand bg-tint-brand">
                {customer.role}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              {(customer.emails?.length ? customer.emails : [{ label: 'Work', value: customer.email }]).map((e, idx, arr) => (
                <div key={idx} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="flex items-center gap-1 text-label-md text-ink-500 min-w-0">
                    <span className="w-4 h-4 flex items-center justify-center flex-shrink-0"><i className="ri-mail-line text-label" /></span>
                    <span className="text-caption text-ink-400 font-medium">{e.label}:</span>
                    <span className="truncate">{e.value}</span>
                  </span>
                  {idx === arr.length - 1 && customer.phone && (
                    <span className="flex items-center gap-1.5 text-label-md text-ink-500">
                      <span className="w-4 h-4 flex items-center justify-center"><i className="ri-phone-line text-label" /></span>
                      {customer.phone}
                    </span>
                  )}
                </div>
              ))}
              {customer.location && (
                <span className="flex items-center gap-1.5 text-label-md text-ink-500">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-map-pin-line text-label" /></span>
                  {customer.location}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap xl:flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 min-h-touch w-full sm:w-auto rounded-card text-label font-semibold transition-all whitespace-nowrap hover:opacity-90 text-brand bg-tint-brand-soft border border-brand-mid">
              <i className="ri-edit-line text-body-sm" />
              Edit Client
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 min-h-touch w-full sm:w-auto rounded-card text-label font-semibold transition-all whitespace-nowrap hover:opacity-90 text-danger bg-tint-danger-soft border border-tint-danger"

            >
              <i className="ri-user-unfollow-line text-body-sm" />
              Remove Client
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border-default flex items-center gap-2 text-label-sm text-ink-400 flex-wrap">
          <i className="ri-calendar-line text-label" />
          Client since {customer.addedDate}
          <span className="w-1 h-1 rounded-full bg-ink-200 mx-1" />
          <i className="ri-time-line text-label" />
          Last interaction: {customer.lastInteraction}
        </div>
      </div>

      {mounted && showEdit && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <div
            className="relative w-[calc(100vw-2rem)] max-w-[420px] rounded-[18px] sm:rounded-sheet-lg p-5 sm:p-6 max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-100 shadow-modal-light border border-hairline dark:border-border-default">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-ui font-semibold text-ink font-satoshi">Edit Client</h3>
              <button type="button" onClick={() => setShowEdit(false)} className="touch-target rounded-full hover:bg-surface-200" aria-label="Close">
                <i className="ri-close-line text-ui-md text-ink-400"></i>
              </button>
            </div>

            <div className="flex flex-col gap-4 sm:gap-3">
              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                  Full Name <span className="text-red-500">*</span>
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
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Client Tag</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown((prev) => !prev)}
                    className="w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 flex items-center justify-between cursor-pointer bg-surface-100 font-inter border border-hairline">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-label-xs font-semibold ${roleColor.bg} ${roleColor.text}`}
                    >
                      {editRole}
                    </span>
                    <i className={`ri-arrow-down-s-line text-body-md text-ink-400 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`}></i>
                  </button>
                  {showRoleDropdown && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 rounded-card-lg p-1.5 z-10 bg-white dark:bg-surface-150 shadow-pop-md border border-hairline dark:border-border-default max-h-[200px] overflow-y-auto">
                      {TAGS.map((tag) => {
                        return (
                          <button
                            key={tag.label}
                            type="button"
                            onClick={() => { setEditRole(tag.label); setShowRoleDropdown(false); }}
                            className={`w-full text-left px-3 min-h-touch sm:min-h-0 sm:py-2 rounded text-[16px] sm:text-label font-medium flex items-center gap-2 cursor-pointer hover:bg-surface-200 transition-colors ${tag.color}`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-current"></span>
                            <span>{tag.label}</span>
                            {editRole === tag.label && (
                              <i className="ri-check-line text-label ml-auto"></i>
                            )}
                          </button>
                        );
                      })}
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
                        className="flex-1 px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border border-hairline min-w-0"/>
                      {editEmails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEditEmails(editEmails.filter((_, i) => i !== idx))}
                          className="touch-target flex items-center justify-center rounded-full hover:bg-surface-200 cursor-pointer flex-shrink-0"
                          aria-label="Remove email"
                        >
                          <i className="ri-close-line text-body-md text-ink-400"></i>
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
                  <i className="ri-add-line text-body-sm"></i> Add another email
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
                  <button
                    type="button"
                    onClick={() => setEditStatus('active')}
                    className={`w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label font-medium cursor-pointer transition-all ${editStatus === 'active' ? 'bg-tint-emerald-soft text-success-deep border border-emerald-ring' : 'bg-surface-100 text-ink-400 border border-hairline'}`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus('inactive')}
                    className={`w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label font-medium cursor-pointer transition-all ${editStatus === 'inactive' ? 'bg-tint-danger-soft text-danger border border-danger-ring' : 'bg-surface-100 text-ink-400 border border-hairline'}`}
                  >
                    Inactive
                  </button>
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
                className="w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card-lg text-[16px] sm:text-body-sm font-semibold text-white dark:text-black cursor-pointer hover:opacity-90 transition-opacity bg-gradient-brand-violet shadow-glow-brand-deep disabled:opacity-60 disabled:cursor-not-allowed">
                {updateStatus === 'loading' ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {mounted && showConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div
            className="relative w-[calc(100vw-2rem)] max-w-[380px] rounded-[18px] sm:rounded-sheet-lg p-5 sm:p-6 bg-white dark:bg-surface-100 shadow-modal-light border border-hairline dark:border-border-default">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-tint-danger-soft">
              <i className="ri-user-unfollow-line text-heading-md text-danger"></i>
            </div>
            <h3 className="text-ui font-semibold text-ink text-center mb-1.5 font-satoshi">Remove Client?</h3>
            <p className="text-label-md text-ink-400 text-center mb-5 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-ink-500">{customer.name}</span> from your client list? This action cannot be undone.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleteStatus === 'loading'}
                className="w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card-lg text-[16px] sm:text-body-sm font-semibold text-ink-500 cursor-pointer hover:bg-surface-200 transition-colors border border-hairline-light disabled:opacity-60 disabled:cursor-not-allowed">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onDelete(customer.id)}
                disabled={deleteStatus === 'loading'}
                className="w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card-lg text-[16px] sm:text-body-sm font-semibold text-white dark:text-black cursor-pointer hover:opacity-90 transition-opacity bg-danger shadow-glow-danger disabled:opacity-60 disabled:cursor-not-allowed">
                {deleteStatus === 'loading' ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
