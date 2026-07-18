'use client';

import { useState, useEffect } from 'react';
import { RequestData } from '@/lib/requestsData';

interface DetailSheetModalProps {
  request: RequestData;
  onClose: () => void;
}

const metalOptions = [
  { id: 'yellow', label: 'Yellow Gold', filterClass: 'metal-filter-yellow', dotClass: 'bg-[#D4AF37]' },
  { id: 'white', label: 'White Gold', filterClass: 'metal-filter-white', dotClass: 'bg-[#C8C8C8]' },
  { id: 'rosegold', label: 'Rose Gold', filterClass: 'metal-filter-rose', dotClass: 'bg-[#E8A598]' },
];

const statusConfig: Record<string, { bgClass: string; textClass: string; dotClass: string; label: string }> = {
  'Draft': { bgClass: 'bg-slate-500/10', textClass: 'text-slate-500', dotClass: 'bg-slate-500', label: 'Draft' },
  'Generating': { bgClass: 'bg-slate-500/10', textClass: 'text-slate-500', dotClass: 'bg-slate-500', label: 'Generating' },
  'Ready for Review': { bgClass: 'bg-blue-500/10', textClass: 'text-blue-500', dotClass: 'bg-blue-500', label: 'Ready for Review' },
  'Sent to Customer': { bgClass: 'bg-amber-500/10', textClass: 'text-amber-600', dotClass: 'bg-amber-500', label: 'Sent to Customer' },
  'Approved': { bgClass: 'bg-green-500/10', textClass: 'text-green-600', dotClass: 'bg-green-500', label: 'Approved' },
  'Sent to Manufacturer': { bgClass: 'bg-violet-500/10', textClass: 'text-violet-600', dotClass: 'bg-violet-500', label: 'Sent to Manufacturer' },
  'Completed': { bgClass: 'bg-emerald-500/10', textClass: 'text-emerald-600', dotClass: 'bg-emerald-500', label: 'Completed' },
  // API raw uppercase statuses
  'DRAFT': { bgClass: 'bg-slate-500/10', textClass: 'text-slate-500', dotClass: 'bg-slate-500', label: 'Draft' },
  'GENERATING': { bgClass: 'bg-slate-500/10', textClass: 'text-slate-500', dotClass: 'bg-slate-500', label: 'Generating' },
  'GENERATED': { bgClass: 'bg-blue-500/10', textClass: 'text-blue-500', dotClass: 'bg-blue-500', label: 'Generated' },
  'UNDER_REVIEW': { bgClass: 'bg-blue-500/10', textClass: 'text-blue-500', dotClass: 'bg-blue-500', label: 'Under Review' },
  'SHARED': { bgClass: 'bg-amber-500/10', textClass: 'text-amber-600', dotClass: 'bg-amber-500', label: 'Shared' },
  'SENT_TO_CUSTOMER': { bgClass: 'bg-amber-500/10', textClass: 'text-amber-600', dotClass: 'bg-amber-500', label: 'Sent to Customer' },
  'QUOTES_REQUESTED': { bgClass: 'bg-violet-500/10', textClass: 'text-violet-600', dotClass: 'bg-violet-500', label: 'Quotes Requested' },
  'QUOTE_RECEIVED': { bgClass: 'bg-violet-500/10', textClass: 'text-violet-600', dotClass: 'bg-violet-500', label: 'Quote Received' },
  'REFINEMENT_REQUESTED': { bgClass: 'bg-red-500/10', textClass: 'text-red-600', dotClass: 'bg-red-500', label: 'Refinement Requested' },
  'APPROVED': { bgClass: 'bg-green-500/10', textClass: 'text-green-600', dotClass: 'bg-green-500', label: 'Approved' },
  'DESIGN_REJECTED': { bgClass: 'bg-red-500/10', textClass: 'text-red-600', dotClass: 'bg-red-500', label: 'Design Rejected' },
  'MANUFACTURER_APPROVED': { bgClass: 'bg-emerald-500/10', textClass: 'text-emerald-600', dotClass: 'bg-emerald-500', label: 'Manufacturer Approved' },
  'REJECTED': { bgClass: 'bg-red-500/10', textClass: 'text-red-600', dotClass: 'bg-red-500', label: 'Rejected' },
  'IN_PRODUCTION': { bgClass: 'bg-blue-500/10', textClass: 'text-blue-500', dotClass: 'bg-blue-500', label: 'In Production' },
  'SENT_TO_MANUFACTURER': { bgClass: 'bg-violet-500/10', textClass: 'text-violet-600', dotClass: 'bg-violet-500', label: 'Sent to Manufacturer' },
  'COMPLETED': { bgClass: 'bg-emerald-500/10', textClass: 'text-emerald-600', dotClass: 'bg-emerald-500', label: 'Completed' },
  'FAILED': { bgClass: 'bg-red-500/10', textClass: 'text-red-600', dotClass: 'bg-red-500', label: 'Failed' },
};

const timelineSteps = [
  { key: 'Draft', label: 'Design Created' },
  { key: 'Sent to Customer', label: 'Sent to Customer' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Sent to Manufacturer', label: 'Sent to Manufacturer' },
  { key: 'Completed', label: 'Completed' },
];

function getTimelineStatus(requestStatus: string, stepKey: string): 'completed' | 'active' | 'pending' {
  const order = ['DRAFT', 'GENERATING', 'GENERATED', 'SENT_TO_CUSTOMER', 'APPROVED', 'SENT_TO_MANUFACTURER', 'COMPLETED'];

  // Normalize both parameters to their matching index in order array
  let normStatus = requestStatus.trim().toUpperCase();
  if (normStatus === 'READY FOR REVIEW') normStatus = 'GENERATED';
  if (normStatus === 'SHARED') normStatus = 'SENT_TO_CUSTOMER';

  const normStep = stepKey.trim().toUpperCase() === 'SENT TO CUSTOMER' ? 'SENT_TO_CUSTOMER' : (stepKey.trim().toUpperCase() === 'SENT TO MANUFACTURER' ? 'SENT_TO_MANUFACTURER' : stepKey.trim().toUpperCase());

  const currentIndex = order.indexOf(normStatus);
  const stepIndex = order.indexOf(normStep);

  if (requestStatus === 'Rejected' || requestStatus === 'REJECTED') {
    if (stepKey === 'Draft') return 'completed';
    if (stepKey === 'Sent to Customer') return 'completed';
    return 'pending';
  }

  if (stepIndex <= currentIndex) return 'completed';
  if (stepIndex === currentIndex + 1) return 'active';
  return 'pending';
}

export default function DetailSheetModal({ request, onClose }: DetailSheetModalProps) {
  const [activeMetal, setActiveMetal] = useState('yellow');
  const [activeAngle, setActiveAngle] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [zoomImage, setZoomImage] = useState(false);

  useEffect(() => {
    setActiveMetal('yellow');
    setActiveAngle(null);
    setCopiedLink(false);
    setZoomImage(false);
  }, [request.id]);

  const metalObj = metalOptions.find((m) => m.id === activeMetal);
  const displayImage = activeAngle
    ? request.angles.find((a) => a.id === activeAngle)?.image ?? request.mainImage
    : request.mainImage;

  const status = statusConfig[request.status] ?? {
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-500',
    dotClass: 'bg-slate-500',
    label: request.status,
  };
  const currentDraft = request.drafts.find((d) => d.isCurrent);

  const handleCopyLink = async () => {
    const link = typeof window !== 'undefined'
      ? `${window.location.origin}/requests?id=${request.id}`
      : `/requests?id=${request.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const normStatus = (request.status || '').trim().toUpperCase();
  const showCustomerActions =
    normStatus === 'SENT_TO_CUSTOMER' ||
    normStatus === 'SHARED' ||
    normStatus === 'APPROVED' ||
    normStatus === 'REJECTED' ||
    request.status === 'Sent to Customer' ||
    request.status === 'Approved' ||
    request.status === 'Rejected';

  const showManufacturerActions =
    normStatus === 'SENT_TO_MANUFACTURER' ||
    normStatus === 'COMPLETED' ||
    request.status === 'Sent to Manufacturer' ||
    request.status === 'Completed';

  const showRetailerActions = !showCustomerActions && !showManufacturerActions;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={onClose} />

      <div
        className="relative w-full max-w-[900px] mx-4 mt-6 mb-10 rounded-[24px] overflow-hidden bg-[linear-gradient(160deg,#FDF9F5_0%,#F7F4F0_40%,#F5F1EC_100%)] shadow-[0px_24px_64px_rgba(0,0,0,0.14),_0px_4px_16px_rgba(0,0,0,0.06)] border border-black/[0.06] animate-[fadeUp_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-7 pb-6 border-b border-black/[0.05]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-[22px] font-bold text-[#1A1A1A] font-satoshi tracking-[-0.3px]">
                  Design Detail Sheet
                </h2>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${status.bgClass} ${status.textClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                  {status.label}
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12.5px] text-[#9CA3AF]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 flex items-center justify-center">
                    <i className="ri-hashtag text-[11px]" />
                  </span>
                  {request.id}
                </span>
                <span className="w-px h-3 bg-[#E5E7EB]" />
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 flex items-center justify-center">
                    <i className="ri-calendar-line text-[11px]" />
                  </span>
                  Created {request.date}
                </span>
                <span className="w-px h-3 bg-[#E5E7EB]" />
                <img src="/Render_image_1.jpg" alt="logo" className="w-[60px] h-auto object-contain" />
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-[18px] text-[#9CA3AF]" />
            </button>
          </div>
        </div>

        <div className="px-8 py-6 flex flex-col gap-6">
          {/* Hero Design Section */}
          <div className="rounded-[20px] overflow-hidden bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04),_0px_1px_4px_rgba(0,0,0,0.03)] border border-black/[0.04]">
            {/* Metal tabs */}
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F3F4F6] w-fit">
                {metalOptions.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveMetal(m.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${activeMetal === m.id ? 'bg-white text-[#1A1A1A]' : 'text-[#9CA3AF] hover:text-[#6B7280]'
                      } ${activeMetal === m.id ? 'shadow-[0px_1px_4px_rgba(0,0,0,0.08)]' : ''}`}
                  >
                    <span className={`w-3 h-3 rounded-full ${m.dotClass}`} />
                    {m.label}
                  </button>
                ))}
              </div>
              {currentDraft && (
                <span className="text-[11.5px] font-semibold text-[#3B82F6] bg-blue-50 px-3 py-1.5 rounded-full">
                  {currentDraft.version}
                </span>
              )}
            </div>

            {/* Main Image */}
            <div className="px-6 pb-4">
              <div className="relative w-full rounded-[16px] overflow-hidden h-[400px]">
                {displayImage ? (
                  <>
                    <img
                      src={displayImage}
                      alt={`${request.type} Render`}
                      className={`w-full h-full object-cover object-top transition-all duration-500 ${metalObj?.filterClass ?? ''}`}
                      draggable={false}
                    />
                    <button
                      onClick={() => setZoomImage(true)}
                      className="absolute bottom-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-md shadow-lg border border-black/[0.04] hover:bg-white transition-colors cursor-pointer"
                    >
                      <i className="ri-fullscreen-line text-[15px] text-[#6B7280]" />
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#F7F6F3] text-[12px] text-[#9CA3AF]">
                    No render available
                  </div>
                )}
              </div>
            </div>

            {/* Angle Thumbnails */}
            <div className="px-6 pb-5">
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {request.mainImage ? (
                  <button
                    onClick={() => setActiveAngle(null)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer transition-opacity ${activeAngle === null ? 'opacity-100' : 'opacity-55 hover:opacity-80'}`}
                  >
                    <div
                      className={`w-[72px] h-[72px] rounded-[12px] overflow-hidden transition-all ${activeAngle === null
                          ? 'ring-2 ring-[#3B82F6] shadow-[0_4px_12px_rgba(59,130,246,0.18)]'
                          : 'border border-black/[0.05]'
                        }`}
                    >
                      <img src={request.mainImage} alt="Main" className={`w-full h-full object-cover object-top ${metalObj?.filterClass ?? ''}`} />
                    </div>
                    <span className="text-[10.5px] font-medium text-[#9CA3AF]">Main</span>
                  </button>
                ) : (
                  <div className="flex-shrink-0 flex flex-col items-center gap-1.5 opacity-60">
                    <div className="w-[72px] h-[72px] rounded-[12px] border border-black/[0.05] bg-[#F3F4F6] flex items-center justify-center text-[9px] text-[#9CA3AF]">
                      No image
                    </div>
                    <span className="text-[10.5px] font-medium text-[#9CA3AF]">Main</span>
                  </div>
                )}
                {request.angles.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setActiveAngle(a.id)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer transition-opacity ${activeAngle === a.id ? 'opacity-100' : 'opacity-55 hover:opacity-80'}`}
                  >
                    <div
                      className={`w-[72px] h-[72px] rounded-[12px] overflow-hidden transition-all ${activeAngle === a.id
                          ? 'ring-2 ring-[#3B82F6] shadow-[0_4px_12px_rgba(59,130,246,0.18)]'
                          : 'border border-black/[0.05]'
                        }`}
                    >
                      <img src={a.image} alt={a.label} className={`w-full h-full object-cover object-top ${metalObj?.filterClass ?? ''}`} />
                    </div>
                    <span className="text-[10.5px] font-medium text-[#9CA3AF]">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Two Column: Specs + Info */}
          <div className="grid grid-cols-[1fr_320px] gap-5">
            {/* Design Specs */}
            <div className="rounded-[18px] p-6 bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04),_0px_1px_4px_rgba(0,0,0,0.03)] border border-black/[0.04]">
              <h3
                className="text-[14px] font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2 font-satoshi"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-settings-3-line text-[15px] text-[#3B82F6]" />
                </span>
                Design Specifications
              </h3>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Jewelery Type</p>
                  <p className="text-[13.5px] text-[#1A1A1A] font-medium">{request.type}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Metal Type</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${metalObj?.dotClass ?? 'bg-[#D4AF37]'}`} />
                    <p className="text-[13.5px] text-[#1A1A1A] font-medium">{metalObj?.label ?? 'Yellow Gold'}</p>
                  </div>
                </div>
                {request.specs.map((spec) => (
                  <div key={spec.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">{spec.label}</p>
                    <p className="text-[13.5px] text-[#1A1A1A] font-medium">{spec.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[14px] p-4 bg-[#F7F6F3] border border-black/[0.04]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-2">Design Description</p>
                <p className="text-[13px] text-[#374151] leading-relaxed">{request.prompt}</p>
              </div>
            </div>

            {/* Right Column: Customer + Timeline + Actions */}
            <div className="flex flex-col gap-5">
              {/* Customer Info */}
              <div className="rounded-[18px] p-5 bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04),_0px_1px_4px_rgba(0,0,0,0.03)] border border-black/[0.04]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">Customer</p>
                <div className="flex items-center gap-3">
                  <img
                    src={request.customer.avatar}
                    alt={request.customer.name}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-[13.5px] font-semibold text-[#1A1A1A]">{request.customer.name}</p>
                    <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">{request.customer.email}</p>
                    <p className="text-[11px] text-[#C4C4C4] mt-0.5">{request.customer.location}</p>
                  </div>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="rounded-[18px] p-5 bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04),_0px_1px_4px_rgba(0,0,0,0.03)] border border-black/[0.04]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-4">Status Timeline</p>
                <div className="flex flex-col gap-0">
                  {timelineSteps.map((step, idx) => {
                    const state = getTimelineStatus(request.status, step.key);
                    const isLast = idx === timelineSteps.length - 1;
                    return (
                      <div key={step.key} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${state === 'completed' ? 'bg-green-500/10' : state === 'active' ? 'bg-blue-500/10' : 'bg-[#F3F4F6]'}`}
                          >
                            {state === 'completed' ? (
                              <i className="ri-check-line text-[12px] text-[#16A34A]" />
                            ) : state === 'active' ? (
                              <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-[#D1D5DB]" />
                            )}
                          </div>
                          {!isLast && (
                            <div
                              className={`w-px flex-1 min-h-[20px] mt-1 ${state === 'completed' ? 'bg-[#BBF7D0]' : 'bg-[#E5E7EB]'}`}
                            />
                          )}
                        </div>
                        <div className="pb-4">
                          <p
                            className={`text-[12.5px] font-medium ${state === 'completed' ? 'text-[#16A34A]' : state === 'active' ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'
                              }`}
                          >
                            {step.label}
                          </p>
                          {state === 'active' && (
                            <p className="text-[11px] text-[#9CA3AF] mt-0.5">In progress</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Version History */}
          <div className="rounded-[18px] p-6 bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04),_0px_1px_4px_rgba(0,0,0,0.03)] border border-black/[0.04]">
            <h3
              className="text-[14px] font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2 font-satoshi"
            >
              <span className="w-5 h-5 flex items-center justify-center">
                <i className="ri-history-line text-[15px] text-[#3B82F6]" />
              </span>
              Version History
            </h3>
            <div className="flex items-start gap-4 overflow-x-auto pb-2">
              {request.drafts.map((draft, idx) => (
                <div key={draft.version} className="flex-shrink-0 flex flex-col items-center gap-2 min-w-[100px]">
                  <div
                    className={`w-[88px] h-[88px] rounded-[14px] overflow-hidden transition-all ${draft.isCurrent
                        ? 'ring-2 ring-[#3B82F6] shadow-[0_4px_12px_rgba(59,130,246,0.18)]'
                        : 'border border-black/[0.05]'
                      }`}
                  >
                    <img src={draft.image} alt={draft.label} className="w-full h-full object-cover object-top" />
                  </div>
                  <div className="text-center">
                    <p className={`text-[11.5px] font-semibold ${draft.isCurrent ? 'text-[#3B82F6]' : 'text-[#1A1A1A]'}`}>
                      {draft.version}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5 max-w-[90px] truncate">{draft.label}</p>
                    <p className="text-[10px] text-[#C4C4C4] mt-0.5">{draft.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Panel */}
          <div className="rounded-[18px] p-6 bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04),_0px_1px_4px_rgba(0,0,0,0.03)] border border-black/[0.04]">
            <h3
              className="text-[14px] font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2 font-satoshi"
            >
              <span className="w-5 h-5 flex items-center justify-center">
                <i className="ri-folders-line text-[15px] text-[#3B82F6]" />
              </span>
              Actions
            </h3>

            {showRetailerActions && (
              <div className="flex items-center gap-3">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-all cursor-pointer whitespace-nowrap hover:opacity-90 bg-blue-500 shadow-[0px_4px_14px_rgba(59,130,246,0.28)]"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-share-forward-line text-[13px]" />
                  </span>
                  Share with Customer
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-medium text-[#6B7280] transition-all cursor-pointer whitespace-nowrap hover:bg-[#F3F4F6] border border-transparent hover:border-black/[0.04]"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-pencil-line text-[13px]" />
                  </span>
                  Edit / Refine
                </button>
              </div>
            )}

            {showCustomerActions && (
              <div className="flex items-center gap-3">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-all cursor-pointer whitespace-nowrap hover:opacity-90 bg-green-600 shadow-[0px_4px_14px_rgba(34,197,94,0.28)]"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-checkbox-circle-line text-[13px]" />
                  </span>
                  Approve Design
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-medium text-[#DC2626] transition-all cursor-pointer whitespace-nowrap hover:bg-[#FEF2F2] border border-[#FECACA]"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-close-circle-line text-[13px]" />
                  </span>
                  Request Changes
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-medium text-[#6B7280] transition-all cursor-pointer whitespace-nowrap hover:bg-[#F3F4F6] border border-transparent hover:border-black/[0.04]"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-chat-3-line text-[13px]" />
                  </span>
                  Add Comment
                </button>
              </div>
            )}

            {showManufacturerActions && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B7280] mb-1.5">Quote Price</label>
                    <input
                      type="text"
                      placeholder="e.g. $4,500"
                      className="w-full px-4 py-2.5 rounded-[12px] text-[13px] text-[#1A1A1A] placeholder:text-[#C4C4C4] outline-none bg-[#F7F6F3] border border-black/[0.06] font-inter"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B7280] mb-1.5">Notes</label>
                    <input
                      type="text"
                      placeholder="Add manufacturing notes..."
                      className="w-full px-4 py-2.5 rounded-[12px] text-[13px] text-[#1A1A1A] placeholder:text-[#C4C4C4] outline-none bg-[#F7F6F3] border border-black/[0.06] font-inter"
                    />
                  </div>
                </div>
                <button
                  className="w-fit flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-all cursor-pointer whitespace-nowrap hover:opacity-90 bg-blue-500 shadow-[0px_4px_14px_rgba(59,130,246,0.28)]"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-send-plane-line text-[13px]" />
                  </span>
                  Submit Quote
                </button>
              </div>
            )}
          </div>

          {/* Share & Export */}
          <div className="rounded-[18px] p-6 bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04),_0px_1px_4px_rgba(0,0,0,0.03)] border border-black/[0.04]">
            <h3
              className="text-[14px] font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2 font-satoshi"
            >
              <span className="w-5 h-5 flex items-center justify-center">
                <i className="ri-share-line text-[15px] text-[#3B82F6]" />
              </span>
              Share & Export
            </h3>

            <div className="flex items-center gap-3 mb-5">
              <div
                className="flex-1 px-4 py-2.5 rounded-[12px] text-[12.5px] text-[#374151] truncate bg-[#F7F6F3] border border-black/[0.06] font-inter"
              >
                {typeof window !== 'undefined' ? `${window.location.origin}/requests?id=${request.id}` : `/requests?id=${request.id}`}
              </div>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-[12.5px] font-medium transition-all cursor-pointer whitespace-nowrap border ${copiedLink ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className={`${copiedLink ? 'ri-check-line' : 'ri-link'} text-[13px]`} />
                </span>
                {copiedLink ? 'Copied' : 'Copy Link'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[12.5px] font-medium text-[#1A1A1A] transition-all cursor-pointer whitespace-nowrap hover:bg-[#F3F4F6] border border-transparent hover:border-black/[0.04]">
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-whatsapp-line text-[14px] text-[#22C55E]" />
                </span>
                Share via WhatsApp
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[12.5px] font-medium text-[#1A1A1A] transition-all cursor-pointer whitespace-nowrap hover:bg-[#F3F4F6] border border-transparent hover:border-black/[0.04]">
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-mail-line text-[14px] text-[#3B82F6]" />
                </span>
                Share via Email
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[12.5px] font-medium text-[#1A1A1A] transition-all cursor-pointer whitespace-nowrap hover:bg-[#F3F4F6] border border-transparent hover:border-black/[0.04]">
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-download-line text-[14px] text-[#6B7280]" />
                </span>
                Download PDF
              </button>
            </div>
          </div>
        </div>

        {/* Footer close */}
        <div className="px-8 py-5 flex items-center justify-end border-t border-black/[0.05]">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-[10px] text-[13px] font-semibold text-[#6B7280] transition-all cursor-pointer whitespace-nowrap hover:bg-[#F3F4F6]"
          >
            Close
          </button>
        </div>
      </div>

      {/* Zoom overlay */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setZoomImage(false)}
        >
          <div className="relative max-w-[700px] max-h-[80vh] rounded-[20px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {displayImage ? (
              <img
                src={displayImage}
                alt="Zoomed"
                className={`w-full h-full object-contain ${metalObj?.filterClass ?? ''}`}
              />
            ) : (
              <div className="w-[560px] max-w-[90vw] h-[320px] flex items-center justify-center bg-white text-[12px] text-[#9CA3AF]">
                No render available
              </div>
            )}
            <button
              onClick={() => setZoomImage(false)}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-lg cursor-pointer"
            >
              <i className="ri-close-line text-[18px] text-[#1A1A1A]" />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeUp {
          from { transform: translateY(12px); opacity: 0.8; }
          to { transform: translateY(0); opacity: 1; }
        }
        .metal-filter-yellow { filter: sepia(35%) saturate(125%) hue-rotate(5deg) brightness(102%); }
        .metal-filter-white { filter: grayscale(25%) brightness(108%) contrast(105%); }
        .metal-filter-rose { filter: sepia(25%) saturate(115%) hue-rotate(-12deg) brightness(104%); }
      `}</style>
    </div>
  );
}