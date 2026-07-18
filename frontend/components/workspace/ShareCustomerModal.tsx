'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { RequestData, statusStyles } from '@/lib/requestsData';
import { Customer } from '@/lib/customersData';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { shareVariant } from '@/redux/slices/retailer/designVariantShareSlice';
import { listCustomers, createCustomer, resetCustomerList } from '@/redux/slices/retailer/customerSlice';
import CountryCodeSelect from '@/src/utils/components/CountryCodeSelect';
import { toast } from 'react-toastify';
import { sanitizePhoneDigits, getPhoneMaxLength, getPhoneLengthMessage } from '@/lib/formValidation';


interface ShareCustomerModalProps {
  request: RequestData;
  onClose: () => void;
  onStatusChange?: () => void;
  variantId?: string | number | null;
  activeMetal?: string;
}

interface LocalAngleView {
  id: string;
  label: string;
  image: string;
}

const metalOptions = [
  { id: 'yellow', label: 'Yellow', payloadValue: 'gold', filterClass: 'metal-filter-yellow' },
  { id: 'white', label: 'White', payloadValue: 'silver', filterClass: 'metal-filter-white' },
  { id: 'rosegold', label: 'Rose Gold', payloadValue: 'rose_gold', filterClass: 'metal-filter-rose' },
];

const getMetalValue = (parsedObj: any, metalPayload: string): any => {
  if (!parsedObj || typeof parsedObj !== 'object') return null;
  const keysToTry: string[] = [];
  const norm = metalPayload.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm === 'gold') {
    keysToTry.push('gold', 'yellow', 'yg', 'yellow_gold');
  } else if (norm === 'silver') {
    keysToTry.push('silver', 'white', 'wg', 'white_gold');
  } else if (norm === 'rose_gold') {
    keysToTry.push('rose_gold', 'rosegold', 'rose', 'rg');
  } else {
    keysToTry.push(metalPayload);
  }
  for (const key of keysToTry) {
    if (parsedObj[key] !== undefined && parsedObj[key] !== null) {
      return parsedObj[key];
    }
  }
  return null;
};

const getMetalImage = (parsedObj: any, metalPayload: string): string | null => {
  const val = getMetalValue(parsedObj, metalPayload);
  if (!val) return null;
  if (typeof val === 'string' && val.length > 0) return val;
  if (typeof val === 'object') {
    return val.mainImage || val.url || val.image_url || val.image || null;
  }
  return null;
};

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'USA' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+27', flag: '🇿🇦', name: 'S. Africa' },
];

function getCustomerTag(role: string): { label: string; bgClass: string; textClass: string } {
  const norm = (role || '').trim().toLowerCase();
  if (norm.includes('vip') || norm.includes('high-ticket')) return { label: role, bgClass: 'bg-blue-500/10', textClass: 'text-blue-500' };
  if (norm.includes('price-sensitive') || norm.includes('budget')) return { label: role, bgClass: 'bg-amber-500/10', textClass: 'text-amber-600' };
  if (norm.includes('repeat')) return { label: role, bgClass: 'bg-green-500/10', textClass: 'text-green-600' };
  if (norm.includes('urgent')) return { label: role, bgClass: 'bg-red-500/10', textClass: 'text-red-600' };
  if (norm.includes('new')) return { label: role, bgClass: 'bg-slate-500/10', textClass: 'text-slate-500' };
  if (norm.includes('custom') || norm.includes('bridal')) return { label: role, bgClass: 'bg-violet-500/10', textClass: 'text-violet-600' };
  return { label: role, bgClass: 'bg-slate-500/10', textClass: 'text-slate-500' };
}

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

export default function ShareCustomerModal({ request, onClose, onStatusChange, variantId, activeMetal }: ShareCustomerModalProps) {
  const dispatch = useAppDispatch();
  const { items: apiCustomers, listStatus, total, hasMore } = useAppSelector((s) => s.retailerCustomer);
  const { items: apiItems } = useAppSelector((s) => s.retailerDesigns);
  const { variants: variantHistoryRaw } = useAppSelector((s) => s.retailerDesignVariant);

  const activeApiItem = useMemo(() => {
    if (!request.id) return null;
    const reqIdLower = String(request.id).toLowerCase();
    return apiItems.find((it) =>
      (it.design_code && it.design_code.toLowerCase() === reqIdLower) ||
      String(it.id) === reqIdLower
    ) ?? null;
  }, [apiItems, request.id]);

  const variantHistory = useMemo(() => {
    if (variantHistoryRaw && variantHistoryRaw.length > 0 && activeApiItem?.id && String(variantHistoryRaw[0]?.design_id) === String(activeApiItem.id)) {
      return variantHistoryRaw;
    }
    return activeApiItem?.variants ?? [];
  }, [variantHistoryRaw, activeApiItem]);

  const selectedVariant = useMemo(() => {
    return (variantHistory ?? []).find((v: any) => String(v.id) === String(variantId)) ?? variantHistory?.[0] ?? null;
  }, [variantHistory, variantId]);

  const selectedVariantIndex = useMemo(() => {
    return (variantHistory ?? []).findIndex((v: any) => String(v.id) === String(variantId));
  }, [variantHistory, variantId]);

  const selectedVariantName = useMemo(() => {
    return selectedVariant?.variant_name || (selectedVariantIndex !== -1 ? `V${selectedVariantIndex + 1}` : 'V1');
  }, [selectedVariant, selectedVariantIndex]);

  const activeMetalObj = useMemo(() => {
    return metalOptions.find((m) => m.id === activeMetal);
  }, [activeMetal]);

  const activeMetalPayload = useMemo(() => {
    return activeMetalObj?.payloadValue || 'gold';
  }, [activeMetalObj]);

  // Safely parse metal_variations_json
  const parsedMetalVariations = useMemo(() => {
    try {
      if (selectedVariant?.metal_variations_json) {
        if (typeof selectedVariant.metal_variations_json === 'string') {
          return JSON.parse(selectedVariant.metal_variations_json);
        } else {
          return selectedVariant.metal_variations_json;
        }
      }
    } catch (e) {
      console.error('Error parsing metal_variations_json in share modal:', e);
    }
    return null;
  }, [selectedVariant]);

  // Safely parse angles_json
  const parsedAnglesJson = useMemo(() => {
    try {
      if (selectedVariant?.angles_json) {
        if (typeof selectedVariant.angles_json === 'string') {
          return JSON.parse(selectedVariant.angles_json);
        } else {
          return selectedVariant.angles_json;
        }
      }
    } catch (e) {
      console.error('Error parsing angles_json in share modal:', e);
    }
    return null;
  }, [selectedVariant]);

  const displayMainImage = useMemo(() => {
    if (!selectedVariant) return request?.mainImage;
    if (activeMetalPayload === 'gold') {
      return getMetalImage(parsedMetalVariations, 'gold') || selectedVariant?.base_image_url || selectedVariant?.image_url || selectedVariant?.url || selectedVariant?.mainImage || selectedVariant?.image || selectedVariant?.base_design_image_url || request?.mainImage;
    } else {
      const metalImg = getMetalImage(parsedMetalVariations, activeMetalPayload);
      return metalImg || selectedVariant?.base_image_url || selectedVariant?.image_url || selectedVariant?.url || request?.mainImage;
    }
  }, [selectedVariant, activeMetalPayload, parsedMetalVariations, request?.mainImage]);

  const displayAngles = useMemo(() => {
    const mapAnglesJson = (anglesObj: any): LocalAngleView[] => {
      if (!anglesObj) return [];
      return [
        { id: 'side', label: 'Side View', image: anglesObj.side_view || anglesObj.side || '' },
        { id: 'top', label: 'Top View', image: anglesObj.top_view || anglesObj.top || '' },
        { id: 'three-quarter', label: 'Three Quarter View', image: anglesObj.three_quarter_view || anglesObj.three_quarter || '' },
        { id: 'back', label: 'Back View', image: anglesObj.back_view || anglesObj.back || '' },
        { id: 'worn', label: 'Worn View', image: anglesObj.worn_view || anglesObj.worn || '' },
      ].filter(a => a.image && typeof a.image === 'string' && a.image.length > 0);
    };

    const metalAnglesObj = getMetalValue(parsedAnglesJson, activeMetalPayload);
    const backendAngles = metalAnglesObj
      ? mapAnglesJson(metalAnglesObj)
      : [];

    return backendAngles.length > 0
      ? backendAngles
      : (request?.angles ?? []);
  }, [parsedAnglesJson, activeMetalPayload, request?.angles]);

  const hasMainImageForMetal = useMemo(() => {
    if (!parsedMetalVariations || activeMetalPayload === 'gold') return false;
    const metalImg = getMetalImage(parsedMetalVariations, activeMetalPayload);
    return Boolean(metalImg);
  }, [parsedMetalVariations, activeMetalPayload]);

  const applyFilterClass = '';

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const lastFetchedPageRef = useRef<number | null>(null);
  const lastFetchedParamsRef = useRef<{ page: number; limit: number; search: string | undefined } | null>(null);

  // Debounce search query
  useEffect(() => {
    if (searchQuery.trim() === debouncedSearchQuery) return;
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, debouncedSearchQuery]);

  // Reset customer list state on modal mount
  useEffect(() => {
    dispatch(resetCustomerList());
  }, [dispatch]);

  // Initial fetch and fetch on search change
  useEffect(() => {
    const params = { page: 1, limit: 15, search: debouncedSearchQuery || undefined };
    if (
      lastFetchedParamsRef.current &&
      lastFetchedParamsRef.current.page === params.page &&
      lastFetchedParamsRef.current.limit === params.limit &&
      lastFetchedParamsRef.current.search === params.search
    ) {
      return;
    }
    lastFetchedParamsRef.current = params;
    setPage(1);
    lastFetchedPageRef.current = 1;
    dispatch(listCustomers(params));
  }, [dispatch, debouncedSearchQuery]);

  const isLoading = listStatus === 'loading' || listStatus === 'idle';

  const loadMoreCustomers = () => {
    if (isLoading || !hasMore || apiCustomers.length >= total) return;
    const nextPage = page + 1;
    if (lastFetchedPageRef.current === nextPage) return;
    lastFetchedPageRef.current = nextPage;
    setPage(nextPage);
    const params = {
      page: nextPage,
      limit: 15,
      search: debouncedSearchQuery || undefined,
      append: true,
    };
    lastFetchedParamsRef.current = { page: nextPage, limit: 15, search: debouncedSearchQuery || undefined };
    dispatch(listCustomers(params));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Only trigger loadMore if the container actually has a scrollbar (is scrollable)
    if (target.scrollHeight > target.clientHeight) {
      // Must have scrolled at least some amount, and be close to the bottom
      const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 45;
      if (isNearBottom && target.scrollTop > 0) {
        loadMoreCustomers();
      }
    }
  };

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedEmailMap, setSelectedEmailMap] = useState<Record<string, string[]>>({});
  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [selectedTag, setSelectedTag] = useState(TAGS[0]);
  const [emails, setEmails] = useState([{ label: 'Work', email: '' }]);
  const [selectedCountryCode, setSelectedCountryCode] = useState('+1');
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [newLocation, setNewLocation] = useState('');
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('active');
  const [newCustomerErrors, setNewCustomerErrors] = useState<Record<string, string>>({});
  const [newCustomerGeneralError, setNewCustomerGeneralError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);
  const [excludedAngles, setExcludedAngles] = useState<string[]>([]);

  useEffect(() => {
    setExcludedAngles([]);
  }, [variantId, activeMetal]);

  const [requireApproval, setRequireApproval] = useState(false);
  const [allowFeedback, setAllowFeedback] = useState(false);
  const [allowRevision, setAllowRevision] = useState(false);



  const allCustomers = useMemo(() => {
    const mappedApi = (apiCustomers ?? []).map((c) => {
      const fullName = c.full_name || 'No Name';
      const initials = fullName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'NN';

      return {
        id: String(c.id),
        name: fullName,
        initials,
        avatarColor: 'bg-surface-avatar-blue',
        email: c.emails?.[0]?.email || '',
        emails: c.emails?.map(e => ({ label: e.label, value: e.email })) || [],
        phone: c.phone_number || '-',
        location: c.location || '-',
        role: c.tag || 'Client',
        addedDate: c.created_at ? new Date(c.created_at).toLocaleDateString('en-US') : '',
        totalRequests: 0,
        activeProjects: 0,
        lastInteraction: '-',
        totalSpent: '-',
        status: (c.status?.toLowerCase() === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
        avatar: '',
        projects: [],
        activity: [],
      };
    });
    // Filter out localCustomers that are already present in the API fetched list to prevent duplication
    const uniqueLocalCustomers = localCustomers.filter(
      (local) => !mappedApi.some((api) => String(api.id) === String(local.id))
    );
    return [...mappedApi, ...uniqueLocalCustomers];
  }, [apiCustomers, localCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return allCustomers;
    const q = searchQuery.trim().toLowerCase();
    return allCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.emails?.some(
          (e) =>
            e.value.toLowerCase().includes(q) ||
            e.label.toLowerCase().includes(q)
        )
    );
  }, [allCustomers, searchQuery]);

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const isNowSelected = !prev.includes(id);
      if (isNowSelected) {
        const customer = allCustomers.find((c) => c.id === id);
        const emails =
          customer?.emails?.map((e) => e.value) ||
          (customer?.email ? [customer.email] : []);
        // Strictly single-select: clear all other selections
        setSelectedEmailMap({ [id]: emails });
        return [id];
      } else {
        setSelectedEmailMap({});
        return [];
      }
    });
  };

  const toggleEmail = (customerId: string, emailValue: string) => {
    setSelectedEmailMap((prev) => {
      const current = prev[customerId] || [];
      const next = current.includes(emailValue)
        ? current.filter((e) => e !== emailValue)
        : [...current, emailValue];
      return { ...prev, [customerId]: next };
    });
  };

  const handleAddNewCustomer = async () => {
    setNewCustomerGeneralError('');
    setNewCustomerErrors({});
    const errs: Record<string, string> = {};

    if (!newName.trim()) {
      errs.name = 'Customer name is required';
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newName.trim())) {
      errs.name = 'Full Name cannot be an email address';
    }

    const validEmails = emails.filter((em) => em.email.trim());
    if (validEmails.length === 0) {
      errs.email = 'At least one email is required';
    } else {
      const invalid = validEmails.find((em) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.email.trim()));
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
      setNewCustomerErrors(errs);
      return;
    }

    const payload = {
      full_name: newName.trim(),
      tag: selectedTag.label,
      emails: validEmails.map((e) => ({ label: e.label.trim(), email: e.email.trim() })),
      phone_number: `${phoneCountryCode}${normalizedPhone}`,
      location: newLocation.trim(),
      status: (newStatus === 'active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
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

      const added: Customer = {
        id: String(response.id),
        name: response.full_name,
        initials,
        avatarColor: 'bg-surface-avatar-blue',
        email: primaryEmail,
        emails: response.emails?.map((e) => ({ label: e.label, value: e.email })) ?? [],
        phone: response.phone_number || payload.phone_number,
        location: response.location || payload.location,
        role: response.tag || payload.tag,
        addedDate: response.created_at
          ? new Date(response.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        totalRequests: 0,
        activeProjects: 0,
        lastInteraction: '-',
        totalSpent: '$0',
        status: response.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
        projects: [],
        activity: [],
        avatar: '',
      };

      setLocalCustomers((prev) => [...prev, added]);
      setSelectedCustomerIds([added.id]);
      setSelectedEmailMap({ [added.id]: added.emails!.map((e) => e.value) });

      // Refresh customer list
      setPage(1);
      lastFetchedPageRef.current = 1;
      lastFetchedParamsRef.current = { page: 1, limit: 15, search: undefined };
      dispatch(listCustomers({ page: 1, limit: 15 }));

      setNewName('');
      setNewPhone('');
      setPhoneCountryCode('+1');
      setNewLocation('');
      setEmails([{ label: 'Work', email: '' }]);
      setSelectedTag(TAGS[0]);
      setNewStatus('active');
      setShowAddNew(false);
    } catch (err: any) {
      setNewCustomerGeneralError(String(err || 'Failed to create customer'));
    }
  };

  const handleSaveDraft = () => {
    onClose();
  };

  const handleSend = async () => {
    if (selectedCustomerIds.length === 0) return;
    const targetVariantId = variantId || selectedVariant?.id || request.id;
    if (!targetVariantId || isNaN(Number(targetVariantId))) {
      toast.error('No valid design variant is loaded yet. Please wait for the design details to load.');
      return;
    }

    const primaryCustomer = allCustomers.find((c) => c.id === selectedCustomerIds[0]);
    if (!primaryCustomer) return;

    // Parse the customer ID to a number. Fallback to 1 for mock customers so it works gracefully.
    const numericCustomerId = isNaN(Number(primaryCustomer.id)) ? 1 : Number(primaryCustomer.id);

    setSending(true);
    try {
      const mapLabelToAngleKey = (label: string): string => {
        const norm = label.toLowerCase();
        if (norm.includes('side')) return 'side_view';
        if (norm.includes('top')) return 'top_view';
        if (norm.includes('three') || norm.includes('3/4') || norm.includes('quarter')) return 'three_quarter_view';
        if (norm.includes('back')) return 'back_view';
        if (norm.includes('worn')) return 'worn_view';
        if (norm.includes('front')) return 'front_view';
        return norm.trim().replace(/\s+/g, '_');
      };

      const includedAngleKeys = displayAngles
        .filter((a) => !excludedAngles.includes(a.id))
        .map((a) => mapLabelToAngleKey(a.label));

      const resultAction = await dispatch(
        shareVariant({
          variantId: targetVariantId,
          customer_id: numericCustomerId,
          comment: message.trim() || 'Shared design variant.',
          metal: (activeMetal == "yellow" ? "gold" : activeMetal == "white" ? "silver" : "rose_gold"),
          angles: includedAngleKeys,
        })
      );

      if (shareVariant.fulfilled.match(resultAction)) {
        toast.success('Design shared with customer successfully!');
        setTimeout(() => {
          onStatusChange?.();
          onClose();
        }, 1000);
      } else {
        const errorMsg = resultAction.payload || 'Failed to share design variant.';
        toast.error(`${errorMsg}`);
      }
    } catch (err) {
      console.error('[ShareCustomer] Sharing failed:', err);
      toast.error('An unexpected error occurred while sharing.');
    } finally {
      setSending(false);
    }
  };

  const isSendDisabled = selectedCustomerIds.length === 0 || sending || selectedCustomerIds.some((id) => ((selectedEmailMap?.[id])?.length ?? 0) === 0);
  const s = statusStyles[request.status] || { bg: 'bg-slate-500/10', text: 'text-slate-500' };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-2 sm:p-6 overflow-auto">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className="relative w-full max-w-[800px] mx-auto rounded-sheet sm:rounded-sheet-lg flex flex-col max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-hidden bg-white dark:bg-surface-100 border border-hairline dark:border-border-default shadow-modal-xl animate-[fadeUp_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 sm:px-8 pt-3 sm:pt-7 pb-3 sm:pb-5 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-ui sm:text-heading-xs font-semibold text-ink mb-1 leading-tight font-satoshi">
                Customer Design Overview
              </h3>
              <p className="text-label sm:text-body-sm text-ink-400 max-w-[22rem]">
                Preview the design before sharing with customer.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-surface-hover dark:hover:bg-surface-150 transition-colors cursor-pointer flex-shrink-0"
            >
              <i className="ri-close-line text-ui sm:text-heading-xs text-ink-400" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-8 pb-3 sm:pb-6">

          {/* Section 2 — Design Summary */}
          <div className="rounded-modal p-5 mb-5 bg-surface-75 dark:bg-surface-150 border border-hairline dark:border-border-default">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-ui font-semibold text-ink font-satoshi">
                  {request.id} ({selectedVariantName}) — {request.type}
                </span>
                <span className={`text-label-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                  {request.status}
                </span>
              </div>
              <span className="text-label text-ink-400">{request.type}</span>
            </div>
          </div>

          {/* Section 3 — Render Preview */}
          <div className="rounded-modal p-4 sm:p-5 mb-4 sm:mb-5 bg-surface-75 dark:bg-surface-150 border border-hairline dark:border-border-default">
            <div className={`grid grid-cols-1 ${displayAngles.length > 0 ? 'sm:grid-cols-[1fr_130px]' : 'sm:grid-cols-1'} gap-3 sm:gap-4`}>
              {/* LEFT: Large primary render */}
              <div className="rounded-panel overflow-hidden ring-1 ring-black/[0.06] dark:ring-border-default lg:h-[430px] sm:h-[300px] h-[220px] bg-white dark:bg-surface-200">
                {displayMainImage ? (
                  <img
                    src={displayMainImage}
                    alt={request.type}
                    className={`w-full h-full object-cover object-center ${applyFilterClass}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-label text-ink-400">
                    No render available
                  </div>
                )}
              </div>
              {/* RIGHT: 3 stacked angle cards */}
              {displayAngles.length > 0 && (
                <div className="grid grid-cols-3 sm:flex sm:flex-col gap-2.5 sm:gap-2.5 h-auto min-h-0 justify-start">
                  {displayAngles.map((angle) => {
                    const isExcluded = excludedAngles.includes(angle.id);
                    return (
                      <div
                        key={angle.id}
                        className="relative w-full rounded-card-lg overflow-hidden group aspect-square border border-hairline dark:border-border-default shadow-card-sub"
                      >
                        <img
                          src={angle.image}
                          alt={angle.label}
                          className={`w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 ${applyFilterClass} ${isExcluded ? 'opacity-40 filter grayscale' : ''}`}
                        />
                        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/35 to-transparent">
                          <span className="text-caption-xs sm:text-caption font-medium text-white">
                            {angle.label}
                          </span>
                        </div>

                        {/* Exclude/Restore overlay */}
                        {isExcluded ? (
                          <div
                            className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center cursor-pointer transition-all animate-[fadeIn_150ms_ease]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExcludedAngles(prev => prev.filter(id => id !== angle.id));
                            }}
                          >
                            <i className="ri-add-line text-white text-[20px] mb-0.5" />
                            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Restore</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors cursor-pointer border-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExcludedAngles(prev => [...prev, angle.id]);
                            }}
                          >
                            <i className="ri-close-line text-[12px]" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section 4 — Message for Customer */}
          <div className="mb-5">
            <label className="block text-label-md sm:text-body-md font-semibold text-ink mb-2.5 font-satoshi">
              Message for Customer
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add approval instructions or notes…"
              rows={4}
              className="w-full px-3 py-2.5 rounded-section text-label-sm sm:text-body-sm text-ink placeholder:text-ink-300 dark:placeholder:text-ink-400 outline-none resize-none bg-surface-100 dark:bg-surface-150 border border-hairline dark:border-border-default font-inter"
            />
          </div>

          {/* Section 6 — Customer Selection */}
          <div className="mb-5">
            <h4 className="text-body-sm sm:text-body-md font-semibold text-ink mb-3 font-satoshi">
              Select Customers
            </h4>

            {/* Search */}
            <div className="relative mb-3">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <i className="ri-search-line text-body-sm sm:text-body-md text-ink-300 dark:text-[#A1A8B3]"></i>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.trimStart())}
                onBlur={() => setSearchQuery(searchQuery.trim())}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-3 rounded-section text-label sm:text-body-sm text-ink placeholder:text-ink-300 dark:placeholder:text-ink-400 outline-none bg-surface-100 dark:bg-surface-150 border border-hairline dark:border-border-default font-inter"
              />
            </div>

            {/* Customer list */}
            <div
              onScroll={handleScroll}
              className="flex flex-col gap-2 mb-3 max-h-[240px] overflow-y-auto pr-0.5"
            >
              {filteredCustomers.length === 0 && !isLoading && (
                <div className="py-8 text-center">
                  <p className="text-body-sm text-ink-400">No customers found</p>
                </div>
              )}
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomerIds.includes(customer.id);
                const tag = getCustomerTag(customer.role);
                const hasMultipleEmails = (customer.emails?.length ?? 0) > 1;
                const selectedEmails = selectedEmailMap[customer.id] || [];
                return (
                  <div key={customer.id} className="flex flex-col">
                    <button
                      onClick={() => toggleCustomer(customer.id)}
                      className={`w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-section text-left transition-all duration-150 cursor-pointer ${isSelected
                        ? 'bg-brand-light dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20'
                        : 'bg-surface-75 dark:bg-surface-150 border border-transparent hover:border-hairline dark:hover:border-border-default'
                        }`}
                    >
                      <div className="relative flex-shrink-0">
                        {customer.avatar ? (
                          <img
                            src={customer.avatar}
                            alt={customer.name}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-label sm:text-body-sm font-bold text-white ${customer.avatarColor || 'bg-brand'}`}
                          >
                            {customer.initials}
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#3B82F6] flex items-center justify-center border-[2.5px] border-white">
                            <i className="ri-check-line text-[10px] text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-label-md sm:text-body font-medium text-ink truncate">
                            {customer.name}
                          </p>
                          <span
                            className={`text-caption-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${tag.bgClass} ${tag.textClass}`}
                          >
                            {tag.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-caption-xs sm:text-label-xs text-ink-400">
                          <span className="truncate">
                            {customer.emails && customer.emails.length > 1
                              ? `${customer.emails.length} emails`
                              : customer.email}
                          </span>
                          {customer.phone !== '-' && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-ink-200 flex-shrink-0" />
                              <span className="truncate">{customer.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    {isSelected && hasMultipleEmails && (
                      <div className="sm:ml-[54px] ml-0 mt-1.5 mb-1 flex flex-col gap-1.5 min-w-0">
                        {customer.emails && customer.emails.map((em) => {
                          const emailSelected = selectedEmails.includes(em.value);
                          return (
                            <label
                              key={em.value}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-card cursor-pointer select-none transition-colors ${emailSelected ? 'bg-blue-500/5 border border-blue-500/10' : 'bg-transparent border border-transparent'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEmail(customer.id, em.value);
                              }}
                            >
                              <div
                                className={`w-[16px] h-[16px] rounded-xs flex items-center justify-center flex-shrink-0 transition-colors ${emailSelected
                                  ? 'bg-brand'
                                  : 'bg-white border border-ink-200 dark:border-border-default'
                                  }`}
                              >
                                {emailSelected && (
                                  <i className="ri-check-line text-label-xs text-white" />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {em.label && (
                                  <span className="text-caption-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 bg-slate-500/10 text-slate-500">
                                    {em.label}
                                  </span>
                                )}
                                <span className="text-label-xs sm:text-label text-ink truncate">
                                  {em.value}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`cust-skeleton-${i}`} className="flex items-center gap-3 p-3 sm:p-3.5 rounded-section bg-surface-75 dark:bg-surface-150 border border-transparent">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full skeleton-shimmer flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="h-3.5 w-24 rounded skeleton-shimmer" />
                        <div className="h-2.5 w-32 rounded skeleton-shimmer mt-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Customer */}
            {!showAddNew ? (
              <button
                onClick={() => setShowAddNew(true)}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[#3B82F6] hover:text-blue-600 transition-colors cursor-pointer"
              >
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-50">
                  <i className="ri-add-line text-[14px]" />
                </span>
                Add New Customer
              </button>
            ) : (
              <div className="rounded-[16px] p-4 sm:p-5 bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.05] dark:border-border-default">
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <p className="text-[13px] sm:text-[13.5px] font-semibold text-[#1A1A1A] dark:text-ink leading-tight font-satoshi">New Customer</p>
                  <button
                    onClick={() => { setShowAddNew(false); setNewCustomerErrors({}); setNewCustomerGeneralError(''); }}
                    className="text-[12px] text-[#9CA3AF] dark:text-[#A1A8B3] hover:text-[#6B7280] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex flex-col gap-4 sm:gap-3">
                  <div>
                    <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        setNewCustomerErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      className={`w-full px-3 py-2.5 rounded-card text-[14px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter ${newCustomerErrors.name ? 'border-1.5 border-danger-bright shadow-glow-danger-ring' : 'border border-hairline'}`}
                    />
                    {newCustomerErrors.name && (
                      <p className="text-[12px] text-danger mt-1">{newCustomerErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Customer Tag</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowTagDropdown((prev) => !prev)}
                        className="w-full px-3 py-2.5 rounded-card text-[14px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 flex items-center justify-between cursor-pointer bg-surface-100 font-inter border border-hairline"
                      >
                        <span className={`px-2.5 py-0.5 rounded-full text-label-xs font-semibold ${selectedTag.bg} ${selectedTag.color}`}>
                          {selectedTag.label}
                        </span>
                        <i className={`ri-arrow-down-s-line text-body-md text-ink-400 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showTagDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-1 rounded-card-lg p-1.5 z-10 bg-white dark:bg-surface-150 shadow-pop-md border border-hairline dark:border-border-default max-h-[200px] overflow-y-auto">
                          {TAGS.map((tag) => (
                            <button
                              key={tag.label}
                              type="button"
                              onClick={() => { setSelectedTag(tag); setShowTagDropdown(false); }}
                              className={`w-full text-left px-3 py-2 rounded text-[14px] sm:text-label font-medium flex items-center gap-2 cursor-pointer hover:bg-surface-200 transition-colors ${tag.color}`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-current" />
                              <span>{tag.label}</span>
                              {selectedTag.label === tag.label && (
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
                      {emails.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Label"
                            value={entry.label}
                            onChange={(e) => {
                              const next = [...emails];
                              next[idx].label = e.target.value;
                              setEmails(next);
                            }}
                            className="w-[90px] sm:w-[100px] px-2 sm:px-3 py-2 rounded-card text-[14px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border border-hairline"
                          />
                          <input
                            type="email"
                            placeholder="Email address"
                            value={entry.email}
                            onChange={(e) => {
                              const next = [...emails];
                              next[idx].email = e.target.value;
                              setEmails(next);
                              setNewCustomerErrors((prev) => ({ ...prev, email: '' }));
                            }}
                            className={`flex-1 px-3 py-2 rounded-card text-[14px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter min-w-0 ${newCustomerErrors.email ? 'border-1.5 border-danger-bright shadow-glow-danger-ring' : 'border border-hairline'}`}
                          />
                          {emails.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setEmails(emails.filter((_, i) => i !== idx))}
                              className="touch-target rounded-full hover:bg-surface-200 flex-shrink-0"
                              aria-label="Remove email"
                            >
                              <i className="ri-close-line text-body-md text-ink-400" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {newCustomerErrors.email && (
                      <p className="text-[12px] text-danger mt-1">{newCustomerErrors.email}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setEmails([...emails, { label: '', email: '' }])}
                      className="mt-2 min-h-touch flex items-center gap-1.5 px-2 -ml-2 rounded-lg text-body-sm sm:text-label-xs font-medium text-[#3B82F6] dark:text-[#60A5FA] cursor-pointer bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <i className="ri-add-line text-body-sm" /> Add another email
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
                          const sanitized = sanitizePhoneDigits(newPhone, maxLen);
                          setNewPhone(sanitized);
                          if (sanitized && sanitized.length !== maxLen) {
                            setNewCustomerErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(code) }));
                          } else {
                            setNewCustomerErrors((prev) => ({ ...prev, phone: '' }));
                          }
                        }}
                        className="!bg-surface-100 !border-hairline rounded-card text-[14px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 font-inter !px-3 !py-2.5 !h-[42px]"
                      />
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="Phone Number"
                        value={newPhone}
                        maxLength={getPhoneMaxLength(phoneCountryCode)}
                        onChange={(e) => {
                          const maxLen = getPhoneMaxLength(phoneCountryCode);
                          const sanitized = sanitizePhoneDigits(e.target.value, maxLen);
                          setNewPhone(sanitized);
                          if (sanitized && sanitized.length !== maxLen) {
                            setNewCustomerErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(phoneCountryCode) }));
                          } else {
                            setNewCustomerErrors((prev) => ({ ...prev, phone: '' }));
                          }
                        }}
                        className={`flex-1 px-3 py-2.5 rounded-card text-[14px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border min-w-0 ${newCustomerErrors.phone ? 'border-1.5 border-danger-bright shadow-glow-danger-ring' : 'border-hairline'}`}
                      />
                    </div>
                    {newCustomerErrors.phone && (
                      <p className="text-[12px] text-danger mt-1">{newCustomerErrors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Location</label>
                    <input
                      type="text"
                      placeholder="Location"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-card text-[14px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 font-inter border border-hairline"
                    />
                  </div>

                  <div>
                    <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Status</label>
                    <div className="flex flex-row items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setNewStatus('active')}
                        className={`flex-1 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[14px] sm:text-label font-medium cursor-pointer transition-all ${newStatus === 'active' ? 'bg-tint-emerald-soft text-success-deep border border-emerald-ring' : 'bg-surface-100 text-ink-400 border border-hairline'}`}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewStatus('inactive')}
                        className={`flex-1 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[14px] sm:text-label font-medium cursor-pointer transition-all ${newStatus === 'inactive' ? 'bg-tint-danger-soft text-danger border border-danger-ring' : 'bg-surface-100 text-ink-400 border border-hairline'}`}
                      >
                        Inactive
                      </button>
                    </div>
                  </div>

                  {newCustomerGeneralError && (
                    <div className="rounded-card border border-danger/20 bg-tint-danger-soft px-3 py-2 text-label-sm text-danger">
                      {newCustomerGeneralError}
                    </div>
                  )}


                </div>
                <button
                  onClick={handleAddNewCustomer}
                  className="w-full mt-6 sm:mt-5 min-h-touch sm:min-h-0 sm:py-3 rounded-card-lg text-[14px] sm:text-body-sm font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity bg-[#3B82F6] dark:text-black dark:bg-[#60A5FA] shadow-glow-brand-deep"
                >
                  Add & Select Customer
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Section 8 — Footer */}
        <div className="px-4 sm:px-8 pb-4 sm:pb-7 pt-4 flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 border-t border-[#F0EEEB] dark:border-border-default">
          {/* <button
            onClick={handleSaveDraft}
            className="flex items-center justify-center gap-2 text-[12px] sm:text-[13.5px] font-medium text-[#9CA3AF] dark:text-[#A1A8B3] hover:text-[#6B7280] dark:hover:text-ink-600 transition-colors cursor-pointer w-full sm:w-auto"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-draft-line text-[14px]" />
            </span>
            Save Draft
          </button> */}
          <button
            onClick={handleSend}
            disabled={isSendDisabled}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-[12px] text-[12px] sm:text-[13.5px] font-semibold text-white transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 w-full sm:w-auto bg-[#3B82F6] dark:bg-[#60A5FA] dark:text-black"
          >
            {sending ? (
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-loader-4-line text-[15px] animate-spin" />
              </span>
            ) : (
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-send-plane-line text-[14px]" />
              </span>
            )}
            {sending ? 'Sending...' : 'Send to Customer'}
          </button>
        </div>

        {/* Toast */}
        {showToast && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-[14px] text-[13.5px] font-medium text-white bg-green-600 shadow-[0px_6px_24px_rgba(22,163,74,0.30)] animate-[fadeDown_180ms_ease_forwards]">
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20">
                <i className="ri-check-line text-[14px] text-white" />
              </span>
              Design shared with customer successfully
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeDown {
            from { transform: translate(-50%, -8px); opacity: 0.7; }
            to { transform: translate(-50%, 0); opacity: 1; }
          }
          .metal-filter-yellow { filter: sepia(35%) saturate(125%) hue-rotate(5deg) brightness(102%); }
          .metal-filter-white { filter: grayscale(25%) brightness(108%) contrast(105%); }
          .metal-filter-rose { filter: sepia(25%) saturate(115%) hue-rotate(-12deg) brightness(104%); }
        `}</style>
      </div>
    </div>
  );
}
