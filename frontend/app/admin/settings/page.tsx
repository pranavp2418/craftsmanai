'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Info, AlertTriangle, User, Clock, ShieldCheck, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { AppLayout } from '@/src/components/app-layout';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useDebounce } from '@/src/utils/hooks/useDebounce';
import { fetchAdminSettings } from '@/redux/slices/admin/settings/adminSettingsSlice';
import { fetchAdminSettingsLogs, type AdminSettingsLog } from '@/redux/slices/admin/settings/adminSettingsLogsSlice';
import {
  updateAdminSettings,
  type AdminSettingsUpdatePayload,
} from '@/redux/slices/admin/settings/adminUpdateSettingsSlice';
import Pagination from '../dashboard/components/Pagination';

const REQUEST_STATUS_UI_TO_API: Record<string, string> = {
  'Pending Detection': 'PENDING_DETECTION',
  'Under Review': 'UNDER_REVIEW',
  Approved: 'APPROVED',
};

const CURRENCY_UI_TO_API: Record<string, string> = {
  'USD ($)': 'USD',
  'EUR (€)': 'EUR',
  'GBP (£)': 'GBP',
  'INR (₹)': 'INR',
};

const AI_PROVIDER_UI_TO_API: Record<string, string> = {
  'Provider A (GPT-4)': 'GPT_4',
  'Provider B (Claude)': 'CLAUDE',
  'Provider C (Gemini)': 'GEMINI',
};

const toDays = (value: number, unit: string): number => {
  if (unit === 'Weeks') return Math.max(1, Math.round(value * 7));
  if (unit === 'Hours') return Math.max(1, Math.ceil(value / 24));
  return Math.max(1, Math.round(value));
};

const clampRetryLimit = (value: number): number => Math.min(10, Math.max(3, Math.round(value)));
const clampTimeoutSeconds = (value: number): number =>
  Math.min(120, Math.max(10, Math.round(value)));

const SettingsPage = () => {
  const dispatch = useAppDispatch();
  const {
    data: settingsData,
    loading: settingsLoading,
    error: settingsError,
  } = useAppSelector((state) => state.adminSettings);
  const {
    logs: settingsLogs,
    pagination: settingsLogsPagination,
    loading: settingsLogsLoading,
    error: settingsLogsError,
  } = useAppSelector((state) => state.adminSettingsLogs);
  const { loading: updateSettingsLoading, error: updateSettingsError } = useAppSelector(
    (state) => state.adminUpdateSettings,
  );

  const [seedAttempted, setSeedAttempted] = useState(false);

  const [logsPage, setLogsPage] = useState(1);
  const logsLimit = 10;
  const [latestLogState, setLatestLogState] = useState<AdminSettingsLog | null>(null);

  const [activeTab, setActiveTab] = useState('features');
  const [requestStatus, setRequestStatus] = useState('Pending Detection');
  const [currency, setCurrency] = useState('USD ($)');
  const [leadTimeUnit, setLeadTimeUnit] = useState('Days');
  const [aiProvider, setAiProvider] = useState('Provider A (GPT-4)');
  const [retryLimits, setRetryLimits] = useState(3);
  const [timeoutDuration, setTimeoutDuration] = useState(30);
  const [linkExpiry, setLinkExpiry] = useState(7);
  const [linkExpiryUnit, setLinkExpiryUnit] = useState('Days');
  const debouncedTimeoutDuration = useDebounce(timeoutDuration, 600);
  const debouncedLinkExpiry = useDebounce(linkExpiry, 600);
  const debouncedRetryLimits = useDebounce(retryLimits, 600);
  const settingsHydratedRef = useRef(false);
  const hasFetchedSettings = useRef(false);
  const lastFetchedLogsPage = useRef<number | null>(null);
  const skipTimeoutSaveRef = useRef(false);
  const skipLinkExpirySaveRef = useRef(false);
  const skipRetrySaveRef = useRef(false);
  const requestStatusRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const aiProviderRef = useRef<HTMLDivElement>(null);
  const linkExpiryUnitRef = useRef<HTMLDivElement>(null);

  // Dropdown open states
  const [requestStatusOpen, setRequestStatusOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [aiProviderOpen, setAiProviderOpen] = useState(false);
  const [linkExpiryUnitOpen, setLinkExpiryUnitOpen] = useState(false);

  // Feature Toggles
  const [aiImageDetection, setAiImageDetection] = useState(true);
  const [guidedVisualQuiz, setGuidedVisualQuiz] = useState(true);
  const [promptOnlyFlow, setPromptOnlyFlow] = useState(true);
  const [manufacturerNotifications, setManufacturerNotifications] = useState(true);

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);

  const tabs = [
    // { id: 'platform', label: 'Platform & System Configuration' },
    { id: 'features', label: 'Feature Toggles & Notification' },
    { id: 'rules', label: 'Audit & Safety' },
  ];

  useEffect(() => {
    if (hasFetchedSettings.current) return;
    hasFetchedSettings.current = true;
    dispatch(fetchAdminSettings());
  }, [dispatch]);

  useEffect(() => {
    if (lastFetchedLogsPage.current === logsPage) return;
    lastFetchedLogsPage.current = logsPage;
    dispatch(fetchAdminSettingsLogs({ page: logsPage, limit: logsLimit }));
  }, [dispatch, logsPage]);

  useEffect(() => {
    if (settingsLogs.length > 0 && logsPage === 1) {
      setLatestLogState(settingsLogs[0]);
    }
  }, [settingsLogs, logsPage]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (requestStatusRef.current && !requestStatusRef.current.contains(target)) {
        setRequestStatusOpen(false);
      }
      if (currencyRef.current && !currencyRef.current.contains(target)) {
        setCurrencyOpen(false);
      }
      if (aiProviderRef.current && !aiProviderRef.current.contains(target)) {
        setAiProviderOpen(false);
      }
      if (linkExpiryUnitRef.current && !linkExpiryUnitRef.current.contains(target)) {
        setLinkExpiryUnitOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!settingsError || seedAttempted) return;
    if (!settingsError.toLowerCase().includes('system settings not found')) return;
    setSeedAttempted(true);
    void persistSettings(
      {
        maintenance_mode: false,
        allow_new_registrations: true,
        commission_rate: 0,
        contact_support_email: 'support@craftsman.ai',
      } as unknown as Partial<AdminSettingsUpdatePayload>,
      { allowBeforeHydration: true, showSuccessToast: false },
    );
  }, [settingsError, seedAttempted]);

  // Debounced save for timeout duration
  useEffect(() => {
    if (!settingsHydratedRef.current || !settingsData) return;
    if (skipTimeoutSaveRef.current) {
      skipTimeoutSaveRef.current = false;
      return;
    }
    const timeoutSeconds = clampTimeoutSeconds(Number(debouncedTimeoutDuration));
    if (timeoutSeconds !== settingsData.timeout_seconds) {
      void persistSettings({ timeout_seconds: timeoutSeconds });
    }
  }, [debouncedTimeoutDuration, settingsData]);

  // Debounced save for link expiry
  useEffect(() => {
    if (!settingsHydratedRef.current || !settingsData) return;
    if (skipLinkExpirySaveRef.current) {
      skipLinkExpirySaveRef.current = false;
      return;
    }
    const newDays = toDays(Number(debouncedLinkExpiry), linkExpiryUnit);
    if (newDays !== settingsData.link_expiry_days) {
      void persistSettings({ link_expiry_days: newDays });
    }
  }, [debouncedLinkExpiry, linkExpiryUnit, settingsData]);

  // Debounced save for retry limits
  useEffect(() => {
    if (!settingsHydratedRef.current || !settingsData) return;
    if (skipRetrySaveRef.current) {
      skipRetrySaveRef.current = false;
      return;
    }
    const retryLimit = clampRetryLimit(Number(debouncedRetryLimits));
    if (retryLimit !== settingsData.retry_limit) {
      void persistSettings({ retry_limit: retryLimit });
    }
  }, [debouncedRetryLimits, settingsData]);

  const latestLog = latestLogState;

  const buildSettingsPayload = (
    overrides: Partial<AdminSettingsUpdatePayload> = {},
  ): AdminSettingsUpdatePayload => {
    return {
      default_currency: CURRENCY_UI_TO_API[currency] ?? 'USD',
      default_request_status: REQUEST_STATUS_UI_TO_API[requestStatus] ?? 'PENDING_DETECTION',
      default_lead_time_unit: leadTimeUnit === 'Weeks' ? 'WEEKS' : 'DAYS',
      ai_provider: AI_PROVIDER_UI_TO_API[aiProvider] ?? 'GPT_4',
      retry_limit: clampRetryLimit(Number(retryLimits)),
      timeout_seconds: clampTimeoutSeconds(Number(timeoutDuration)),
      link_expiry_days: toDays(Number(linkExpiry), linkExpiryUnit),
      ai_image_detection: aiImageDetection,
      guided_visual_quiz: guidedVisualQuiz,
      prompt_only_flow: promptOnlyFlow,
      manufacturer_notifications: manufacturerNotifications,
      email_notifications: emailNotifications,
      in_app_notifications: inAppNotifications,
      ...overrides,
    };
  };

  const persistSettings = async (
    overrides: Partial<AdminSettingsUpdatePayload> = {},
    options: { allowBeforeHydration?: boolean; showSuccessToast?: boolean } = {},
  ) => {
    const { allowBeforeHydration = false, showSuccessToast = true } = options;
    if (!settingsHydratedRef.current && !allowBeforeHydration) return;

    try {
      const result = await dispatch(updateAdminSettings(buildSettingsPayload(overrides))).unwrap();
      hasFetchedSettings.current = true;
      lastFetchedLogsPage.current = 1;
      dispatch(fetchAdminSettings());
      setLogsPage(1);
      dispatch(fetchAdminSettingsLogs({ page: 1, limit: logsLimit }));

      if (showSuccessToast && settingsHydratedRef.current) {
        const message =
          typeof result === 'object' &&
            result !== null &&
            'message' in result &&
            typeof (result as { message?: unknown }).message === 'string'
            ? (result as { message: string }).message
            : 'Settings updated successfully.';
        toast.success(message);
      }
    } catch (error) {
      toast.error(String(error || 'Failed to update settings.'));
    }
  };

  const handleSaveSettings = async () => {
    await persistSettings();
  };

  const handleTimeoutBlur = () => {
    const nextValue = clampTimeoutSeconds(Number(timeoutDuration));
    setTimeoutDuration(nextValue);
  };

  const handleLinkExpiryBlur = () => {
    const nextValue = Math.max(1, Math.round(Number(linkExpiry)));
    setLinkExpiry(nextValue);
  };

  useEffect(() => {
    if (!settingsData) return;

    const requestStatusMap: Record<string, string> = {
      PENDING_DETECTION: 'Pending Detection',
      UNDER_REVIEW: 'Under Review',
      APPROVED: 'Approved',
    };

    const currencyMap: Record<string, string> = {
      USD: 'USD ($)',
      EUR: 'EUR (€)',
      GBP: 'GBP (£)',
      INR: 'INR (₹)',
    };

    const aiProviderMap: Record<string, string> = {
      GPT_4: 'Provider A (GPT-4)',
      CLAUDE: 'Provider B (Claude)',
      GEMINI: 'Provider C (Gemini)',
    };

    setRequestStatus(
      requestStatusMap[settingsData.default_request_status] ?? settingsData.default_request_status,
    );
    setCurrency(currencyMap[settingsData.default_currency] ?? settingsData.default_currency);
    setLeadTimeUnit(settingsData.default_lead_time_unit === 'WEEKS' ? 'Weeks' : 'Days');
    setAiProvider(aiProviderMap[settingsData.ai_provider] ?? settingsData.ai_provider);
    setRetryLimits(clampRetryLimit(settingsData.retry_limit));
    setTimeoutDuration(clampTimeoutSeconds(settingsData.timeout_seconds));
    setLinkExpiry(settingsData.link_expiry_days);
    setLinkExpiryUnit('Days');
    setAiImageDetection(settingsData.ai_image_detection);
    setGuidedVisualQuiz(settingsData.guided_visual_quiz);
    setPromptOnlyFlow(settingsData.prompt_only_flow);
    setManufacturerNotifications(settingsData.manufacturer_notifications);
    setEmailNotifications(settingsData.email_notifications);
    setInAppNotifications(settingsData.in_app_notifications);

    settingsHydratedRef.current = true;
    skipTimeoutSaveRef.current = true;
    skipLinkExpirySaveRef.current = true;
    skipRetrySaveRef.current = true;
  }, [settingsData]);

  return (
    <AppLayout
      appName="Craftsman.ai"
      headerTitle="Settings"
      headerDescription="Configure platform-level rules and defaults"
      notificationCount={3}
    >
      <div className="space-y-5 sm:space-y-6">
        {/* {settingsLoading && (
          <div className="px-4 py-3 rounded-lg border border-[#C2D8FC] bg-[#EBF3FE] text-[#1E40AF] text-sm">
            Loading admin settings...
          </div>
        )} */}

        {settingsError && (
          <div className="px-4 py-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] text-sm">
            {settingsError}
          </div>
        )}

        {settingsLogsError && (
          <div className="px-4 py-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] text-sm">
            {settingsLogsError}
          </div>
        )}

        {updateSettingsError && (
          <div className="px-4 py-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] text-sm">
            {updateSettingsError}
          </div>
        )}


        {/* Tabs */}
        <div className="overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="bg-white rounded-full p-1 inline-flex gap-1 min-w-max shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 sm:px-5 sm:py-2.5 tracking-wide rounded-full text-[13px] sm:text-[14px] transition-all duration-200 whitespace-nowrap ${activeTab === tab.id
                  ? 'bg-[#2F68C5] text-white shadow-sm'
                  : 'text-[#6D6D6D] hover:bg-gray-100'
                  }`}
                style={{ fontWeight: 500 }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Platform Tab Content */}
        {activeTab === 'platform' && (
          <div className="space-y-5 sm:space-y-6">
            {/* Platform Defaults Card */}
            <div
              className="bg-white rounded-2xl"
              style={{ boxShadow: '1px 1px 4px 0px #0000001A' }}
            >
              {/* Card Header */}
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-[#E5E7EB]">
                <h2 className="text-lg font-medium text-[#1E1E1E]">Platform Defaults</h2>
                <p className="text-xs text-[#515151] mt-0.5">
                  Configure default values for platform-wide settings
                </p>
              </div>

              {/* Settings List */}
              <div className="divide-y divide-[#F3F4F6]">
                {/* Default Request Status */}
                <div className="px-4 py-4 sm:px-6 sm:py-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1E1E1E]">Default Request Status</p>
                      <p className="text-xs text-[#515151] mt-0.5">
                        All new requests start with this status
                      </p>
                    </div>
                    <div ref={requestStatusRef} className="relative z-30 shrink-0">
                      <button
                        onClick={() => setRequestStatusOpen(!requestStatusOpen)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F1F1F1] border border-[#E5E7EB] rounded-lg text-[13px] text-[#515151] hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <span>{requestStatus}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${requestStatusOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {requestStatusOpen && (
                        <div className="absolute left-0 top-full  mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                          {['Pending Detection', 'Under Review', 'Approved'].map((opt) => (
                            <button
                              key={opt}
                              onClick={() => {
                                setRequestStatus(opt);
                                setRequestStatusOpen(false);
                                void persistSettings({
                                  default_request_status:
                                    REQUEST_STATUS_UI_TO_API[opt] ?? 'PENDING_DETECTION',
                                });
                              }}
                              className={` w-full text-left px-4 py-2.5 text-sm transition-colors ${requestStatus === opt
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-[#1F2937] hover:bg-gray-50'
                                }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-[#EBF3FE] rounded-lg border border-[#C2D8FC]">
                    <Info className="w-3.5 h-3.5 text-[#1E40AF] mt-0.5 shrink-0" />
                    <p className="text-[11px] sm:text-xs text-[#1E40AF] leading-relaxed">
                      This is a system-enforced default and cannot be changed
                    </p>
                  </div>
                </div>

                {/* Default Currency */}
                <div className="px-4 py-4 sm:px-6 sm:py-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1E1E1E]">Default Currency</p>
                      <p className="text-xs text-[#515151] mt-0.5">
                        Currency used for pricing and quotations
                      </p>
                    </div>
                    <div ref={currencyRef} className={`relative shrink-0 z-30`}>
                      <button
                        onClick={() => setCurrencyOpen(!currencyOpen)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F1F1F1] border border-[#E5E7EB] rounded-lg text-[13px] text-[#515151] hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <span>{currency}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${currencyOpen ? 'rotate-180' : ''
                            }`}
                        />
                      </button>
                      {currencyOpen && (
                        <div className="absolute left-0 top-full  mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                          {['USD ($)', 'EUR (€)', 'GBP (£)', 'INR (₹)'].map((opt) => (
                            <button
                              key={opt}
                              onClick={() => {
                                setCurrency(opt);
                                setCurrencyOpen(false);
                                void persistSettings({
                                  default_currency: CURRENCY_UI_TO_API[opt] ?? 'USD',
                                });
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${currency === opt
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-[#1F2937] hover:bg-gray-50'
                                }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-[#FFECD1] rounded-lg border border-[#F89402]">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#F89402] mt-0.5 shrink-0" />
                    <p className="text-[11px] sm:text-xs text-[#92400E] leading-relaxed">
                      Changing this will affect how prices are displayed for new requests only
                    </p>
                  </div>
                </div>

                {/* Default Lead Time Unit */}
                <div className="px-4 py-4 sm:px-6 sm:py-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1E1E1E]">Default Lead Time Unit</p>
                      <p className="text-xs text-[#515151] mt-0.5">
                        Time unit used for production timelines
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => {
                          setLeadTimeUnit('Days');
                          void persistSettings({ default_lead_time_unit: 'DAYS' });
                        }}
                        className={`px-4 py-1.5 rounded-lg text-[13px] transition-all duration-150 ${leadTimeUnit === 'Days'
                          ? 'bg-[#2F68C5] text-white shadow-sm'
                          : 'bg-[#F1F1F1] text-[#515151] hover:bg-[#E5E7EB]'
                          }`}
                        style={{ fontWeight: 500 }}
                      >
                        Days
                      </button>
                      <button
                        onClick={() => {
                          setLeadTimeUnit('Weeks');
                          void persistSettings({ default_lead_time_unit: 'WEEKS' });
                        }}
                        className={`px-4 py-1.5 rounded-lg text-[13px] transition-all duration-150 ${leadTimeUnit === 'Weeks'
                          ? 'bg-[#2F68C5] text-white shadow-sm'
                          : 'bg-[#F1F1F1] text-[#515151] hover:bg-[#E5E7EB]'
                          }`}
                        style={{ fontWeight: 500 }}
                      >
                        Weeks
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-[#FFECD1] rounded-lg border border-[#F89402]">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#F89402] mt-0.5 shrink-0" />
                    <p className="text-[11px] sm:text-xs text-[#92400E] leading-relaxed">
                      Changing this will affect timeline calculations for new requests only
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI & System Configuration Card */}
            <div
              className="bg-white rounded-2xl"
              style={{ boxShadow: '1px 1px 4px 0px #0000001A' }}
            >
              {/* Card Header */}
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-[#E5E7EB]">
                <h2 className="text-lg font-medium text-[#1E1E1E]">AI & System Configuration</h2>
                <p className="text-xs text-[#515151] mt-0.5">
                  Configure AI provider settings and system behavior
                </p>
              </div>

              {/* Settings List */}
              <div className="divide-y divide-[#F3F4F6]">
                {/* AI Provider */}
                <div className="px-4 py-4 sm:px-6 sm:py-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1E1E1E]">AI Provider</p>
                      <p className="text-xs text-[#515151] mt-0.5">
                        Select the AI service provider for jewelery detection
                      </p>
                    </div>
                    <div ref={aiProviderRef} className={`relative shrink-0 ${aiProviderOpen ? 'z-50' : 'z-20'}`}>
                      <button
                        onClick={() => setAiProviderOpen(!aiProviderOpen)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F1F1F1] border border-[#E5E7EB] rounded-lg text-[13px] text-[#515151] hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <span>{aiProvider}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${aiProviderOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {aiProviderOpen && (
                        <div className="absolute left-0 top-full  mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                          {[
                            'Provider A (GPT-4)',
                            'Provider B (Claude)',
                            'Provider C (Gemini)',
                          ].map((opt) => (
                            <button
                              key={opt}
                              onClick={() => {
                                setAiProvider(opt);
                                setAiProviderOpen(false);
                                void persistSettings({
                                  ai_provider: AI_PROVIDER_UI_TO_API[opt] ?? 'GPT_4',
                                });
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${aiProvider === opt
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-[#1F2937] hover:bg-gray-50'
                                }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-[#FAF5FF] rounded-lg border border-[#E9D5FF]">
                    <Info className="w-3.5 h-3.5 text-[#6B21A8] mt-0.5 shrink-0" />
                    <p className="text-[11px] sm:text-xs text-[#6B21A8] leading-relaxed">
                      High accuracy, slower response
                    </p>
                  </div>
                </div>

                {/* Retry Limits */}
                <div className="px-4 py-4 sm:px-6 sm:py-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1E1E1E]">Retry Limits</p>
                      <p className="text-xs text-[#515151] mt-0.5">
                        Maximum retry attempts for failed AI requests
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => {
                          const nextValue = clampRetryLimit(retryLimits - 1);
                          setRetryLimits(nextValue);
                        }}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border border-[#E5E7EB] rounded-lg hover:bg-[#F1F1F1] text-[#6D6D6D] text-base transition-colors"
                      >
                        −
                      </button>
                      <span className="text-sm font-semibold text-[#1E1E1E] w-6 text-center tabular-nums">
                        {retryLimits}
                      </span>
                      <button
                        onClick={() => {
                          const nextValue = clampRetryLimit(retryLimits + 1);
                          setRetryLimits(nextValue);
                        }}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border border-[#E5E7EB] rounded-lg hover:bg-[#F1F1F1] text-[#6D6D6D] text-base transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-[#F9F9F9] border border-[#F1F1F1] rounded-lg">
                    <Info className="w-3.5 h-3.5 text-[#515151] mt-0.5 shrink-0" />
                    <p className="text-[11px] sm:text-xs text-[#515151] leading-relaxed">
                      Valid range: 3–10 attempts. Higher values increase reliability but may delay
                      error reporting
                    </p>
                  </div>
                </div>

                {/* Timeout Duration */}
                <div className="px-4 py-4 sm:px-6 sm:py-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1E1E1E]">Timeout Duration</p>
                      <p className="text-xs text-[#515151] mt-0.5">
                        Max time to wait for AI responses
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 min-w-0">
                      <input
                        type="number"
                        value={timeoutDuration}
                        onChange={(e) =>
                          setTimeoutDuration(clampTimeoutSeconds(Number(e.target.value)))
                        }
                        onBlur={handleTimeoutBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-14 px-2 py-1.5 border border-[#E5E7EB] rounded-lg text-[13px] text-[#1E1E1E] text-right focus:outline-none focus:ring-2 focus:ring-[#2F68C5]/30 bg-[#F1F1F1]"
                      />
                      <span className="text-[13px] text-[#515151] font-medium shrink-0">
                        seconds
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-[#FFECD1] border border-[#FEC97C] rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#F89402] mt-0.5 shrink-0" />
                    <p className="text-[11px] sm:text-xs text-[#92400E] leading-relaxed">
                      Valid range: 10–120 seconds. Lower values improve responsiveness but may cause
                      timeouts
                    </p>
                  </div>
                </div>

                {/* Link Expiry Duration */}
                <div className="px-4 py-4 sm:px-6 sm:py-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1E1E1E]">Link Expiry Duration</p>
                      <p className="text-xs text-[#515151] mt-0.5">
                        How long generated links remain valid
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        value={linkExpiry}
                        onChange={(e) => setLinkExpiry(Number(e.target.value))}
                        onBlur={handleLinkExpiryBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-14 sm:w-20 px-2 sm:px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-[13px] text-[#1E1E1E] text-right focus:outline-none focus:ring-2 focus:ring-[#2F68C5]/30 bg-[#F1F1F1]"
                      />
                      <div ref={linkExpiryUnitRef} className={`relative shrink-0 ${linkExpiryUnitOpen ? 'z-50' : 'z-20'}`}>
                        <button
                          onClick={() => setLinkExpiryUnitOpen(!linkExpiryUnitOpen)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F1F1F1] border border-[#E5E7EB] rounded-lg text-[13px] text-[#515151] hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <span>{linkExpiryUnit}</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${linkExpiryUnitOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {linkExpiryUnitOpen && (
                          <div className="absolute right-0 bottom-full mb-1 w-28 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                            {['Days', 'Hours', 'Weeks'].map((opt) => (
                              <button
                                key={opt}
                                onClick={() => {
                                  setLinkExpiryUnit(opt);
                                  setLinkExpiryUnitOpen(false);
                                  void persistSettings({
                                    link_expiry_days: toDays(Number(linkExpiry), opt),
                                  });
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${linkExpiryUnit === opt
                                  ? 'bg-blue-50 text-blue-600 font-medium'
                                  : 'text-[#1F2937] hover:bg-gray-50'
                                  }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-[#EBF3FE] border border-[#C2D8FC] rounded-lg">
                    <Info className="w-3.5 h-3.5 text-[#2F68C5] mt-0.5 shrink-0" />
                    <p className="text-[11px] sm:text-xs text-[#2F68C5] leading-relaxed">
                      Applies to quote links, approval links, and other generated URLs. Shorter =
                      more secure
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="space-y-5 sm:space-y-6">

            {/* Feature Toggles Card */}

            <div
              className="bg-white rounded-2xl"
              style={{ boxShadow: '1px 1px 4px 0px #0000001A' }}
            >
            </div>

            {/* Notification Settings Card */}
            <div
              className="bg-white rounded-2xl"
              style={{ boxShadow: '1px 1px 4px 0px #0000001A' }}
            >
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-[#E5E7EB]">
                <h2 className="text-lg font-medium text-[#1E1E1E]">Notification Settings</h2>
                <p className="text-xs text-[#515151] mt-0.5">
                  Configure system-level notification preferences
                </p>
              </div>

              <div className="divide-y divide-[#F3F4F6]">
                {[
                  {
                    label: 'Email Notifications',
                    desc: 'Send email notifications for platform events',
                    value: emailNotifications,
                    onToggle: () => {
                      const nextValue = !emailNotifications;
                      setEmailNotifications(nextValue);
                      void persistSettings({ email_notifications: nextValue });
                    },
                  },
                  {
                    label: 'In-App Notifications',
                    desc: 'Show notification badges and alerts in the platform',
                    value: inAppNotifications,
                    onToggle: () => {
                      const nextValue = !inAppNotifications;
                      setInAppNotifications(nextValue);
                      void persistSettings({ in_app_notifications: nextValue });
                    },
                  },
                ].map(({ label, desc, value, onToggle }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-2 px-3 py-3.5 sm:px-6 sm:py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-nowrap">
                        <p className="text-xs sm:text-sm font-medium text-[#1E1E1E] truncate">{label}</p>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-medium shrink-0 ${value ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F1F1F1] text-[#515151]'}`}
                        >
                          {value ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-[#515151] mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={onToggle}
                      className={`relative shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${value ? 'bg-[#2F68C5]' : 'bg-[#D1D5DB]'}`}
                      style={{ width: 44, height: 24, paddingLeft: 4, paddingRight: 4 }}
                      aria-pressed={value}
                    >
                      <span
                        className="block bg-white rounded-full shadow-sm transition-transform duration-200"
                        style={{
                          width: 16,
                          height: 16,
                          transform: value ? 'translateX(20px)' : 'translateX(0px)',
                        }}
                      />
                    </button>
                  </div>
                ))}

                {/* Notification Triggers */}
                <div className="px-4 py-4 sm:px-6 sm:py-5">
                  <p className="text-sm font-semibold text-[#1E1E1E] mb-3">Notification Triggers</p>
                  <ul className="space-y-2">
                    {[
                      'New request created',
                      'Request approved by customer',
                      'Quote submitted by manufacturer',
                      'Production started',
                      'Production completed',
                      'Request status changed',
                    ].map((trigger) => (
                      <li key={trigger} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#515151] shrink-0" />
                        <span className="text-sm text-[#515151]">{trigger}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Info box */}
              <div className="px-4 pb-4 sm:px-6 sm:pb-5">
                <div className="flex items-start gap-2 p-2.5 bg-[#EBF3FE] rounded-lg border border-[#C2D8FC]">
                  <Info className="w-3.5 h-3.5 text-[#1E40AF] mt-0.5 shrink-0" />
                  <p className="text-[11px] sm:text-xs text-[#1E40AF] leading-relaxed">
                    These triggers are system-defined and cannot be customized. Per-user
                    notification preferences are managed in individual user settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-5 sm:space-y-6">
            {/* Audit & Safety Card */}
            <div
              className="bg-white rounded-2xl"
              style={{ boxShadow: '1px 1px 4px 0px #0000001A' }}
            >
              {/* Card Header */}
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-[#E5E7EB]">
                <h2 className="text-lg font-medium text-[#1E1E1E]">Audit & Safety Information</h2>
                <p className="text-xs text-[#515151] mt-0.5">
                  Track settings changes for accountability and compliance
                </p>
              </div>

              <div className="px-4 py-4 sm:px-6 sm:py-5 space-y-5 sm:space-y-6">
                {/* Last Settings Change */}
                <div className="border border-[#E5E7EB] rounded-xl p-4 sm:p-5 bg-[#F9F9F9]">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#EBF3FE] flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#2F68C5]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1E1E1E] mb-1">
                        Last Settings Change
                      </p>
                      {settingsLogsLoading ? (
                        <p className="text-sm text-[#515151]">Loading latest change...</p>
                      ) : latestLog ? (
                        <>
                          <p className="text-sm text-[#515151] mb-2">{latestLog.change}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="flex items-center gap-1 text-xs text-[#6D6D6D]">
                              <User className="w-3 h-3" />
                              {latestLog.user}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-[#6D6D6D]">
                              <Clock className="w-3 h-3" />
                              {latestLog.time}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-[#515151]">No settings changes found yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Changes */}
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-[#1E1E1E]">Recent Changes</p>
                  {settingsLogsLoading ? (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                          <thead className="bg-[#F1F1F1]">
                            <tr>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold text-[#6D6D6D]">Timestamp</th>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold text-[#6D6D6D]">Actor</th>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold text-[#6D6D6D]">Change</th>
                            </tr>
                          </thead>
                          <tbody className="animate-pulse bg-white divide-y divide-gray-100">
                            {[...Array(5)].map((_, i) => (
                              <tr key={i} className={i % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'}>
                                <td className="px-5 py-4"><div className="h-3.5 w-28 bg-gray-200 rounded" /></td>
                                <td className="px-5 py-4"><div className="h-3.5 w-24 bg-gray-200 rounded" /></td>
                                <td className="px-5 py-4"><div className="h-3.5 w-80 bg-gray-200 rounded" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : settingsLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="p-3 bg-blue-100 rounded-full mb-3">
                        <Clock className="w-5 h-5 text-blue-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">No Recent Changes</p>
                      <p className="text-xs text-gray-600 text-center">
                        Settings changes will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                          <thead className="bg-[#F1F1F1] text-[#6D6D6D]">
                            <tr className="border-b border-gray-200">
                              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">
                                Timestamp
                              </th>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">
                                Actor
                              </th>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">
                                Change Description
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F3F4F6] text-sm text-[#1E1E1E]">
                            {settingsLogs.map(({ id, change, user, time }, index) => (
                              <tr
                                key={id}
                                className={`hover:bg-gray-50 transition-colors ${index % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'
                                  }`}
                              >
                                <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[#6D6D6D]">
                                  {time}
                                </td>
                                <td className="px-5 py-3.5 whitespace-nowrap font-medium text-[#1E1E1E]">
                                  {user}
                                </td>
                                <td className="px-5 py-3.5 text-[#515151] font-normal leading-relaxed">
                                  {change}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Pagination
                        currentPage={logsPage}
                        totalPages={Math.max(1, settingsLogsPagination.total_pages)}
                        onPageChange={setLogsPage}
                        totalItems={settingsLogsPagination.total_items}
                        itemsPerPage={logsLimit}
                      />
                    </div>
                  )}
                </div>

                {/* Green info box */}
                <div className="flex items-start gap-2 p-3 bg-[#DCFCE7] rounded-lg border border-[#78E378]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#78E378] mt-0.5 shrink-0" />
                  <p className="text-[11px] sm:text-xs text-[#166534] leading-relaxed">
                    All settings changes are logged for audit purposes. This ensures accountability
                    and helps track platform configuration history.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
