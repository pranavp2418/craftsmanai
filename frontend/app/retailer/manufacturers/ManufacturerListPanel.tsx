'use client';

import { useState, useEffect, useRef } from 'react';
import { Manufacturer, SPECIALTIES } from '@/lib/manufacturersData';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { createManufacturer, listManufacturers, resetManufacturers } from '@/redux/slices/retailer/manufacturerSlice';
import CountryCodeSelect from '@/src/utils/components/CountryCodeSelect';

import { getPhoneMaxLength, getPhoneLengthMessage, sanitizePhoneDigits } from '@/lib/formValidation';


interface AddForm {
  name: string;
  emails: { label: string; email: string }[];
  phone: string;
  location: string;
  specialty: string;
  is_active: boolean;
}

interface Props {
  manufacturers: Manufacturer[];
  selectedId: string;
  onSelect: (m: Manufacturer) => void;
  onAdd: (m: Manufacturer) => void;
}

const statusDot: Record<Manufacturer['status'], string> = {
  Active: 'bg-success-medium',
  Inactive: 'bg-ink-300',
};

const statusStyle: Record<Manufacturer['status'], { bg: string; color: string }> = {
  Active: { bg: 'bg-tint-emerald', color: 'text-success-deep' },
  Inactive: { bg: 'bg-tint-gray', color: 'text-ink-500' },
};

type Filter = 'All' | 'Active' | 'Inactive';

function formatShortDate(value?: string): string {
  if (!value) return '—';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const [, year, monthStr, dayStr] = match;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(monthStr, 10) - 1;
  const month = months[monthIdx] || monthStr;
  const day = parseInt(dayStr, 10);
  return `${month} ${day}, ${year}`;
}

function mapManufacturerStatus(status?: string): Manufacturer['status'] {
  const normalized = (status ?? '').toLowerCase();
  if (normalized.includes('inactive') || normalized.includes('delay')) return 'Inactive';
  return 'Active';
}

function getSpecialtyStyle(label: string) {
  const found = SPECIALTIES.find((s) => s.label === label);
  return found ?? { label, color: 'text-ink-500', bg: 'bg-tint-gray-soft' };
}

export default function ManufacturerListPanel({ manufacturers, selectedId, onSelect, onAdd }: Props) {
  const dispatch = useAppDispatch();
  const isFetchingRef = useRef(false);
  const { createStatus, createError, listStatus, listError, items, total } = useAppSelector(
    (state) => state.retailerManufacturer
  );
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState(SPECIALTIES[0]);
  const [form, setForm] = useState<AddForm>({
    name: '',
    emails: [{ label: 'Work', email: '' }],
    phone: '',
    location: '',
    specialty: SPECIALTIES[0].label,
    is_active: true,
  });
  const [mounted, setMounted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async () => {
    setSubmitError(null);
    setErrors({});
    const errs: Record<string, string> = {};

    if (!form.name.trim()) {
      errs.name = 'Name is required';
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.name.trim())) {
      errs.name = 'Manufacturer Name cannot be an email address';
    }
    const validEmails = form.emails.filter((em) => em.email.trim());
    if (validEmails.length === 0) {
      errs.email = 'At least one email is required';
    } else {
      const invalid = validEmails.find((em) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.email.trim()));
      if (invalid) {
        errs.email = `Invalid email format: ${invalid.email.trim()}`;
      }
    }

    const phoneMaxLength = getPhoneMaxLength(phoneCountryCode);
    const normalizedPhone = sanitizePhoneDigits(form.phone, phoneMaxLength);
    if (!normalizedPhone) {
      errs.phone = 'Phone number is required.';
    } else if (normalizedPhone.length !== phoneMaxLength) {
      errs.phone = getPhoneLengthMessage(phoneCountryCode);
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const combinedPhone = `${phoneCountryCode}${normalizedPhone}`;

    const payload = {
      name: form.name.trim(),
      speciality: selectedSpecialty.label,
      emails: form.emails
        .map((e) => ({ label: e.label.trim(), email: e.email.trim() }))
        .filter((e) => e.label || e.email),
      phone_number: combinedPhone,
      location: form.location.trim(),
      is_active: form.is_active,
    };

    try {
      const response = await dispatch(createManufacturer(payload)).unwrap();
      const initials = response.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      const primaryEmail = response.emails?.[0]?.email || payload.emails[0]?.email || '';
      const newManufacturer: Manufacturer = {
        id: `m${response.id}`,
        name: response.name,
        initials,
        avatarColor: 'bg-surface-avatar-blue',
        email: primaryEmail,
        emails: response.emails?.map((e) => ({ label: e.label, value: e.email })) ?? [],
        phone: response.phone_number || payload.phone_number,
        location: response.location || payload.location,
        specialty: response.speciality || payload.speciality,
        status: mapManufacturerStatus(response.status),
        lastActivity: formatShortDate(response.updated_at || response.created_at),
        totalRequests: 0,
        completedRequests: 0,
        pendingRequests: 0,
        totalProfit: '$0',
        avgResponseTime: '—',
        requests: [],
      };

      onAdd(newManufacturer);
      setForm({ name: '', emails: [{ label: 'Work', email: '' }], phone: '', location: '', specialty: SPECIALTIES[0].label, is_active: true });
      setPhoneCountryCode('+1');
      setSelectedSpecialty(SPECIALTIES[0]);
      setShowAdd(false);
    } catch (err: any) {
      setSubmitError(String(err || 'Failed to create manufacturer'));
    }
  };

  const normalizedStatus = filter === 'All'
    ? undefined
    : filter === 'Active'
      ? 'Active'
      : 'Inactive';

  useEffect(() => {
    dispatch(resetManufacturers());
    isFetchingRef.current = true;
    const timer = window.setTimeout(() => {
      dispatch(listManufacturers({
        skip: 0,
        limit: 10,
        search: search.trim() || undefined,
        status: normalizedStatus,
      })).then(() => {
        isFetchingRef.current = false;
      }).catch(() => {
        isFetchingRef.current = false;
      });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      isFetchingRef.current = false;
    };
  }, [dispatch, search, normalizedStatus]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 30) {
      if (listStatus !== 'loading' && !isFetchingRef.current && items && items.length < total) {
        isFetchingRef.current = true;
        dispatch(
          listManufacturers({
            skip: items.length,
            limit: 10,
            search: search.trim() || undefined,
            status: normalizedStatus,
            append: true,
          })
        ).then(() => {
          isFetchingRef.current = false;
        }).catch(() => {
          isFetchingRef.current = false;
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-body-sm font-semibold text-ink dark:text-[#E7EAEE]  tracking-widest font-satoshi">
            Manufacturers
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-caption-xs font-semibold bg-surface-200 text-ink-500">
              {manufacturers.length}
            </span>
          </h2>
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0 rounded-full hover:opacity-90 transition-opacity bg-gradient-brand-violet shadow-pill-md" title="Add manufacturer"
          >
            <i className="ri-add-line text-white dark:text-black text-body-md" />
          </button>
        </div>
        <div className="relative mb-3">
          <span className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-body-md w-4 h-4 flex items-center justify-center" />
          <input aria-label="Search manufacturers…"
            type="text"
            placeholder="Search manufacturers…"
            value={search}
            onChange={(e) => setSearch(e.target.value.trimStart())}
            onBlur={() => setSearch(search.trim())}
            className="w-full pl-8 pr-3 min-h-touch sm:min-h-0 sm:py-2 rounded-xl text-body-md sm:text-label-md text-ink placeholder-stone-350 dark:placeholder:text-ink-400 max-sm:placeholder:text-[12px] outline-none focus:ring-2 focus:ring-brand/30 bg-surface-200 dark:bg-surface-200 border border-black/[0.06] dark:border-border-default transition-colors"
          />
        </div>
        <div className="flex gap-1.5 p-1 rounded-full bg-surface-150 border border-black/[0.04] dark:border-border-default">
          {(['All', 'Active', 'Inactive'] as Filter[]).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 min-h-touch sm:min-h-0 sm:py-1 text-label-sm font-semibold rounded-full transition-all duration-150 whitespace-nowrap ${filter === f
                ? 'bg-white dark:bg-surface-300 text-ink shadow-subtle-micro'
                : 'text-[#9CA3AF] dark:text-[#A1A8B3]'
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-surface-300 mb-3" />

      <div className="flex-1 overflow-y-auto min-h-0 px-1" onScroll={handleScroll}>
        {((listStatus === 'loading' || listStatus === 'idle') && manufacturers.length === 0) ? (
          <div className="flex flex-col" aria-busy="true" aria-label="Loading manufacturers">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className={
                  `w-full text-left px-3 py-3 transition-all duration-150 border-l-[3px] border-l-transparent ` +
                  (index !== 6 ? 'border-b border-border-default' : '')
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full skeleton-shimmer flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-3.5 w-40 rounded-card skeleton-shimmer" />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full skeleton-shimmer flex-shrink-0" />
                        <div className="h-3 w-44 rounded-card skeleton-shimmer" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="h-4 w-20 rounded-full skeleton-shimmer" />
                      <div className="h-3 w-12 rounded-card skeleton-shimmer" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : listError ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-full mb-3 bg-tint-danger-soft">
              <i className="ri-alert-line text-heading-xs text-danger" />
            </div>
            <p className="text-label text-danger">{listError}</p>
          </div>
        ) : (
          <>
            {manufacturers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 flex items-center justify-center rounded-full mb-3 bg-surface-200">
                  <i className="ri-building-2-line text-heading-xs text-ink-300" />
                </div>
                <p className="text-label text-ink-400">No manufacturers found</p>
              </div>
            ) : (
              mounted && manufacturers.map((m, index) => {
                const isSelected = m.id === selectedId;
                const specialtyStyle = getSpecialtyStyle(m.specialty);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => onSelect(m)}
                    className={`w-full text-left px-3 py-3 transition-all duration-150 border-l-[3px] ${index !== manufacturers.length - 1 ? 'border-b border-border-default' : ''
                      } ${isSelected
                        ? 'bg-tint-brand-faint border-l-brand'
                        : 'border-l-transparent hover:bg-surface-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 min-w-9 min-h-9 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-brand-deep ${m.avatarColor}`}
                      >
                        {m.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="text-body-sm font-semibold text-ink truncate font-satoshi">
                            {m.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[m.status]}`}
                            />
                            <span className="text-label-xs text-ink-400 max-w-52 break-all">
                              {m.email}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-caption-xs text-nowrap font-semibold ${specialtyStyle.bg} ${specialtyStyle.color}`}
                          >
                            {m.specialty}
                          </span>
                          <span className="text-caption text-stone-350">{m.totalRequests} req</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {/* Bottom Shimmer for infinite scroll */}
            {listStatus === 'loading' && manufacturers.length > 0 && (
              <div className="flex flex-col py-2 animate-pulse" aria-busy="true">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="w-full text-left px-3 py-3 border-b border-border-default opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-surface-300 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 bg-gray-200 dark:bg-surface-300 rounded" />
                        <div className="h-2.5 w-1/2 bg-gray-200 dark:bg-surface-300 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div
            className="relative w-[calc(100vw-2rem)] max-w-[400px] mx-4 rounded-sheet-lg p-5 sm:p-6 max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-100 shadow-modal-light border border-hairline dark:border-border-default">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-ui font-semibold text-ink font-satoshi">Add Manufacturer</h3>
              <button onClick={() => setShowAdd(false)} className="touch-target rounded-full hover:bg-surface-200">
                <i className="ri-close-line text-ui-md text-ink-400" />
              </button>
            </div>
            <div className="flex flex-col gap-4 sm:gap-3">


              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                  Manufacturer Name <span className="text-red-500">*</span>
                </label>
                <input aria-label="e.g. ArtisanGold Co."
                  type="text"
                  placeholder="e.g. ArtisanGold Co."
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  className={`w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 ${errors.name ? 'border-1.5 border-danger-bright shadow-glow-danger-ring' : 'border border-hairline'}`} />
                {errors.name && (
                  <p className="text-[12px] text-danger mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Specialty</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpecialtyDropdown((prev) => !prev)}
                    className="w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 flex items-center justify-between cursor-pointer bg-surface-100 font-inter border border-hairline">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-label-xs font-semibold ${selectedSpecialty.bg} ${selectedSpecialty.color}`}
                    >
                      {selectedSpecialty.label}
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
                          onClick={() => { setSelectedSpecialty(spec); setForm({ ...form, specialty: spec.label }); setShowSpecialtyDropdown(false); }}
                          className={`w-full text-left px-3 min-h-touch sm:min-h-0 sm:py-2 rounded text-[16px] sm:text-label font-medium flex items-center gap-2 cursor-pointer hover:bg-surface-200 transition-colors ${spec.color}`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-current" />
                          <span>{spec.label}</span>
                          {selectedSpecialty.label === spec.label && (
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
                  {form.emails.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input aria-label="Label"
                        type="text"
                        placeholder="Label"
                        value={entry.label}
                        onChange={(e) => {
                          const next = [...form.emails];
                          next[idx].label = e.target.value;
                          setForm({ ...form, emails: next });
                        }}
                        className="w-[90px] sm:w-[100px] px-2 sm:px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 border border-hairline" />
                      <input aria-label="Email address"
                        type="email"
                        placeholder="Email address"
                        value={entry.email}
                        onChange={(e) => {
                          const next = [...form.emails];
                          next[idx].email = e.target.value;
                          setForm({ ...form, emails: next });
                          setErrors((prev) => ({ ...prev, email: '' }));
                        }}
                        className={`flex-1 px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 min-w-0 ${errors.email ? 'border-1.5 border-danger-bright shadow-glow-danger-ring' : 'border border-hairline'}`} />
                      {form.emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, emails: form.emails.filter((_, i) => i !== idx) })}
                          className="touch-target rounded-full hover:bg-surface-200 flex-shrink-0"
                          aria-label="Remove email"
                        >
                          <i className="ri-close-line text-body-md text-ink-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {errors.email && (
                  <p className="text-[12px] text-danger mt-1">{errors.email}</p>
                )}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, emails: [...form.emails, { label: '', email: '' }] })}
                  className="mt-2 min-h-touch flex items-center gap-1.5 px-2 -ml-2 rounded-lg text-body-sm sm:text-label-xs font-medium text-brand cursor-pointer hover:bg-brand-light transition-colors"
                >
                  <i className="ri-add-line text-body-sm" /> Add another email
                </button>
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 sm:gap-3">
                  <CountryCodeSelect
                    value={phoneCountryCode}
                    onChange={(code) => {
                      setPhoneCountryCode(code);
                      const maxLen = getPhoneMaxLength(code);
                      const sanitized = sanitizePhoneDigits(form.phone, maxLen);
                      setForm((prev) => ({ ...prev, phone: sanitized }));
                      if (sanitized && sanitized.length !== maxLen) {
                        setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(code) }));
                      } else {
                        setErrors((prev) => ({ ...prev, phone: '' }));
                      }
                    }}
                    className="!bg-surface-100 !border-hairline rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 font-inter !px-3 !py-2.5"
                  />
                  <input aria-label="Contact Number"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Contact Number"
                    value={form.phone}
                    maxLength={getPhoneMaxLength(phoneCountryCode)}
                    onChange={(e) => {
                      const maxLen = getPhoneMaxLength(phoneCountryCode);
                      const sanitized = sanitizePhoneDigits(e.target.value, maxLen);
                      setForm((prev) => ({ ...prev, phone: sanitized }));
                      if (sanitized && sanitized.length !== maxLen) {
                        setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(phoneCountryCode) }));
                      } else {
                        setErrors((prev) => ({ ...prev, phone: '' }));
                      }
                    }}
                    className={`flex-1 px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 border min-w-0 ${errors.phone ? 'border-1.5 border-danger-bright shadow-glow-danger-ring' : 'border-hairline'}`} />
                </div>
                {errors.phone && (
                  <p className="text-[12px] text-danger mt-1">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                  Location <span className="normal-case font-normal text-stone-300">(optional)</span>
                </label>
                <input aria-label="e.g. Milan, Italy"
                  type="text"
                  placeholder="e.g. Milan, Italy"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 border border-hairline" />
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Status</label>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_active: true })}
                    className={`w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label font-medium cursor-pointer transition-all ${form.is_active ? 'bg-tint-emerald-soft text-success-deep border border-emerald-ring' : 'bg-surface-100 text-ink-400 border border-hairline'}`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_active: false })}
                    className={`w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label font-medium cursor-pointer transition-all ${!form.is_active ? 'bg-tint-danger-soft text-danger border border-danger-ring' : 'bg-surface-100 text-ink-400 border border-hairline'}`}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              {(submitError || createError) && (
                <div className="rounded-card border border-danger/20 bg-tint-danger-soft px-3 py-2 text-label-sm text-danger">
                  {submitError || createError}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createStatus === 'loading'}
              className="w-full mt-6 sm:mt-5 min-h-touch sm:min-h-0 sm:py-3 rounded-card-lg text-[16px] sm:text-body-sm font-semibold text-white dark:text-black cursor-pointer hover:opacity-90 transition-opacity bg-gradient-brand-violet shadow-glow-brand-deep disabled:opacity-60 disabled:cursor-not-allowed">
              {createStatus === 'loading' ? 'Adding…' : 'Add Manufacturer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
