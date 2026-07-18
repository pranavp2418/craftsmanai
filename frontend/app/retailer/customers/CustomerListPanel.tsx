'use client';

import { useEffect, useState, useRef } from 'react';
import { Customer } from '@/lib/customersData';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { createCustomer, listCustomers, resetCustomerList } from '@/redux/slices/retailer/customerSlice';
import CountryCodeSelect from '@/src/utils/components/CountryCodeSelect';
import { getPhoneMaxLength, getPhoneLengthMessage, sanitizePhoneDigits } from '@/lib/formValidation';

type Filter = 'all' | 'active' | 'inactive';

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

interface Props {
  activeId: string;
  onSelect: (id: string) => void;
  customers: Customer[];
  onAdd: (customer: Customer) => void;
}

export default function CustomerListPanel({ activeId, onSelect, customers, onAdd }: Props) {
  const dispatch = useAppDispatch();
  const { createStatus, createError, listStatus, listError, total, hasMore } = useAppSelector(
    (state) => state.retailerCustomer
  );
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [selectedTag, setSelectedTag] = useState(TAGS[0]);
  const [emails, setEmails] = useState([{ label: 'Work', email: '' }]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [newLocation, setNewLocation] = useState('');
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const lastFetchedPageRef = useRef<number | null>(null);
  const lastFetchedParamsRef = useRef<{ page: number; limit: number; search: string | undefined; status: string | undefined } | null>(null);

  const normalizedStatus = filter === 'all'
    ? undefined
    : filter === 'active'
      ? 'Active'
      : 'Inactive';

  // Debounce search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Reset list on mount
  useEffect(() => {
    dispatch(resetCustomerList());
  }, [dispatch]);

  // Initial fetch and fetch on filter/search change
  useEffect(() => {
    const params = {
      page: 1,
      limit: 15,
      search: debouncedSearch || undefined,
      status: normalizedStatus,
    };
    if (
      lastFetchedParamsRef.current &&
      lastFetchedParamsRef.current.page === params.page &&
      lastFetchedParamsRef.current.limit === params.limit &&
      lastFetchedParamsRef.current.search === params.search &&
      lastFetchedParamsRef.current.status === params.status
    ) {
      return;
    }
    lastFetchedParamsRef.current = params;
    setPage(1);
    lastFetchedPageRef.current = 1;
    dispatch(listCustomers(params));
  }, [dispatch, debouncedSearch, normalizedStatus]);

  const loadMoreCustomers = () => {
    if (listStatus === 'loading' || !hasMore || customers.length >= total) return;
    const nextPage = page + 1;
    if (lastFetchedPageRef.current === nextPage) return;
    lastFetchedPageRef.current = nextPage;
    setPage(nextPage);
    const params = {
      page: nextPage,
      limit: 15,
      search: debouncedSearch || undefined,
      status: normalizedStatus,
      append: true,
    };
    lastFetchedParamsRef.current = { page: nextPage, limit: 15, search: debouncedSearch || undefined, status: normalizedStatus };
    dispatch(listCustomers(params));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight > target.clientHeight) {
      const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 45;
      if (isNearBottom && target.scrollTop > 0) {
        loadMoreCustomers();
      }
    }
  };

  const pills: { label: string; value: Filter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  const handleAdd = async () => {
    setSubmitError(null);
    setErrors({});
    const errs: Record<string, string> = {};

    if (!newName.trim()) {
      errs.name = 'Customer name is required';
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newName.trim())) {
      errs.name = 'Full Name cannot be an email address';
    }

    const validEmails = emails.filter((e) => e.email.trim());
    if (validEmails.length === 0) {
      errs.email = 'At least one email is required';
    } else {
      const invalid = validEmails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email.trim()));
      if (invalid) {
        errs.email = `Invalid email: ${invalid.email.trim()}`;
      }
    }

    const phoneMaxLength = getPhoneMaxLength(phoneCountryCode);
    const normalizedPhone = sanitizePhoneDigits(newPhone, phoneMaxLength);
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
    const status: 'Active' | 'Inactive' = newStatus === 'active' ? 'Active' : 'Inactive';

    const payload = {
      full_name: newName.trim(),
      tag: selectedTag.label,
      emails: emails
        .map((e) => ({ label: e.label.trim(), email: e.email.trim() }))
        .filter((e) => e.label || e.email),
      phone_number: combinedPhone,
      location: newLocation.trim(),
      status,
    };

    try {
      const response = await dispatch(createCustomer(payload)).unwrap();
      const initials = response.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      const primaryEmail = response.emails?.[0]?.email || payload.emails?.[0]?.email || '';
      const createdDate = response.created_at
        ? new Date(response.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const newCustomer: Customer = {
        id: `c${response.id}`,
        name: response.full_name,
        initials,
        avatarColor: 'bg-surface-avatar-blue',
        email: primaryEmail,
        emails: response.emails?.map((e) => ({ label: e.label, value: e.email })) ?? [],
        phone: response.phone_number || payload.phone_number,
        location: response.location || payload.location,
        role: response.tag || payload.tag,
        addedDate: createdDate,
        totalRequests: 0,
        activeProjects: 0,
        lastInteraction: '-',
        totalSpent: '$0',
        status: response.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
        projects: [],
        activity: [],
        avatar: '',
      };

      onAdd(newCustomer);
      setNewName('');
      setNewPhone('');
      setPhoneCountryCode('+1');
      setNewLocation('');
      setEmails([{ label: 'Work', email: '' }]);
      setSelectedTag(TAGS[0]);
      setNewStatus('active');
      setShowAdd(false);
    } catch (err: any) {
      setSubmitError(String(err || 'Failed to create customer'));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <span className="text-body-sm font-semibold text-ink dark:text-[#E7EAEE] font-satoshi">
          Customers
          <span className="ml-2 px-1.5 py-0.5 rounded-full text-caption-xs font-semibold bg-surface-200 text-ink-500">
            {customers.length}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          aria-label="Add customer"
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0 rounded-full hover:opacity-90 transition-opacity bg-gradient-brand-violet shadow-pill-md">
          <i className="ri-add-line text-white dark:text-black text-ui-md" />
        </button>
      </div>

      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <i className="ri-search-line text-body-sm text-ink-300" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value.trimStart())}
          onBlur={() => setSearch(search.trim())}
          placeholder="Search customers…"
          aria-label="Search customers"
          className="w-full pl-8 pr-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-body-md sm:text-label text-ink placeholder:text-ink-300 max-sm:placeholder:text-[12px] outline-none focus:ring-2 focus:ring-brand/30 bg-surface-200 dark:bg-surface-200 border border-black/[0.06] dark:border-border-default font-inter" />
      </div>

      <div className="flex items-center gap-1.5 mb-4 p-1 rounded-full bg-surface-200 border border-black/[0.04] dark:border-border-default">
        {pills.map((pill) => (
          <button
            type="button"
            key={pill.value}
            onClick={() => setFilter(pill.value)}
            aria-pressed={filter === pill.value}
            className={`flex-1 min-h-touch sm:min-h-0 sm:py-1 rounded-full text-label-xs font-semibold transition-all duration-150 whitespace-nowrap ${filter === pill.value
              ? 'bg-white dark:bg-surface-300 text-ink shadow-subtle-micro'
              : 'text-[#9CA3AF] dark:text-[#A1A8B3]'
              }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className="w-full h-px bg-surface-300 mb-3" />

      <div
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto flex flex-col pr-0.5 min-h-0"
      >
        {/* Render customers if loaded */}
        {customers.map((c, index) => {
          const isActive = c.id === activeId;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`flex items-center gap-3 px-3 min-h-touch py-2 sm:py-2.5 transition-all duration-150 w-full text-left border-l-[3px] ${index !== customers.length - 1 ? 'border-b border-border-default' : ''
                } ${isActive
                  ? 'bg-brand-light dark:bg-blue-500/10 border-l-brand'
                  : 'border-l-transparent hover:bg-surface-50 dark:hover:bg-surface-150'
                }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-brand-deep text-label font-bold bg-[${c.avatarColor}]`}
              >
                {c.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-label-md font-semibold text-ink dark:text-ink truncate font-satoshi">
                  {c.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === 'active' ? 'bg-success-medium' : 'bg-ink-200'}`}
                  />
                  <p className="text-label-xs text-[#9CA3AF] dark:text-[#A1A8B3] truncate">{c.email}</p>
                </div>
              </div>
            </button>
          );
        })}

        {/* Initial loading skeletons */}
        {(listStatus === 'loading' || listStatus === 'idle') && customers.length === 0 && (
          <div className="flex flex-col" aria-busy="true" aria-label="Loading customers">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className={
                  `flex items-center gap-3 px-3 min-h-touch py-2 sm:py-2.5 border-l-[3px] border-l-transparent ` +
                  (index !== 7 ? 'border-b border-border-default' : '')
                }
              >
                <div className="w-9 h-9 rounded-full skeleton-shimmer flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3.5 w-32 rounded-card skeleton-shimmer mb-2" />
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full skeleton-shimmer flex-shrink-0" />
                    <div className="h-3 w-44 rounded-card skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more appended skeletons */}
        {listStatus === 'loading' && customers.length > 0 && (
          <div className="flex flex-col border-t border-border-default">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 px-3 min-h-touch py-2 sm:py-2.5 border-l-[3px] border-l-transparent border-b border-border-default last:border-b-0"
              >
                <div className="w-9 h-9 rounded-full skeleton-shimmer flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3.5 w-32 rounded-card skeleton-shimmer mb-2" />
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full skeleton-shimmer flex-shrink-0" />
                    <div className="h-3 w-44 rounded-card skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {listStatus !== 'loading' && listError && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-full mb-3 bg-tint-danger-soft">
              <i className="ri-alert-line text-heading-xs text-danger" />
            </div>
            <p className="text-label text-danger">{listError}</p>
          </div>
        )}

        {/* Empty state */}
        {listStatus === 'succeeded' && customers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-full mb-3 bg-surface-200">
              <i className="ri-user-search-line text-heading-xs text-ink-300" />
            </div>
            <p className="text-label text-[#9CA3AF] dark:text-[#A1A8B3]">No customers found</p>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div
            className="relative w-[calc(100vw-2rem)] max-w-[400px] rounded-[18px] sm:rounded-sheet-lg p-5 sm:p-6 max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-100 shadow-modal-light border border-hairline dark:border-border-default">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-ui font-semibold text-ink font-satoshi">Add Customer</h3>
              <button type="button" onClick={() => setShowAdd(false)} aria-label="Close" className="touch-target rounded-full hover:bg-surface-200">
                <i className="ri-close-line text-heading-xs text-ink-400" />
              </button>
            </div>
            <div className="flex flex-col gap-4 sm:gap-3">
              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input aria-label="Full Name"
                  type="text"
                  placeholder="Full Name"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  className={`w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter ${errors.name ? 'border-1.5 border-danger-bright shadow-glow-danger-ring' : 'border border-hairline'}`} />
                {errors.name && (
                  <p className="text-[12px] text-danger mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Customer Tag</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTagDropdown((prev) => !prev)}
                    className="w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 flex items-center justify-between cursor-pointer bg-surface-100 font-inter border border-hairline">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-label-xs font-semibold ${selectedTag.bg} ${selectedTag.color}`}
                    >
                      {selectedTag.label}
                    </span>
                    <i className={`ri-arrow-down-s-line text-body-md text-ink-400 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`}></i>
                  </button>
                  {showTagDropdown && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 rounded-card-lg p-1.5 z-10 bg-white dark:bg-surface-150 shadow-pop-md border border-hairline dark:border-border-default max-h-[200px] overflow-y-auto">
                      {TAGS.map((tag) => (
                        <button
                          key={tag.label}
                          type="button"
                          onClick={() => { setSelectedTag(tag); setShowTagDropdown(false); }}
                          className={`w-full text-left px-3 min-h-touch sm:min-h-0 sm:py-2 rounded text-[16px] sm:text-label font-medium flex items-center gap-2 cursor-pointer hover:bg-surface-200 transition-colors ${tag.color}`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-current"></span>
                          <span>{tag.label}</span>
                          {selectedTag.label === tag.label && (
                            <i className="ri-check-line text-label ml-auto"></i>
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
                  {emails.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input aria-label="Label"
                        type="text"
                        placeholder="Label"
                        value={entry.label}
                        onChange={(e) => {
                          const next = [...emails];
                          next[idx].label = e.target.value;
                          setEmails(next);
                        }}
                        className="w-[90px] sm:w-[100px] px-2 sm:px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border border-hairline" />
                      <input aria-label="Email address"
                        type="email"
                        placeholder="Email address"
                        value={entry.email}
                        onChange={(e) => {
                          const next = [...emails];
                          next[idx].email = e.target.value;
                          setEmails(next);
                          setErrors((prev) => ({ ...prev, email: '' }));
                        }}
                        className={`flex-1 px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter min-w-0 ${errors.email ? 'border-1.5 border-danger-bright shadow-glow-danger-ring' : 'border border-hairline'}`} />
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEmails(emails.filter((_, i) => i !== idx))}
                          className="touch-target rounded-full hover:bg-surface-200 flex-shrink-0"
                          aria-label="Remove email"
                        >
                          <i className="ri-close-line text-body-md text-ink-400"></i>
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
                  onClick={() => setEmails([...emails, { label: '', email: '' }])}
                  className="mt-2 min-h-touch flex items-center gap-1.5 px-2 -ml-2 rounded-lg text-body-sm sm:text-label-xs font-medium text-brand cursor-pointer hover:bg-brand-light transition-colors"
                >
                  <i className="ri-add-line text-body-sm"></i> Add another email
                </button>
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
                      const nextPhone = sanitizePhoneDigits(newPhone, maxLen);
                      setNewPhone(nextPhone);
                      if (nextPhone && nextPhone.length !== maxLen) {
                        setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(code) }));
                      } else {
                        setErrors((prev) => ({ ...prev, phone: '' }));
                      }
                    }}
                    className="!bg-surface-100 !border-hairline rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 font-inter !px-3 !py-2.5"
                  />
                  <input aria-label="Phone Number"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Phone Number"
                    value={newPhone}
                    maxLength={getPhoneMaxLength(phoneCountryCode)}
                    onChange={(e) => {
                      const maxLen = getPhoneMaxLength(phoneCountryCode);
                      const nextPhone = sanitizePhoneDigits(e.target.value, maxLen);
                      setNewPhone(nextPhone);
                      if (nextPhone && nextPhone.length !== maxLen) {
                        setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(phoneCountryCode) }));
                      } else {
                        setErrors((prev) => ({ ...prev, phone: '' }));
                      }
                    }}
                    className={`flex-1 px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border min-w-0 ${errors.phone ? 'border-1.5 border-danger-bright shadow-glow-danger-ring' : 'border-hairline'}`} />
                </div>
                {errors.phone && (
                  <p className="text-[12px] text-danger mt-1">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Location</label>
                <input aria-label="Location"
                  type="text"
                  placeholder="Location"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border border-hairline" />
              </div>

              <div>
                <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Status</label>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setNewStatus('active')}
                    className={`w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label font-medium cursor-pointer transition-all ${newStatus === 'active' ? 'bg-tint-emerald-soft text-success-deep border border-emerald-ring' : 'bg-surface-100 text-ink-400 border border-hairline'}`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('inactive')}
                    className={`w-full sm:flex-1 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label font-medium cursor-pointer transition-all ${newStatus === 'inactive' ? 'bg-tint-danger-soft text-danger border border-danger-ring' : 'bg-surface-100 text-ink-400 border border-hairline'}`}
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
              onClick={handleAdd}
              disabled={createStatus === 'loading'}
              className="w-full mt-6 sm:mt-5 min-h-touch sm:min-h-0 sm:py-3 rounded-card-lg text-[16px] sm:text-body-sm font-semibold text-white dark:text-black cursor-pointer hover:opacity-90 transition-opacity bg-gradient-brand-violet shadow-glow-brand-deep disabled:opacity-60 disabled:cursor-not-allowed">
              {createStatus === 'loading' ? 'Adding...' : 'Add Customer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
