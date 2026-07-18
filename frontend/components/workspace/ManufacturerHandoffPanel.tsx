'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { RequestData } from '@/lib/requestsData';
import { SPECIALTIES } from '@/lib/manufacturersData';
import CountryCodeSelect from '@/src/utils/components/CountryCodeSelect';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { shareVariantWithManufacturer } from '@/redux/slices/retailer/designVariantShareMfgSlice';
import { toast } from 'react-toastify';
import { fetchDesignVariantManufacturerShares, resetSharesState } from '@/redux/slices/retailer/designVariantManufacturerSharesSlice';
import { listManufacturers, createManufacturer, resetManufacturers } from '@/redux/slices/retailer/manufacturerSlice';
import { approveQuote, resetQuoteApproveState } from '@/redux/slices/retailer/quoteApproveSlice';
import { rejectQuote, resetQuoteRejectState } from '@/redux/slices/retailer/quoteRejectSlice';
import { resendManufacturerEmails } from '@/redux/slices/retailer/designVariantResendMfgSlice';
import { sanitizePhoneDigits, getPhoneMaxLength, getPhoneLengthMessage } from '@/lib/formValidation';
import { getProductionSheet, resetProductionSheetState } from '@/redux/slices/productionSheet/productionSheetSlice';

const statusBadgeMap: Record<string, { bgClass: string; textClass: string; dotClass: string }> = {
  'Available': { bgClass: 'bg-green-500/10', textClass: 'text-green-600', dotClass: 'bg-green-500' },
  'Active': { bgClass: 'bg-green-500/10', textClass: 'text-green-600', dotClass: 'bg-green-500' },
  'Inactive': { bgClass: 'bg-gray-100 dark:bg-[#2C3545]', textClass: 'text-gray-500 dark:text-ink-600', dotClass: 'bg-gray-400' },
  'Busy': { bgClass: 'bg-violet-500/10', textClass: 'text-violet-600', dotClass: 'bg-violet-500' },
  'Delayed': { bgClass: 'bg-red-500/10', textClass: 'text-red-600', dotClass: 'bg-red-500' },
};

const avatarBgClassMap: Record<string, string> = {
  '#BFDBFE': 'bg-blue-200',
  '#C7D2FE': 'bg-indigo-200',
  '#8B5CF6': 'bg-violet-500',
};

function getAvatarBgClass(color?: string) {
  if (!color) return 'bg-violet-500';
  return avatarBgClassMap[color] ?? 'bg-violet-500';
}

const PRODUCTION_STAGES = [
  { key: 'Sent', label: 'Sent' },
  { key: 'Viewed', label: 'Viewed' },
  { key: 'QuoteReceived', label: 'Quote Received' },
  { key: 'Approved', label: 'Approved for Production' },
  { key: 'InProduction', label: 'In Production' },
  { key: 'Completed', label: 'Completed' },
];

type MfgResponseStatus = 'Pending' | 'Viewed' | 'QuoteReceived' | 'Declined' | 'Approved' | 'InProduction' | 'Completed';

interface QuoteDetails {
  amount: string;
  currency: string;
  deliveryDays: number;
  notes: string;
  receivedAt: string;
}

interface ManufacturerInfo {
  id: string;
  name: string;
  initials: string;
  avatarColor?: string;
  specialty?: string;
  location?: string;
  verified?: boolean;
  status?: string;
  avgResponseTime?: string;
  totalRequests?: number;
  completedRequests?: number;
  emails?: { label: string; value: string }[];
}

interface HandoffRecord {
  id: string;
  manufacturer: ManufacturerInfo;
  dateSent: string;
  stageIndex: number;
  responseStatus: MfgResponseStatus;
  quote?: QuoteDetails;
  approvedAt?: string;
  note?: string;
  quoteId?: number | null;
}

interface ManufacturerHandoffPanelProps {
  request: RequestData;
  variantId?: string | number | null;
  onGoToDesign: () => void;
  onStatusChange?: () => void;
  onGenerateDetailSheet?: () => void;
  sentManufacturerIds?: string[];
}

function getInitials(name: string) {
  return (name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const mapApiStatusToResponseStatus = (status: string): MfgResponseStatus => {
  const s = (status || '').trim().toUpperCase().replace(/[\s_-]+/g, '_');
  if (s === 'PENDING') return 'Pending';
  if (s === 'VIEWED') return 'Viewed';
  if (s === 'QUOTE_RECEIVED' || s === 'QUOTE' || s === 'QUOTED') return 'QuoteReceived';
  if (s === 'DECLINED' || s === 'REJECTED') return 'Declined';
  if (s === 'APPROVED') return 'InProduction';
  if (s === 'IN_PRODUCTION' || s === 'INPRODUCTION') return 'InProduction';
  if (s === 'COMPLETED') return 'Completed';
  return 'Pending';
};

const getStageIndex = (responseStatus: MfgResponseStatus): number => {
  switch (responseStatus) {
    case 'Pending': return 0;
    case 'Viewed': return 1;
    case 'QuoteReceived': return 2;
    case 'Approved': return 3;
    case 'InProduction': return 4;
    case 'Completed': return 5;
    default: return 0;
  }
};

const ShimmerLoader = () => (
  <div className="rounded-[20px] p-6 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04)] border border-black/[0.05] dark:border-white/[0.08] animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 w-32 bg-gray-200 dark:bg-surface-200 rounded"></div>
      <div className="h-5 w-16 bg-gray-200 dark:bg-surface-200 rounded-full"></div>
    </div>
    <div className="flex flex-col gap-4">
      {[1, 2].map((i) => (
        <div key={i} className="p-4 rounded-[14px] border border-black/[0.05] dark:border-border-default bg-[#FAFAF8] dark:bg-surface-150">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-surface-200 flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 bg-gray-200 dark:bg-surface-200 rounded"></div>
              <div className="h-3 w-1/2 bg-gray-200 dark:bg-surface-200 rounded"></div>
              <div className="h-2.5 w-1/4 bg-gray-200 dark:bg-surface-200 rounded"></div>
            </div>
            <div className="h-5 w-20 bg-gray-200 dark:bg-surface-200 rounded-full"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ModalShimmerLoader = () => (
  <div className="flex flex-col gap-2.5 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="rounded-[14px] p-4 bg-[#FAFAF8] dark:bg-surface-150 border border-transparent">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-surface-200 flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 bg-gray-200 dark:bg-surface-200 rounded"></div>
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-surface-200 rounded"></div>
            <div className="h-2.5 w-3/4 bg-gray-200 dark:bg-surface-200 rounded"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);


export default function ManufacturerHandoffPanel({ request, variantId, onGoToDesign, onStatusChange, onGenerateDetailSheet, sentManufacturerIds }: ManufacturerHandoffPanelProps) {
  const dispatch = useAppDispatch();

  const { shares: apiShares, loading: sharesLoading, error: sharesError } = useAppSelector(
    (state) => state.retailerDesignVariantManufacturerShares
  );
  const { loading: approveLoading } = useAppSelector(
    (state) => state.retailerQuoteApprove
  );
  const { loading: rejectLoading } = useAppSelector(
    (state) => state.retailerQuoteReject
  );
  const { items: dbManufacturers, listStatus } = useAppSelector(
    (state) => state.retailerManufacturer
  );
  const manufacturersLoading = listStatus === 'loading';

  const [showSendModal, setShowSendModal] = useState(false);
  const [records, setRecords] = useState<HandoffRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<MfgResponseStatus | null>(null);

  const filteredRecords = useMemo(() => {
    if (!activeFilter) return records;
    return records.filter((r) => r.responseStatus === activeFilter);
  }, [records, activeFilter]);

  const approvedRecord = useMemo(() => {
    return records.find(
      (r) => r.responseStatus === 'Approved' || r.responseStatus === 'InProduction' || r.responseStatus === 'Completed'
    );
  }, [records]);

  const isSimulationHidden = useMemo(() => {
    return (
      (request.status || '').trim().toUpperCase() === 'APPROVED' ||
      (request.status || '').trim().toUpperCase() === 'COMPLETED' ||
      !!approvedRecord
    );
  }, [request.status, approvedRecord]);

  useEffect(() => {
    if (approvedRecord) {
      setActiveFilter(null);
    }
  }, [approvedRecord]);

  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [sendNote, setSendNote] = useState('');
  const [sending, setSending] = useState(false);
  const [resendingIndex, setResendingIndex] = useState<number | null>(null);
  const [sendError, setSendError] = useState(false);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [selectedEmailMap, setSelectedEmailMap] = useState<Record<string, string[]>>({});
  const [approvingIdx, setApprovingIdx] = useState<number | null>(null);
  const [rejectingIdx, setRejectingIdx] = useState<number | null>(null);

  const mapShareToRecord = (share: any): HandoffRecord => {
    const mfg = share.manufacturer || {};
    const emails = mfg.emails?.map((e: any) => ({
      label: e.label || 'Work',
      value: e.email || '',
    })) || [];

    let responseStatus = mapApiStatusToResponseStatus(share.status || 'PENDING');
    if (responseStatus === 'Pending' && share.quoted_price !== null && share.quoted_price !== undefined) {
      responseStatus = 'QuoteReceived';
    }

    if ((request.status || '').toUpperCase() === 'COMPLETED') {
      if (responseStatus === 'Approved' || responseStatus === 'InProduction' || responseStatus === 'Completed') {
        responseStatus = 'Completed';
      }
    }

    let quote: QuoteDetails | undefined = undefined;
    if (share.quoted_price !== null && share.quoted_price !== undefined) {
      quote = {
        amount: String(share.quoted_price ?? 'N/A'),
        currency: 'USD',
        deliveryDays: share.estimated_delivery_days ?? 0,
        notes: share.manufacturer_notes || 'N/A',
        receivedAt: share.shared_date
          ? new Date(share.shared_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          : 'N/A',
      };
    } else if (responseStatus === 'QuoteReceived') {
      quote = {
        amount: 'N/A',
        currency: 'USD',
        deliveryDays: 0,
        notes: share.manufacturer_notes || 'N/A',
        receivedAt: 'N/A',
      };
    }

    return {
      id: String(share.id || ''),
      manufacturer: {
        id: String(mfg.id || share.manufacturer_id || ''),
        name: mfg.name || 'N/A',
        initials: getInitials(mfg.name || 'N/A'),
        avatarColor: '#BFDBFE',
        specialty: mfg.speciality || 'N/A',
        location: mfg.location || 'N/A',
        verified: mfg.status === 'Active' || mfg.status === 'ACTIVE',
        status: (() => {
          if (!mfg.status) return 'Inactive';
          const s = String(mfg.status).trim().toLowerCase();
          if (s === 'active') return 'Active';
          if (s === 'inactive') return 'Inactive';
          return s.charAt(0).toUpperCase() + s.slice(1);
        })() as any,
        avgResponseTime: mfg.stats?.avg_response_time || 'N/A',
        totalRequests: mfg.stats?.total_requests ?? 0,
        completedRequests: mfg.stats?.completed_requests ?? 0,
        emails: emails,
      },
      dateSent: share.shared_date
        ? new Date(share.shared_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        : 'N/A',
      stageIndex: getStageIndex(responseStatus),
      responseStatus: responseStatus,
      quote: quote,
      approvedAt: share.updated_at
        ? new Date(share.updated_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        : undefined,
      note: share.manufacturer_notes || undefined,
      quoteId: share.quote_id || share.quoteId || share.id,
    };
  };

  // Load variant manufacturer shares dynamically
  useEffect(() => {
    dispatch(resetQuoteApproveState());
    dispatch(resetQuoteRejectState());
    if (variantId) {
      dispatch(fetchDesignVariantManufacturerShares({ variantId }));
    } else {
      dispatch(resetSharesState());
    }
  }, [variantId, dispatch]);

  // Load all manufacturers for modal selection
  useEffect(() => {
    dispatch(listManufacturers({ skip: 0, limit: 10 }));
  }, [dispatch]);

  // Load production sheet data to check for saved drafts
  useEffect(() => {
    const numericVariantId = Number(variantId);
    if (numericVariantId && !isNaN(numericVariantId)) {
      dispatch(getProductionSheet(numericVariantId));
    } else {
      dispatch(resetProductionSheetState());
    }
  }, [variantId, dispatch]);

  const productionSheetData = useAppSelector((s) => s.productionSheet.data);
  const isSheetSaved = !!(productionSheetData && (productionSheetData.id || productionSheetData.variant_id));

  // Populate records from Redux API state
  useEffect(() => {
    const isNotSharedError = !!(
      sharesError &&
      (String(sharesError).toLowerCase().includes('not shared to manufacturer') ||
        String(sharesError).toLowerCase().includes('404') ||
        String(sharesError).toLowerCase().includes('not found'))
    );

    if (apiShares && apiShares.length > 0 && !isNotSharedError) {
      const mapped = apiShares.map(mapShareToRecord);
      console.log('[ManufacturerHandoffPanel Debug] apiShares:', apiShares);
      console.log('[ManufacturerHandoffPanel Debug] mapped records:', mapped);
      setRecords(mapped);
    } else {
      const reqStatus = (request.status || '').toUpperCase();
      const isSentOrCompleted =
        reqStatus === 'SENT_TO_MANUFACTURER' ||
        reqStatus === 'SENT TO MANUFACTURER' ||
        reqStatus === 'COMPLETED' ||
        reqStatus === 'SHARED' ||
        reqStatus === 'QUOTED';
      if (isSentOrCompleted && !isNotSharedError) {
        setRecords([
          {
            id: 'm1',
            manufacturer: {
              id: 'm1',
              name: request.manufacturer?.name || 'N/A',
              initials: getInitials(request.manufacturer?.name || 'N/A'),
              avatarColor: '#BFDBFE',
              specialty: request.manufacturer?.specialty || 'N/A',
              location: request.manufacturer?.location || 'N/A',
              verified: request.manufacturer?.verified ?? false,
              status: 'Available' as const,
              avgResponseTime: '—',
              totalRequests: 0,
              completedRequests: 0,
              emails: [],
            },
            dateSent: request.date || 'N/A',
            stageIndex: (reqStatus === 'COMPLETED') ? PRODUCTION_STAGES.length - 1 : 0,
            responseStatus: (reqStatus === 'COMPLETED') ? 'Completed' : 'Pending',
            note: undefined,
          },
        ]);
      } else {
        setRecords([]);
      }
    }
  }, [apiShares, sharesError, request.id, request.status, request.manufacturer, request.date]);

  // Populate manufacturers list for the modal dropdown/search
  useEffect(() => {
    if (dbManufacturers && dbManufacturers.length > 0) {
      setManufacturers(dbManufacturers.map((m) => {
        let mfgStatus = 'Active';
        if (m.status) {
          const rawStatus = String(m.status).trim().toLowerCase();
          if (rawStatus === 'active') mfgStatus = 'Active';
          else if (rawStatus === 'inactive') mfgStatus = 'Inactive';
          else mfgStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
        } else {
          mfgStatus = 'Inactive';
        }
        return {
          id: String(m.id),
          name: m.name || 'N/A',
          initials: getInitials(m.name || 'N/A'),
          avatarColor: '#C7D2FE',
          specialty: m.speciality || 'N/A',
          location: m.location || 'N/A',
          verified: m.status === 'Active' || m.status === 'ACTIVE',
          status: mfgStatus,
          avgResponseTime: m.stats?.avg_response_time || 'N/A',
          totalRequests: m.stats?.total_requests ?? 0,
          completedRequests: m.stats?.completed_requests ?? 0,
          emails: m.emails?.map((e) => ({ label: e.label || 'Work', value: e.email || '' })) || [],
        };
      }));
    } else {
      setManufacturers([]);
    }
  }, [dbManufacturers]);

  useEffect(() => {
    if (apiShares && apiShares.length > 0) {
      return;
    }
    if (sentManufacturerIds && sentManufacturerIds.length > 0) {
      const newRecords: HandoffRecord[] = sentManufacturerIds.map((id) => {
        const mfg = manufacturers.find((m) => m.id === id);
        return {
          id: id,
          manufacturer: {
            id: mfg?.id || id,
            name: mfg?.name || 'Unknown Manufacturer',
            initials: getInitials(mfg?.name || 'Unknown'),
            avatarColor: mfg?.avatarColor || '#BFDBFE',
            specialty: mfg?.specialty || 'Custom Manufacturer',
            location: mfg?.location || '—',
            verified: mfg?.verified ?? false,
            status: mfg?.status || 'Available',
            avgResponseTime: mfg?.avgResponseTime || '—',
            totalRequests: mfg?.totalRequests || 0,
            completedRequests: mfg?.completedRequests || 0,
            emails: mfg?.emails || [],
          },
          dateSent: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          stageIndex: 0,
          responseStatus: 'Pending',
          quote: undefined,
          note: undefined,
        };
      });
      setRecords(newRecords);
    }
  }, [sentManufacturerIds?.join(','), manufacturers, apiShares]);

  const handleSend = async () => {
    if (selectedIndices.length === 0) return;
    setSending(true);
    setSendError(false);

    const numericVariantId = Number(variantId);
    if (!numericVariantId || isNaN(numericVariantId)) {
      toast.error('No valid variant ID found. Cannot send design to manufacturer.');
      setSending(false);
      return;
    }

    const mfgNumericIds = selectedIndices.map((idx) => {
      const mfg = manufacturers[idx];
      return Number(mfg.id.replace(/\D/g, '')) || Number(mfg.id) || 1;
    });

    const mfgEmailsMap: Record<string, string[]> = {};
    selectedIndices.forEach((idx) => {
      const mfg = manufacturers[idx];
      const mfgId = String(mfg.id);
      const emails = selectedEmailMap?.[mfgId] || [];
      const mfgKey = String(Number(mfgId.replace(/\D/g, '')) || Number(mfgId) || 1);
      mfgEmailsMap[mfgKey] = emails;
    });

    try {
      await dispatch(
        shareVariantWithManufacturer({
          variantId: numericVariantId,
          manufacturer_ids: mfgNumericIds,
          emails: mfgEmailsMap,
        })
      ).unwrap();

      const newRecords: HandoffRecord[] = selectedIndices.map((idx) => {
        const mfg = manufacturers[idx];
        return {
          id: String(mfg.id),
          manufacturer: mfg,
          dateSent: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          stageIndex: 0,
          responseStatus: 'Pending',
          quote: undefined,
          note: sendNote.trim() || undefined,
        };
      });
      setRecords(newRecords);
      onStatusChange?.();
      setShowSendModal(false);
      toast.success(
        selectedIndices.length === 1
          ? 'Design sent to manufacturer successfully!'
          : `Design sent to ${selectedIndices.length} manufacturers successfully!`
      );
      dispatch(fetchDesignVariantManufacturerShares({ variantId: numericVariantId }));
    } catch (err: any) {
      console.error('[ManufacturerHandoffPanel] Sharing failed:', err);
      toast.error(String(err || 'Failed to share design with manufacturers.'));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (index: number) => {
    const numericVariantId = Number(variantId);
    if (!numericVariantId || isNaN(numericVariantId)) {
      toast.error('No valid variant ID found. Cannot resend emails.');
      return;
    }

    setResendingIndex(index);
    try {
      await dispatch(resendManufacturerEmails({ variantId: numericVariantId })).unwrap();
      toast.success('Emails resent successfully!');

      setRecords((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = {
            ...next[index],
            dateSent: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          };
        }
        return next;
      });

      dispatch(fetchDesignVariantManufacturerShares({ variantId: numericVariantId }));
      onStatusChange?.();
    } catch (err: any) {
      console.error('[ManufacturerHandoffPanel] Resend failed:', err);
      toast.error(err || 'Failed to resend emails.');
    } finally {
      setResendingIndex(null);
    }
  };

  const handleApproveQuote = async (idx: number) => {
    const record = records[idx];
    if (!record || record.id === 'm1') {
      toast.error('Invalid quote reference.');
      return;
    }
    if (!record.quoteId) {
      toast.error('No quote ID available for this action.');
      return;
    }
    setApprovingIdx(idx);
    try {
      await dispatch(approveQuote({ quoteId: record.quoteId })).unwrap();
      toast.success('Quote approved successfully!');
      if (variantId) {
        await dispatch(fetchDesignVariantManufacturerShares({ variantId })).unwrap();
      }
      onStatusChange?.();
    } catch (err: any) {
      console.error('[ManufacturerHandoffPanel] Approval failed:', err);
      toast.error(err || 'Failed to approve quote.');
    } finally {
      setApprovingIdx(null);
    }
  };

  const handleRejectQuote = async (idx: number) => {
    const record = records[idx];
    if (!record || record.id === 'm1') {
      toast.error('Invalid quote reference.');
      return;
    }
    if (!record.quoteId) {
      toast.error('No quote ID available for this action.');
      return;
    }
    setRejectingIdx(idx);
    try {
      await dispatch(rejectQuote({ quoteId: record.quoteId })).unwrap();
      toast.success('Quote rejected successfully!');
      if (variantId) {
        await dispatch(fetchDesignVariantManufacturerShares({ variantId })).unwrap();
      }
      onStatusChange?.();
    } catch (err: any) {
      console.error('[ManufacturerHandoffPanel] Rejection failed:', err);
      toast.error(err || 'Failed to reject quote.');
    } finally {
      setRejectingIdx(null);
    }
  };

  const handleToggleManufacturer = (idx: number) => {
    const mfg = manufacturers[idx];
    setSelectedIndices((prev) => {
      const isNowSelected = !prev.includes(idx);
      if (isNowSelected) {
        setSelectedEmailMap((map) => ({
          ...map,
          [mfg.id]: mfg.emails?.map((e) => e.value) || [],
        }));
        return [...prev, idx];
      } else {
        setSelectedEmailMap((map) => {
          const next = { ...map };
          delete next[mfg.id];
          return next;
        });
        return prev.filter((i) => i !== idx);
      }
    });
  };

  const handleToggleManufacturerEmail = (mfgId: string, emailValue: string) => {
    setSelectedEmailMap((prev) => {
      const current = prev[mfgId] || [];
      const next = current.includes(emailValue)
        ? current.filter((e) => e !== emailValue)
        : [...current, emailValue];
      return { ...prev, [mfgId]: next };
    });
  };

  if (sharesLoading) {
    return (
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <ShimmerLoader />
        </div>
        <div className="w-full xl:w-[260px] flex-shrink-0">
          <div className="rounded-[20px] p-4 sm:p-5 bg-[#FAFAF8] dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04)] border border-black/[0.04] dark:border-white/[0.08] animate-pulse">
            <div className="h-4 w-32 bg-gray-200 dark:bg-surface-200 rounded mb-3"></div>
            <div className="h-3.5 w-full bg-gray-200 dark:bg-surface-200 rounded mb-4"></div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 w-full bg-gray-200 dark:bg-surface-150 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <>
        <div className="w-full flex flex-col items-center md:py-16 md:px-8 p-5">
          <div className="flex flex-col items-center text-center max-w-[400px] w-full rounded-[24px] px-10 py-12 bg-white dark:bg-surface-150 shadow-[0_4px_24px_rgba(0,0,0,0.04),_0_1px_4px_rgba(0,0,0,0.03)] border border-black/[0.05] dark:border-border-default">
            <div
              className="w-14 h-14 flex items-center justify-center rounded-[14px] mb-5 bg-violet-500/10"
            >
              <i className="ri-building-4-line text-[24px] text-[#8B5CF6]"></i>
            </div>
            <h3 className="text-[17px] font-semibold text-[#1A1A1A] dark:text-ink mb-2 font-satoshi">
              No design sent to manufacturer yet
            </h3>
            <p className="text-[13px] text-[#9CA3AF] dark:text-ink-600 leading-relaxed mb-6">
              Once a design is approved, send it to a manufacturer to begin production.
            </p>
            <button
              onClick={() => onGenerateDetailSheet?.()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-all duration-150 cursor-pointer whitespace-nowrap hover:opacity-90 active:scale-[0.98] bg-[#3B82F6] shadow-[0px_4px_14px_rgba(59,130,246,0.28)] dark:text-black dark:bg-[#60A5FA]"
            >
              <i className="ri-file-list-3-line text-[15px]"></i>
              {isSheetSaved ? 'Continue Generating Detail Sheet' : 'Generate Detail Sheet'}
            </button>
            <p className="text-[11.5px] text-[#C4C4C4] dark:text-ink-600 mt-4">Review specifications before sending to manufacturers</p>
          </div>
        </div>
        {showSendModal && (
          <SendToManufacturerModal
            selectedIndices={selectedIndices}
            onToggle={handleToggleManufacturer}
            selectedEmailMap={selectedEmailMap}
            onToggleEmail={handleToggleManufacturerEmail}
            note={sendNote}
            onNoteChange={setSendNote}
            onClose={() => setShowSendModal(false)}
            onSend={handleSend}
            sending={sending}
            error={sendError}
            manufacturers={manufacturers}
            onAddManufacturer={(mfg) => setManufacturers((prev) => [...prev, mfg])}
            loading={manufacturersLoading}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row gap-5">
      <div className="flex-1 min-w-0 flex flex-col gap-5">

        {/* Sent Manufacturers List */}
        <div className="rounded-[20px] p-4 sm:p-6 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-black/[0.05] dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#1A1A1A] dark:text-ink font-satoshi">
              Manufacturers Contacted
            </h3>
            <span className="text-[11px] sm:text-[11.5px] font-medium text-[#9CA3AF] dark:text-[#A1A8B3] px-2.5 py-1 rounded-full bg-[#F3F4F6] dark:bg-surface-150 border border-transparent dark:border-border-default">
              {records.length} sent
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record) => {
                const originalIdx = records.findIndex((r) => r.id === record.id);
                const rs = record.responseStatus;
                const isApproved = rs === 'Approved' || rs === 'InProduction' || rs === 'Completed';
                const hasQuote = !!record.quote;
                const isDeclined = rs === 'Declined';

                const statusConfig = isApproved
                  ? { bgClass: 'bg-green-500/10 dark:bg-green-500/20', textClass: 'text-green-600 dark:text-green-400', dotClass: 'bg-green-500', label: rs === 'Completed' ? 'Completed' : rs === 'InProduction' ? 'In Production' : 'Approved' }
                  : hasQuote
                    ? { bgClass: 'bg-blue-500/10 dark:bg-blue-500/20', textClass: 'text-blue-600 dark:text-blue-400', dotClass: 'bg-blue-500', label: 'Quote Received' }
                    : isDeclined
                      ? { bgClass: 'bg-red-500/10 dark:bg-red-500/20', textClass: 'text-red-600 dark:text-red-400', dotClass: 'bg-red-500', label: 'Declined' }
                      : { bgClass: 'bg-amber-500/10 dark:bg-amber-500/20', textClass: 'text-amber-600 dark:text-amber-400', dotClass: 'bg-amber-500', label: rs === 'Viewed' ? 'Viewed' : 'Pending Response' };

                const cardClass = isApproved
                  ? 'border-[1.5px] border-green-500/25 dark:border-green-500/30 bg-green-50/60 dark:bg-green-950/10'
                  : hasQuote
                    ? 'border-[1.5px] border-blue-500/20 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/10'
                    : 'border border-black/[0.05] dark:border-border-default bg-[#FAFAF8] dark:bg-surface-150';

                return (
                  <div
                    key={record.manufacturer.name + originalIdx}
                    className={`rounded-[14px] transition-all ${cardClass}`}
                  >
                    {/* Manufacturer Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4">
                      {/* Left Side: Avatar + Details */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] font-bold text-white flex-shrink-0 ${getAvatarBgClass(record.manufacturer.avatarColor)}`}
                        >
                          {record.manufacturer.initials || getInitials(record.manufacturer.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] sm:text-[13.5px] font-semibold text-[#1A1A1A] dark:text-ink">{record.manufacturer.name}</p>
                            {record.manufacturer.verified && (
                              <span className="text-[9.5px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgba(34,197,94,0.10)] dark:bg-green-500/10 text-[#16A34A] dark:text-green-400">Verified</span>
                            )}
                          </div>
                          <p className="text-[11px] sm:text-[11.5px] text-[#9CA3AF] dark:text-[#A1A8B3] mt-0.5">
                            {record.manufacturer.specialty} · {record.manufacturer.location}
                          </p>
                          <p className="text-[10.5px] sm:text-[11px] text-[#C4C4C4] dark:text-[#D1D5DB] mt-0.5">Sent {record.dateSent}</p>
                        </div>
                      </div>

                      {/* Right Side: Badges */}
                      <div className="flex items-center gap-2 sm:self-auto self-start sm:ml-0 ml-[54px] flex-shrink-0">
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold whitespace-nowrap ${statusConfig.bgClass} ${statusConfig.textClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConfig.dotClass}`} />
                          <span>{statusConfig.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Inline Quote Section */}
                    {hasQuote && record.quote && (
                      <div
                        className="mx-4 mb-4 rounded-[12px] overflow-hidden bg-white dark:bg-surface-100 border border-blue-500/10 dark:border-blue-500/20 border-l-[3px] border-l-blue-500"
                      >
                        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 flex items-center justify-center">
                              <i className="ri-file-list-3-line text-[14px] text-[#3B82F6] dark:text-brand"></i>
                            </span>
                            <p className="text-[12px] font-semibold text-[#1A1A1A] dark:text-ink">Quotation</p>
                          </div>
                          <p className="text-[11px] text-[#9CA3AF] dark:text-[#D1D5DB]">{record.quote.receivedAt}</p>
                        </div>

                        <div className="px-4 pb-3 flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 rounded-[10px] px-3 py-2 bg-[#F0F9FF] dark:bg-blue-500/10 border border-blue-500/10 dark:border-blue-500/20">
                              <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#D1D5DB] uppercase tracking-wider mb-0.5">Quoted Price</p>
                              <p className="text-[16px] font-bold text-[#1A1A1A] dark:text-ink">${record.quote.amount} <span className="text-[11px] font-medium text-[#9CA3AF] dark:text-ink-600">{record.quote.currency}</span></p>
                            </div>
                            <div className="flex-1 rounded-[10px] px-3 py-2 bg-[#F0FDF4] dark:bg-green-500/10 border border-green-500/10 dark:border-green-500/20">
                              <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#D1D5DB] uppercase tracking-wider mb-0.5">Est. Delivery</p>
                              <p className="text-[16px] font-bold text-[#1A1A1A] dark:text-ink">{record.quote.deliveryDays} <span className="text-[11px] font-medium text-[#9CA3AF] dark:text-ink-600">days</span></p>
                            </div>
                          </div>

                          {record.quote.notes && (
                            <div className="rounded-[10px] px-3 py-2.5 bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.04] dark:border-border-default">
                              <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#D1D5DB] uppercase tracking-wider mb-1">Manufacturer Notes</p>
                              <p className="text-[12px] sm:text-[13px] text-[#374151] dark:text-ink leading-relaxed break-all break-words whitespace-pre-wrap max-h-[120px] overflow-y-auto custom-scrollbar pr-1">{record.quote.notes}</p>
                            </div>
                          )}

                          {rs === 'QuoteReceived' && (
                            <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                              <button
                                onClick={() => handleApproveQuote(originalIdx)}
                                disabled={approvingIdx === originalIdx || rejectingIdx === originalIdx}
                                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-[12px] sm:text-[12.5px] font-semibold text-white transition-all cursor-pointer hover:opacity-90 disabled:opacity-60 min-w-0 bg-[linear-gradient(135deg,#16A34A_0%,#15803D_100%)] shadow-[0_4px_14px_rgba(22,163,74,0.25)] dark:text-black"
                              >
                                {approvingIdx === originalIdx ? (
                                  <>
                                    <span className="w-4 h-4 flex items-center justify-center">
                                      <i className="ri-loader-4-line text-[14px] animate-spin"></i>
                                    </span>
                                    Approving...
                                  </>
                                ) : (
                                  <>
                                    <span className="w-4 h-4 flex items-center justify-center">
                                      <i className="ri-checkbox-circle-line text-[14px]"></i>
                                    </span>
                                    Approve Quote
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleRejectQuote(originalIdx)}
                                disabled={approvingIdx === originalIdx || rejectingIdx === originalIdx}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] text-[12px] sm:text-[12.5px] font-semibold text-[#DC2626] transition-all cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10 border border-red-200 dark:border-red-500/30 disabled:opacity-40 min-w-0"
                              >
                                {rejectingIdx === originalIdx ? (
                                  <>
                                    <span className="w-4 h-4 flex items-center justify-center">
                                      <i className="ri-loader-4-line text-[14px] animate-spin"></i>
                                    </span>
                                    Rejecting...
                                  </>
                                ) : (
                                  <>
                                    <span className="w-4 h-4 flex items-center justify-center">
                                      <i className="ri-close-circle-line text-[14px]"></i>
                                    </span>
                                    Reject Quote
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-[#FAFAF8] dark:bg-surface-150 rounded-[14px] border border-black/[0.05] dark:border-border-default">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-black/[0.03] dark:bg-white/[0.03] mb-3">
                  <i className="ri-information-line text-[18px] text-[#9CA3AF]"></i>
                </div>
                <p className="text-[13px] text-[#9CA3AF] dark:text-[#D1D5DB] font-medium px-4">
                  {activeFilter === 'Pending' && "No manufacturers with Pending Response status."}
                  {activeFilter === 'QuoteReceived' && "No manufacturers with Quote Received status."}
                  {activeFilter === 'Declined' && "No manufacturers with Declined status."}
                  {!activeFilter && "No manufacturers contacted yet."}
                </p>
              </div>
            )}
          </div>

          {/* Resend / Update actions */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-black/[0.05] dark:border-border-default">
            <button
              onClick={() => handleResend(0)}
              disabled={resendingIndex !== null || !!approvedRecord}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] text-[12.5px] font-medium text-[#6B7280] dark:text-ink bg-white dark:bg-surface-100 border border-gray-200 dark:border-border-default hover:bg-gray-50 dark:hover:bg-surface-150 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className={`${resendingIndex === 0 ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} text-[13px]`}></i>
              </span>
              {resendingIndex === 0 ? 'Resending...' : 'Resend All'}
            </button>
            {/* <button
              onClick={onGoToDesign}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[12.5px] font-medium text-[#8B5CF6] transition-all cursor-pointer whitespace-nowrap hover:bg-purple-50 dark:hover:bg-purple-500/10 border border-transparent hover:border-purple-100 dark:hover:border-purple-500/20"
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-pencil-line text-[13px]"></i>
              </span>
              Update Design
            </button> */}
          </div>
        </div>

        {/* Approved Manufacturer Details + Timeline — only shown after approval */}
        {approvedRecord && (
          <div className="flex flex-col gap-5">
            {/* Manufacturer Detail Card */}
            <div className="rounded-[20px] p-6 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-border-default">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-semibold text-[#1A1A1A] dark:text-ink font-satoshi">
                  Approved Manufacturer
                </h3>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${approvedRecord.responseStatus === 'Completed' ? 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${approvedRecord.responseStatus === 'Completed' ? 'bg-green-500' : 'bg-blue-500'}`}
                  />
                  {approvedRecord.responseStatus === 'Completed' ? 'Completed' : PRODUCTION_STAGES[approvedRecord.stageIndex]?.label}
                </div>
              </div>

              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0 bg-violet-500/10">
                  <i className="ri-hammer-line text-[20px] text-[#8B5CF6]"></i>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#1A1A1A] dark:text-ink">{approvedRecord.manufacturer.name}</p>
                  <p className="text-[12.5px] text-[#9CA3AF] dark:text-[#D1D5DB] mt-0.5">{approvedRecord.manufacturer.specialty}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11.5px] text-[#C4C4C4] dark:text-ink-600">{approvedRecord.manufacturer.location}</span>
                    <span className="w-1 h-1 rounded-full bg-[#D1D5DB] dark:bg-border-default" />
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${approvedRecord.manufacturer.verified ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}
                    >
                      {approvedRecord.manufacturer.verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#C4C4C4] dark:text-[#D1D5DB] mt-1">Sent on {approvedRecord.dateSent}</p>
                  {approvedRecord.approvedAt && (
                    <p className="text-[11.5px] text-[#16A34A] dark:text-green-400 mt-0.5">Approved on {approvedRecord.approvedAt}</p>
                  )}
                </div>
              </div>

              {approvedRecord.quote && (
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-[12px] px-4 py-3 bg-[#F0FDF4] dark:bg-green-950/20 border border-green-500/10 dark:border-green-500/20">
                    <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#D1D5DB] uppercase tracking-wider mb-0.5">Approved Quote</p>
                    <p className="text-[16px] font-bold text-[#1A1A1A] dark:text-ink">${approvedRecord.quote.amount}</p>
                    <p className="text-[10.5px] text-[#9CA3AF] dark:text-ink-600">{approvedRecord.quote.currency}</p>
                  </div>
                  <div className="rounded-[12px] px-4 py-3 bg-[#F0F9FF] dark:bg-blue-950/20 border border-blue-500/10 dark:border-blue-500/20">
                    <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#D1D5DB] uppercase tracking-wider mb-0.5">Est. Delivery</p>
                    <p className="text-[16px] font-bold text-[#1A1A1A] dark:text-ink">{approvedRecord.quote.deliveryDays} days</p>
                    <p className="text-[10.5px] text-[#9CA3AF] dark:text-ink-600">business days</p>
                  </div>
                </div>
              )}

              {approvedRecord.note && (
                <div className="rounded-[12px] px-4 py-3 mb-5 bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.04] dark:border-border-default">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#D1D5DB] mb-1">Your Note</p>
                  <p className="text-[12px] sm:text-[13px] text-[#374151] dark:text-ink leading-relaxed break-all break-words whitespace-pre-wrap max-h-[120px] overflow-y-auto custom-scrollbar pr-1">{approvedRecord.note}</p>
                </div>
              )}

              <div className="flex items-center gap-2 px-4 py-3 rounded-[12px] bg-[#F0FDF4] dark:bg-green-950/20 border border-[#BBF7D0] dark:border-green-500/30">
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className="ri-checkbox-circle-line text-[14px] text-[#16A34A] dark:text-green-400"></i>
                </span>
                <p className="text-[12.5px] text-[#15803D] dark:text-green-400">
                  Quotation approved. Production has been initiated with this manufacturer.
                </p>
              </div>
            </div>

            {/* Production Timeline */}
            <div className="rounded-[20px] p-6 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-border-default">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A] dark:text-ink mb-4 font-satoshi">
                Production Timeline
              </h3>
              <div className="flex flex-col gap-0">
                {PRODUCTION_STAGES.map((stage, sIdx) => {
                  const isDone = sIdx <= approvedRecord.stageIndex;
                  const isCurrent = sIdx === approvedRecord.stageIndex;
                  const isLast = sIdx === PRODUCTION_STAGES.length - 1;
                  return (
                    <div key={stage.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-300 ${isDone ? 'bg-[#6366F1]' : 'bg-[#E5E7EB] dark:bg-surface-150'}`}
                        >
                          {isDone ? (
                            <i className="ri-check-line text-[12px] text-white"></i>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-[#D1D5DB] dark:bg-border-default" />
                          )}
                        </div>
                        {!isLast && (
                          <div
                            className={`w-px flex-1 min-h-[28px] transition-colors duration-300 ${sIdx < approvedRecord.stageIndex ? 'bg-[#6366F1]' : 'bg-[#E5E7EB] dark:bg-border-default'}`}
                          />
                        )}
                      </div>
                      <div className="pb-4 pt-0.5">
                        <p className={`text-[13px] font-medium transition-colors duration-300 ${isCurrent ? 'text-[#1A1A1A] dark:text-ink' : isDone ? 'text-[#6B7280] dark:text-ink-600' : 'text-[#C4C4C4] dark:text-[#A1A8B3]'}`}>
                          {stage.label}
                        </p>
                        {isCurrent && <p className="text-[11px] text-[#9CA3AF] dark:text-[#D1D5DB] mt-0.5">Current stage</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Simulation Panel */}
      {!isSimulationHidden && (
        <div className="w-full xl:w-[260px] flex-shrink-0">
          <div className="rounded-[20px] p-4 sm:p-5 bg-[#FAFAF8] dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/[0.08]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#A1A8B3] mb-3">
              Simulate Manufacturer
            </p>
            <p className="text-[12px] text-[#9CA3AF] dark:text-[#D1D5DB] mb-4 leading-relaxed">
              Simulate manufacturer responses to preview each status.
            </p>

            <div className="flex flex-col gap-1.5">
              {!approvedRecord ? (
                // Initial stages filters
                (['Pending', 'QuoteReceived', 'Declined'] as MfgResponseStatus[]).map((rs) => {
                  const active = activeFilter === rs;
                  const labels: Record<string, string> = { Pending: 'Pending Response', QuoteReceived: 'Quote Received', Declined: 'Declined' };
                  return (
                    <button
                      key={rs}
                      onClick={() => {
                        setActiveFilter((prev) => (prev === rs ? null : rs));
                      }}
                      className={`w-full text-left px-3 py-2 rounded-[10px] text-[12px] font-medium transition-all cursor-pointer ${active ? 'bg-[#6366F1] text-white' : 'text-[#6B7280] dark:text-ink-600 hover:bg-[#F3F4F6] dark:hover:bg-surface-150'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-[#D1D5DB]'}`} />
                        {labels[rs]}
                      </span>
                    </button>
                  );
                })
              ) : (
                // Production stages simulation
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C4C4C4] px-1 mb-0.5">Production Stages</p>
                  {PRODUCTION_STAGES.slice(3).map((stage, i) => {
                    const sIdx = i + 3;
                    const active = approvedRecord.stageIndex === sIdx;
                    return (
                      <button
                        key={stage.key}
                        onClick={() => {
                          setRecords((prev) => {
                            const next = [...prev];
                            const aIdx = next.findIndex((r) => r.responseStatus === 'Approved' || r.responseStatus === 'InProduction' || r.responseStatus === 'Completed');
                            if (aIdx !== -1) {
                              next[aIdx] = {
                                ...next[aIdx],
                                stageIndex: sIdx,
                                responseStatus: stage.key as MfgResponseStatus,
                              };
                            }
                            return next;
                          });
                          onStatusChange?.();
                        }}
                        className={`w-full text-left px-3 py-2 rounded-[10px] text-[12px] font-medium transition-all cursor-pointer ${active ? 'bg-[#6366F1] text-white' : 'text-[#6B7280] dark:text-ink-600 hover:bg-[#F3F4F6] dark:hover:bg-surface-150'}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-[#D1D5DB]'}`} />
                          {stage.label}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {showSendModal && (
        <SendToManufacturerModal
          selectedIndices={selectedIndices}
          onToggle={handleToggleManufacturer}
          selectedEmailMap={selectedEmailMap}
          onToggleEmail={handleToggleManufacturerEmail}
          note={sendNote}
          onNoteChange={setSendNote}
          onClose={() => setShowSendModal(false)}
          onSend={handleSend}
          sending={sending}
          error={sendError}
          manufacturers={manufacturers}
          onAddManufacturer={(mfg) => setManufacturers((prev) => [...prev, mfg])}
          loading={manufacturersLoading}
        />
      )}
    </div>
  );
}

interface NewMfgForm {
  name: string;
  emails: { label: string; value: string }[];
  phone: string;
  location: string;
}

function SendToManufacturerModal({
  selectedIndices,
  onToggle,
  selectedEmailMap,
  onToggleEmail,
  note,
  onNoteChange,
  onClose,
  onSend,
  sending,
  error,
  manufacturers,
  onAddManufacturer,
  loading,
}: {
  selectedIndices: number[];
  onToggle: (index: number) => void;
  selectedEmailMap: Record<string, string[]>;
  onToggleEmail: (mfgId: string, emailValue: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
  error: boolean;
  manufacturers: any[];
  onAddManufacturer: (m: any) => void;
  loading: boolean;
}) {
  const dispatch = useAppDispatch();
  const isFetchingRef = useRef(false);
  const { items: dbManufacturers, total, listStatus } = useAppSelector((state) => state.retailerManufacturer);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMfg, setNewMfg] = useState<NewMfgForm>({ name: '', emails: [{ label: 'Work', value: '' }], phone: '', location: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const [addMfgError, setAddMfgError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedSpecialty, setSelectedSpecialty] = useState(SPECIALTIES[0]);
  const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false);
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');

  useEffect(() => {
    dispatch(resetManufacturers());
    isFetchingRef.current = false;
  }, [dispatch]);

  useEffect(() => {
    dispatch(resetManufacturers());
    isFetchingRef.current = true;
    const timer = setTimeout(() => {
      dispatch(listManufacturers({
        skip: 0,
        limit: 10,
        search: search.trim() || undefined,
        append: false
      })).then(() => {
        isFetchingRef.current = false;
      }).catch(() => {
        isFetchingRef.current = false;
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      isFetchingRef.current = false;
    };
  }, [dispatch, search]);

  const filtered = useMemo(() => {
    return manufacturers;
  }, [manufacturers]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 30) {
      if (listStatus !== 'loading' && !isFetchingRef.current && dbManufacturers && dbManufacturers.length < total) {
        isFetchingRef.current = true;
        dispatch(
          listManufacturers({
            skip: dbManufacturers.length,
            limit: 10,
            search: search.trim() || undefined,
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

  const handleAddAndSelect = async () => {
    setAddError(null);
    setErrors({});
    const errs: Record<string, string> = {};

    if (!newMfg.name.trim()) {
      errs.name = 'Manufacturer name is required';
      setAddMfgError(true);
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMfg.name.trim())) {
      errs.name = 'Manufacturer Name cannot be an email address';
    }

    const validEmails = newMfg.emails.filter((em) => em.value.trim());
    if (validEmails.length === 0) {
      errs.email = 'At least one email is required';
    } else {
      const invalid = validEmails.find((em) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim()));
      if (invalid) {
        errs.email = `Invalid email format: ${invalid.value.trim()}`;
      }
    }

    const phoneMaxLength = getPhoneMaxLength(phoneCountryCode);
    const normalizedPhone = sanitizePhoneDigits(newMfg.phone, phoneMaxLength);
    if (!normalizedPhone) {
      errs.phone = 'Phone number is required.';
    } else if (normalizedPhone.length !== phoneMaxLength) {
      errs.phone = getPhoneLengthMessage(phoneCountryCode);
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setAddMfgError(false);

    const initials = newMfg.name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

    // Create new manufacturer in database
    const newEntryPayload = {
      name: newMfg.name.trim(),
      speciality: selectedSpecialty.label,
      emails: validEmails.map(em => ({ label: em.label || 'Work', email: em.value })),
      phone_number: `${phoneCountryCode}${normalizedPhone}`,
      location: newMfg.location.trim() || 'N/A',
    };

    try {
      const response = await dispatch(createManufacturer(newEntryPayload)).unwrap();
      const newEntry = {
        id: String(response.id),
        name: response.name,
        initials,
        avatarColor: '#C7D2FE',
        specialty: response.speciality || selectedSpecialty.label,
        location: response.location || '—',
        verified: false,
        status: 'Available' as const,
        avgResponseTime: '—',
        totalRequests: 0,
        completedRequests: 0,
        emails: response.emails?.map(e => ({ label: e.label || 'Work', value: e.email })) || [],
      };
      onAddManufacturer(newEntry);
      dispatch(listManufacturers({ skip: 0, limit: 100, forceRefresh: true }));
    } catch (err: any) {
      console.error('[SendToManufacturerModal] Failed to create manufacturer:', err);
      toast.error('Failed to create manufacturer. Adding locally instead.');
      // Local fallback
      const newEntry = {
        id: `custom-${Date.now()}`,
        name: newMfg.name.trim(),
        initials,
        avatarColor: '#C7D2FE',
        specialty: selectedSpecialty.label,
        location: newMfg.location.trim() || '—',
        verified: false,
        status: 'Available' as const,
        avgResponseTime: '—',
        totalRequests: 0,
        completedRequests: 0,
        emails: validEmails,
      };
      onAddManufacturer(newEntry);
    }

    setNewMfg({ name: '', emails: [{ label: 'Work', value: '' }], phone: '', location: '' });
    setSelectedSpecialty(SPECIALTIES[0]);
    setShowSpecialtyDropdown(false);
    setPhoneCountryCode('+1');
    setShowAddForm(false);
    setAddError(null);
    setSearch('');
  };

  return (
    <div className="fixed inset-0 z-[9999] sm:flex sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-full max-w-[480px] mx-4 rounded-[20px] overflow-hidden flex flex-col max-h-[85vh] bg-white dark:bg-surface-100 shadow-[0px_24px_64px_rgba(0,0,0,0.14),_0px_4px_16px_rgba(0,0,0,0.06)] border border-hairline animate-[fadeUp_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-violet-500/10">
                <i className="ri-send-plane-line text-[15px] text-[#8B5CF6]"></i>
              </div>
              <h3 className="text-[15px] font-semibold text-[#1A1A1A] dark:text-ink font-satoshi">
                Send to Manufacturer
              </h3>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="w-10 h-10 touch-target rounded-full hover:bg-[#F3F4F6] dark:hover:bg-surface-150 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-[20px] text-[#9CA3AF] dark:text-[#A1A8B3]"></i>
            </button>
          </div>
        </div>

        <div className="px-6 pb-3 flex-shrink-0">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <i className="ri-search-line text-[14px] text-[#BDBDBD] dark:text-[#A1A8B3]"></i>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value.trimStart())}
              onBlur={() => setSearch(search.trim())}
              placeholder="Search by name, specialty, or location..."
              className="w-full pl-10 pr-4 py-2.5 rounded-[12px] text-[16px] sm:text-[13px] text-[#1A1A1A] dark:text-ink placeholder:text-sm placeholder:text-[#C4C4C4] dark:placeholder:text-ink-400 outline-none bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.06] dark:border-border-default font-inter"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6" onScroll={handleScroll}>
          {((listStatus === 'loading' || listStatus === 'idle') && dbManufacturers.length === 0) ? (
            <ModalShimmerLoader />
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {filtered.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-[13px] text-[#9CA3AF]">No manufacturers found</p>
                  </div>
                )}
                {filtered.map((m, i) => {
                  const isSelected = selectedIndices.includes(i);
                  const badge = statusBadgeMap[m.status] ?? statusBadgeMap['Available'];
                  const hasMultipleEmails = (m.emails?.length ?? 0) > 1;
                  const selectedEmails = selectedEmailMap?.[m.id] || [];
                  return (
                    <div key={m.id} className="flex flex-col">
                      <button
                        onClick={() => onToggle(i)}
                        className={`w-full text-left rounded-[14px] p-4 transition-all cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20' : 'bg-[#FAFAF8] dark:bg-surface-150 border border-transparent hover:border-black/[0.06] dark:hover:border-border-default'}`}
                      >
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 ${getAvatarBgClass(m.avatarColor)}`}
                          >
                            {m.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <p className="text-[13.5px] font-semibold text-[#1A1A1A] dark:text-ink">{m.name}</p>
                              <div
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${badge.bgClass} ${badge.textClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                                {m.status}
                              </div>
                            </div>
                            <p className="text-[11.5px] text-[#9CA3AF] dark:text-[#A1A8B3] mb-1.5">{m.specialty} · {m.location}</p>
                            <div className="flex items-center gap-3 text-[11px] text-[#9CA3AF] dark:text-[#A1A8B3] font-inter">
                              <span className="flex items-center gap-1"><i className="ri-time-line text-[11px]"></i>{m.avgResponseTime}</span>
                              <span className="flex items-center gap-1"><i className="ri-briefcase-line text-[11px]"></i>{m.totalRequests} requests</span>
                              <span className="flex items-center gap-1"><i className="ri-check-double-line text-[11px]"></i>{m.completedRequests} completed</span>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isSelected ? 'border-[#8B5CF6] bg-[#8B5CF6]' : 'border-[#D1D5DB]'}`}>
                            {isSelected && <i className="ri-check-line text-[12px] text-white"></i>}
                          </div>
                        </div>
                      </button>

                      {isSelected && hasMultipleEmails && (
                        <div className="sm:ml-[54px] ml-0 mt-1.5 mb-1 flex flex-col gap-1.5 min-w-0">
                          {m.emails && m.emails.map((em) => {
                            const emailSelected = selectedEmails.includes(em.value);
                            return (
                              <label
                                key={em.value}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] cursor-pointer select-none transition-colors ${emailSelected ? 'bg-violet-500/5 border border-violet-500/10' : 'bg-transparent border border-transparent'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleEmail(m.id, em.value);
                                }}
                              >
                                <div
                                  className={`w-[16px] h-[16px] rounded-[5px] flex items-center justify-center flex-shrink-0 transition-colors ${emailSelected
                                    ? 'bg-[#8B5CF6]'
                                    : 'bg-white dark:bg-surface-200 border border-[#D1D5DB] dark:border-border-default'
                                    }`}
                                >
                                  {emailSelected && (
                                    <i className="ri-check-line text-[11px] text-white" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {em.label && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 bg-slate-500/10 text-slate-500">
                                      {em.label}
                                    </span>
                                  )}
                                  <span className="text-[12px] text-[#374151] dark:text-ink truncate">
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
              </div>

              {listStatus === 'loading' && dbManufacturers.length > 0 && (
                <div className="mt-3">
                  <ModalShimmerLoader />
                </div>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddForm((v) => !v); setAddError(null); }}
                  className="flex items-center gap-1.5 w-full justify-center py-2.5 rounded-[10px] text-[12.5px] font-medium text-[#8B5CF6] hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors cursor-pointer border border-dashed border-purple-200 dark:border-purple-500/30"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className={`${showAddForm ? 'ri-subtract-line' : 'ri-add-line'} text-[14px]`}></i>
                  </span>
                  {showAddForm ? 'Cancel' : 'Add New Manufacturer'}
                </button>

                {showAddForm && (
                  <div className="mt-3 rounded-[14px] p-4 flex flex-col gap-3 bg-[#F7F6F3] dark:bg-surface-150 border border-violet-500/10 dark:border-purple-500/20">
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wide mb-1 block">
                          Manufacturer Name <span className="text-[#EF4444]">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ArtisanGold Co."
                          value={newMfg.name}
                          onChange={(e) => {
                            setNewMfg({ ...newMfg, name: e.target.value });
                            setErrors((prev) => ({ ...prev, name: '' }));
                          }}
                          className={`w-full px-3 py-2.5 rounded-[10px] text-[16px] sm:text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border ${errors.name ? 'border-danger-bright shadow-glow-danger-ring border-1.5' : 'border-black/[0.06] dark:border-border-default'} placeholder:text-[#C4C4C4] dark:placeholder:text-ink-400 max-sm:placeholder:text-[12px]`}
                        />
                        {errors.name && (
                          <p className="text-[12px] text-danger mt-1">{errors.name}</p>
                        )}
                      </div>

                      {addError && (
                        <div className="rounded-[10px] border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-500 font-inter">
                          {addError}
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wide mb-1.5 block">Specialty</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowSpecialtyDropdown((prev) => !prev)}
                            className="w-full px-3 py-2.5 rounded-[10px] text-[13px] text-[#1A1A1A] dark:text-ink outline-none border border-black/[0.06] dark:border-border-default flex items-center justify-between cursor-pointer bg-white dark:bg-surface-200 font-inter">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${selectedSpecialty.bg} ${selectedSpecialty.color}`}>
                              {selectedSpecialty.label}
                            </span>
                            <i className={`ri-arrow-down-s-line text-[14px] text-[#9CA3AF] transition-transform ${showSpecialtyDropdown ? 'rotate-180' : ''}`} />
                          </button>
                          {showSpecialtyDropdown && (
                            <div className="absolute left-0 right-0 top-full mt-1 rounded-[12px] p-1.5 z-[1002] bg-white dark:bg-surface-150 shadow-[0px_8px_32px_rgba(0,0,0,0.12),_0px_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.06] dark:border-border-default max-h-[160px] overflow-y-auto">
                              {SPECIALTIES.map((spec) => (
                                <button
                                  type="button"
                                  key={spec.label}
                                  onClick={() => { setSelectedSpecialty(spec); setShowSpecialtyDropdown(false); }}
                                  className="w-full text-left px-3 py-2 rounded text-[12.5px] font-medium flex items-center gap-2 cursor-pointer hover:bg-[#F7F6F3] dark:hover:bg-surface-200 text-[#1A1A1A] dark:text-ink"
                                >
                                  {spec.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wide">
                            Email Addresses <span className="text-[#EF4444]">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setNewMfg({ ...newMfg, emails: [...newMfg.emails, { label: 'Work', value: '' }] })}
                            className="text-[11px] font-semibold text-[#8B5CF6] dark:text-violet-accent hover:underline flex items-center gap-1 cursor-pointer select-none"
                          >
                            + Add another email
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          {newMfg.emails.map((em, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Label"
                                value={em.label}
                                onChange={(e) => {
                                  const newEmails = [...newMfg.emails];
                                  newEmails[idx].label = e.target.value;
                                  setNewMfg({ ...newMfg, emails: newEmails });
                                }}
                                className="w-[80px] px-3 py-2.5 rounded-[10px] text-[16px] sm:text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border border-black/[0.06] dark:border-border-default font-inter placeholder:text-[#C4C4C4] dark:placeholder:text-ink-400 max-sm:placeholder:text-[12px]"
                              />
                              <input
                                type="email"
                                placeholder="Email address"
                                value={em.value}
                                onChange={(e) => {
                                  const newEmails = [...newMfg.emails];
                                  newEmails[idx].value = e.target.value;
                                  setNewMfg({ ...newMfg, emails: newEmails });
                                  setErrors((prev) => ({ ...prev, email: '' }));
                                }}
                                className={`flex-1 min-w-0 px-3 py-2.5 rounded-[10px] text-[16px] sm:text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border ${errors.email ? 'border-danger-bright shadow-glow-danger-ring border-1.5' : 'border-black/[0.06] dark:border-border-default'} font-inter placeholder:text-[#C4C4C4] dark:placeholder:text-ink-400 max-sm:placeholder:text-[12px]`}
                              />
                              {newMfg.emails.length > 1 && (
                                <button
                                  type="button"
                                  aria-label="Remove email"
                                  onClick={() => {
                                    const newEmails = newMfg.emails.filter((_, i) => i !== idx);
                                    setNewMfg({ ...newMfg, emails: newEmails });
                                  }}
                                  className="w-9 h-9 flex items-center justify-center rounded-full bg-black/5 text-red-500 hover:bg-black/10 flex-shrink-0 cursor-pointer"
                                >
                                  <i className="ri-close-line text-[16px]" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {errors.email && (
                          <p className="text-[12px] text-danger mt-1">{errors.email}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wide mb-1 block">
                          Contact Number <span className="text-[#EF4444]">*</span>
                        </label>
                        <div className="flex gap-2 sm:gap-3">
                          <CountryCodeSelect
                            value={phoneCountryCode}
                            onChange={(code) => {
                              setPhoneCountryCode(code);
                              const maxLen = getPhoneMaxLength(code);
                              const sanitized = sanitizePhoneDigits(newMfg.phone, maxLen);
                              setNewMfg({ ...newMfg, phone: sanitized });
                              if (sanitized && sanitized.length !== maxLen) {
                                setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(code) }));
                              } else {
                                setErrors((prev) => ({ ...prev, phone: '' }));
                              }
                            }}
                            className="!bg-white dark:!bg-surface-200 !border-black/[0.06] dark:!border-border-default rounded-[10px] text-[16px] sm:text-[13px] text-[#1A1A1A] dark:text-ink outline-none !px-3 !py-2.5 !h-[42px]"
                          />
                          <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="Phone Number"
                            value={newMfg.phone}
                            maxLength={getPhoneMaxLength(phoneCountryCode)}
                            onChange={(e) => {
                              const maxLen = getPhoneMaxLength(phoneCountryCode);
                              const sanitized = sanitizePhoneDigits(e.target.value, maxLen);
                              setNewMfg({ ...newMfg, phone: sanitized });
                              if (sanitized && sanitized.length !== maxLen) {
                                setErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(phoneCountryCode) }));
                              } else {
                                setErrors((prev) => ({ ...prev, phone: '' }));
                              }
                            }}
                            className={`flex-1 px-3 py-2.5 rounded-[10px] text-[16px] sm:text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border font-inter min-w-0 ${errors.phone ? 'border-danger-bright shadow-glow-danger-ring border-1.5' : 'border-black/[0.06] dark:border-border-default'} placeholder:text-[#C4C4C4] dark:placeholder:text-ink-400 max-sm:placeholder:text-[12px]`}
                          />
                        </div>
                        {errors.phone && (
                          <p className="text-[12px] text-danger mt-1">{errors.phone}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wide mb-1 block">
                          Location <span className="lowercase font-normal text-[#9CA3AF]">(optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Milan, Italy"
                          value={newMfg.location}
                          onChange={(e) => setNewMfg({ ...newMfg, location: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-[10px] text-[16px] sm:text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border border-black/[0.06] dark:border-border-default font-inter placeholder:text-[#C4C4C4] dark:placeholder:text-ink-400 max-sm:placeholder:text-[12px]"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAndSelect}
                      className="w-full py-3 rounded-[12px] text-[13px] font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity bg-[linear-gradient(135deg,#8B5CF6_0%,#6366F1_100%)] shadow-[0_4px_16px_rgba(139,92,246,0.28)] font-inter"
                    >
                      Add & Select Manufacturer
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className="block text-[12px] font-semibold text-[#6B7280] dark:text-ink mb-1.5">
                  Note <span className="text-[#C4C4C4] font-normal">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => onNoteChange(e.target.value)}
                  placeholder="Add production instructions..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-[12px] text-[16px] sm:text-[13px] text-[#1A1A1A] dark:text-ink placeholder:text-[#C4C4C4] dark:placeholder:text-ink-400 outline-none resize-none bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.06] dark:border-border-default font-inter max-sm:placeholder:text-[12px]"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] mt-3 flex-shrink-0 font-inter">
                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-line text-[14px] text-[#EF4444]"></i>
                  </span>
                  <div>
                    <p className="text-[12.5px] font-medium text-[#B91C1C]">Failed to send request.</p>
                    <p className="text-[11.5px] text-[#DC2626] mt-0.5">Please try again.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-black/[0.05] dark:border-border-default pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <span className="text-[12.5px] text-[#9CA3AF] dark:text-[#A1A8B3]">
            {selectedIndices.length} manufacturer{selectedIndices.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
            <button onClick={onClose} className="px-4 py-2.5 rounded-[10px] text-[13px] font-medium text-[#6B7280] dark:text-ink-600 hover:bg-[#F3F4F6] dark:hover:bg-surface-150 transition-colors cursor-pointer w-full sm:w-auto justify-center border border-transparent dark:border-border-default">
              Cancel
            </button>
            <button
              onClick={onSend}
              disabled={sending || selectedIndices.length === 0 || selectedIndices.some((idx) => {
                const mfg = manufacturers[idx];
                return ((selectedEmailMap[mfg.id])?.length ?? 0) === 0;
              })}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-[10px] sm:text-[13px] text-[10px] font-semibold text-white transition-all cursor-pointer disabled:opacity-40 w-full sm:w-auto justify-center bg-violet-500"
            >
              {sending ? (
                <span className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line text-[14px] animate-spin"></i></span>
              ) : (
                <span className="w-4 h-4 flex items-center justify-center"><i className="ri-send-plane-line text-[13px]"></i></span>
              )}
              {sending ? 'Sending...' : 'Send Design'}
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeUp {
            from { transform: translateY(12px); opacity: 0.8; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
