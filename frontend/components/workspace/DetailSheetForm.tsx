'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { RequestData, statusStyles } from '@/lib/requestsData';
import { MANUFACTURERS, Manufacturer, SPECIALTIES } from '@/lib/manufacturersData';
import CountryCodeSelect from '@/src/utils/components/CountryCodeSelect';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { createProductionSheet, getProductionSheet, saveProductionSheetDraft } from '@/redux/slices/productionSheet/productionSheetSlice';
import { createManufacturer, listManufacturers, resetManufacturers } from '@/redux/slices/retailer/manufacturerSlice';
import { shareVariantWithManufacturer } from '@/redux/slices/retailer/designVariantShareMfgSlice';
import { toast } from 'react-toastify';
import { sanitizePhoneDigits, getPhoneMaxLength, getPhoneLengthMessage } from '@/lib/formValidation';

export interface DetailSheetData {
  jewelleryType: string;
  subtype: string;
  metalType: string;
  metalColor: string;
  twoToneSpec: string;
  threeToneSpec: string;
  metalPurity: string;
  stoneType: string;
  stoneCount: string;
  stoneSize: string;
  settingType: string;
  approxWeight: string;
  dimensionLength: string;
  dimensionWidth: string;
  dimensionHeight: string;
  chainLength: string;
  customNotes: string;
  budgetRange: string;
  ringSize: string;
  ringSizeNotes: string;
  customChainLength: string;
  sizeNotes: string;
  bailSize: string;

  // Custom Fields (stored in metadata block in manufacturing_notes)
  metalWeight?: string;
  hallmarkRequired?: string; // 'true' or ''
  rhodiumFinish?: string; // 'true' or ''
  stoneShape?: string;
  stoneColor?: string;
  stoneClarity?: string;
  stoneCertificate?: string;
  stoneSizeUnit?: string; // 'mm' or 'ct'
  braceletLength?: string;
  bangleSize?: string;
  pendantBailWidth?: string;
}

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

interface DetailSheetFormProps {
  request: RequestData;
  onClose: () => void;
  onSubmit: (data: DetailSheetData, manufacturerIds: string[]) => void;
  onSaveDraft: (data: DetailSheetData) => void;
  variantId?: string | number | null;
  activeMetal?: string;
}

// Global configuration constants matching requirements
const METAL_TYPES = ['Gold', 'Silver', 'Platinum', 'Palladium'];
const METAL_COLORS = [
  { id: 'yellow', label: 'Yellow Gold', dotClass: 'bg-[#D4AF37]' },
  { id: 'white', label: 'White Gold', dotClass: 'bg-[#C8C8C8]' },
  { id: 'rosegold', label: 'Rose Gold', dotClass: 'bg-[#E8A598]' },
  { id: 'twotone', label: 'Two Tone', dotClass: 'bg-[linear-gradient(135deg,#D4AF37_50%,#C8C8C8_50%)]' },
  { id: 'threetone', label: 'Three Tone', dotClass: 'bg-[linear-gradient(135deg,#D4AF37_33%,#C8C8C8_33%,#E8A598_66%)]' },
];

const METAL_COLORS_MAP: Record<string, { id: string; label: string; dotClass: string }[]> = {
  Gold: [
    { id: 'yellow', label: 'Yellow Gold', dotClass: 'bg-[#D4AF37]' },
    { id: 'white', label: 'White Gold', dotClass: 'bg-[#C8C8C8]' },
    { id: 'rosegold', label: 'Rose Gold', dotClass: 'bg-[#E8A598]' },
    { id: 'twotone', label: 'Two Tone', dotClass: 'bg-[linear-gradient(135deg,#D4AF37_50%,#C8C8C8_50%)]' },
    { id: 'threetone', label: 'Three Tone', dotClass: 'bg-[linear-gradient(135deg,#D4AF37_33%,#C8C8C8_33%,#E8A598_66%)]' },
  ],
  Silver: [
    { id: 'white', label: 'Sterling Silver', dotClass: 'bg-[#C8C8C8]' },
    { id: 'yellow', label: 'Yellow Plated', dotClass: 'bg-[#D4AF37]' },
    { id: 'rosegold', label: 'Rose Plated', dotClass: 'bg-[#E8A598]' },
  ],
  Platinum: [
    { id: 'white', label: 'Platinum White', dotClass: 'bg-[#C8C8C8]' },
  ],
  Palladium: [
    { id: 'white', label: 'Palladium Gray', dotClass: 'bg-[#C8C8C8]' },
  ],
};

const PURITY_MAP: Record<string, string[]> = {
  Gold: ['24K', '22K', '18K', '14K', '10K'],
  Silver: ['925 Sterling', '999 Fine Silver'],
  Platinum: ['PT950', 'PT900'],
  Palladium: ['PD950', 'PD900'],
};

const STONE_TYPES = [
  'Natural Diamond',
  'Lab Grown Diamond',
  'Moissanite',
  'Ruby',
  'Emerald',
  'Blue Sapphire',
  'Yellow Sapphire',
  'Pearl',
  'Cubic Zirconia (CZ)',
  'No Stone'
];

const SETTING_TYPES = [
  'Prong',
  'Bezel',
  'Halo',
  'Pavé',
  'Channel',
  'Flush',
  'Tension',
  'Cluster',
  'Invisible'
];

const RING_SIZES = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];

const STONE_SHAPES = [
  'Round',
  'Oval',
  'Princess',
  'Cushion',
  'Emerald',
  'Pear',
  'Marquise',
  'Heart',
  'Asscher',
  'Radiant'
];

const STONE_CERTIFICATES = ['GIA', 'IGI', 'HRD', 'SGL'];

const EXAMPLE_NOTES = [
  'Quality Metal Finish',
  'Colored Enamel',
  'Hidden Halo Setting',
  'Precise Engraving',
  'Firm Budget',
  'Accurate Size'
];

// Helper functions for metadata packing in notes
export function serializeMetadata(form: DetailSheetData, baseNotes: string): string {
  const lines: string[] = [];
  if (form.metalWeight) {
    lines.push(`Metal Weight: ${form.metalWeight}`);
  }
  if (form.hallmarkRequired) {
    lines.push(`Hallmark Required: ${form.hallmarkRequired === 'true' || form.hallmarkRequired === 'Yes' ? 'Yes' : 'No'}`);
  }
  if (form.rhodiumFinish) {
    lines.push(`Rhodium Finish: ${form.rhodiumFinish === 'true' || form.rhodiumFinish === 'Yes' ? 'Yes' : 'No'}`);
  }
  if (form.stoneShape) {
    lines.push(`Stone Shape: ${form.stoneShape}`);
  }
  if (form.stoneColor) {
    lines.push(`Stone Color: ${form.stoneColor}`);
  }
  if (form.stoneClarity) {
    lines.push(`Stone Clarity: ${form.stoneClarity}`);
  }
  if (form.stoneCertificate) {
    lines.push(`Stone Certificate: ${form.stoneCertificate}`);
  }
  if (form.stoneSizeUnit) {
    lines.push(`Stone Size Unit: ${form.stoneSizeUnit}`);
  }
  if (form.chainLength) {
    lines.push(`Chain Length: ${form.chainLength}`);
  }
  if (form.braceletLength) {
    lines.push(`Bracelet Length: ${form.braceletLength}`);
  }
  if (form.bangleSize) {
    lines.push(`Bangle Size: ${form.bangleSize}`);
  }
  if (form.pendantBailWidth) {
    lines.push(`Pendant Bail Width: ${form.pendantBailWidth}`);
  }

  if (lines.length === 0) return baseNotes;

  const notes = baseNotes ? baseNotes.trim() : '';
  return `${notes}\n\n--- METADATA ---\n${lines.join('\n')}`;
}

export function deserializeMetadata(notesStr: string): {
  cleanNotes: string;
  metadata: Partial<DetailSheetData>;
} {
  const defaultMeta: Partial<DetailSheetData> = {
    metalWeight: '',
    hallmarkRequired: '',
    rhodiumFinish: '',
    stoneShape: '',
    stoneColor: '',
    stoneClarity: '',
    stoneCertificate: '',
    stoneSizeUnit: 'mm',
    chainLength: '',
    braceletLength: '',
    bangleSize: '',
    pendantBailWidth: '',
  };

  if (!notesStr) return { cleanNotes: '', metadata: defaultMeta };

  const separator = '--- METADATA ---';
  const parts = notesStr.split(separator);
  const cleanNotes = parts[0].trim();

  if (parts.length < 2) {
    return { cleanNotes, metadata: defaultMeta };
  }

  const metaBlock = parts[1];
  const lines = metaBlock.split('\n');
  const metadata = { ...defaultMeta };

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case 'Metal Weight':
        metadata.metalWeight = value;
        break;
      case 'Hallmark Required':
        metadata.hallmarkRequired = value === 'Yes' ? 'true' : '';
        break;
      case 'Rhodium Finish':
        metadata.rhodiumFinish = value === 'Yes' ? 'true' : '';
        break;
      case 'Stone Shape':
        metadata.stoneShape = value;
        break;
      case 'Stone Color':
        metadata.stoneColor = value;
        break;
      case 'Stone Clarity':
        metadata.stoneClarity = value;
        break;
      case 'Stone Certificate':
        metadata.stoneCertificate = value;
        break;
      case 'Stone Size Unit':
        metadata.stoneSizeUnit = value;
        break;
      case 'Chain Length':
        metadata.chainLength = value;
        break;
      case 'Bracelet Length':
        metadata.braceletLength = value;
        break;
      case 'Bangle Size':
        metadata.bangleSize = value;
        break;
      case 'Pendant Bail Width':
        metadata.pendantBailWidth = value;
        break;
    }
  }

  return { cleanNotes, metadata };
}

function SectionHeader({ icon, label, required }: { icon: string; label: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="w-5 h-5 flex items-center justify-center">
        <i className={`${icon} text-[18px] text-[#2563EB]`} />
      </span>
      <h4 className="text-[14.5px] font-bold text-[#111827] dark:text-ink font-satoshi flex items-center">
        {label}
        {required && <span className="text-[#EF4444] ml-1">*</span>}
      </h4>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className={`block text-[12.5px] font-semibold mb-2 ${required ? 'text-[#374151] dark:text-[#A1A8B3]' : 'text-[#6B7280] dark:text-[#D1D5DB]'}`}>
      {children}
      {required && <span className="text-[#EF4444] ml-0.5">*</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  hasError = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  className?: string;
  hasError?: boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (type === 'number') {
      const isIntegerOnly = placeholder.toLowerCase().includes('count') || placeholder.includes('12');
      if (isIntegerOnly) {
        val = val.replace(/[^0-9]/g, '');
      } else {
        val = val.replace(/[^0-9.]/g, '');
        const parts = val.split('.');
        if (parts.length > 2) {
          val = parts[0] + '.' + parts.slice(1).join('');
        }
      }
    }
    onChange(val);
  };

  return (
    <input
      type={type === 'number' ? 'text' : type}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 rounded-[12px] text-[13.5px] text-[#1A1A1A] dark:text-ink placeholder:text-[#9CA3AF] dark:placeholder:text-ink-600 outline-none bg-[#FAF9F6] dark:bg-surface-150 border ${hasError ? 'border-[#EF4444] focus:border-[#EF4444] focus:shadow-[0_0_0_2.5px_rgba(239,68,68,0.1)]' : 'border-black/[0.04] dark:border-border-default focus:border-[#3B82F6]/30 focus:shadow-[0_0_0_2.5px_rgba(59,130,246,0.06)]'} font-inter transition-all hover:bg-[#F3F2EE] focus:bg-white ${className}`}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
  hasError = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  className?: string;
  hasError?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={500}
      className={`w-full px-4 py-3 rounded-[14px] text-[13.5px] text-[#1A1A1A] dark:text-ink placeholder:text-[#9CA3AF] dark:placeholder:text-ink-600 outline-none resize-none bg-[#FAF9F6] dark:bg-surface-150 border ${hasError ? 'border-[#EF4444] focus:border-[#EF4444] focus:shadow-[0_0_0_2.5px_rgba(239,68,68,0.1)]' : 'border-black/[0.04] dark:border-border-default focus:border-[#3B82F6]/30 focus:shadow-[0_0_0_2.5px_rgba(59,130,246,0.06)]'} font-inter transition-all hover:bg-[#F3F2EE] focus:bg-white ${className}`}
    />
  );
}

function SelectDropdown({
  value,
  onChange,
  options,
  placeholder,
  hasError = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3.5 py-2 rounded-[10px] text-[13px] text-[#1A1A1A] dark:text-ink outline-none cursor-pointer bg-[#F7F6F3] dark:bg-surface-150 border ${hasError ? 'border-[#EF4444]' : 'border-[rgba(0,0,0,0.06)] dark:border-border-default'} font-inter`}
      >
        <span className={value ? 'text-[#1A1A1A] dark:text-ink' : 'text-[#C4C4C4] dark:text-ink-700'}>{value || placeholder}</span>
        <span className="w-4 h-4 flex items-center justify-center">
          <i className={`ri-arrow-down-s-line text-[14px] text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-10 z-50 rounded-[12px] overflow-hidden py-1 max-h-[220px] overflow-y-auto bg-white dark:bg-surface-150 shadow-[0px_8px_32px_rgba(0,0,0,0.12),_0px_2px_8px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.06)] dark:border-border-default">
          {options.length === 0 ? (
            <div className="px-4 py-2 text-[13px] text-[#9CA3AF] dark:text-ink-700 font-inter">No options available</div>
          ) : (
            options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-[13px] transition-colors cursor-pointer ${value === opt ? 'text-[#3B82F6] dark:text-brand bg-blue-50 dark:bg-blue-500/10 font-medium' : 'text-[#1A1A1A] dark:text-ink hover:bg-[#F7F6F3] dark:hover:bg-surface-200'}`}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const statusBadgeMap: Record<string, { bgClass: string; textClass: string; dotClass: string }> = {
  'Available': { bgClass: 'bg-[rgba(34,197,94,0.12)]', textClass: 'text-[#16A34A]', dotClass: 'bg-[#22C55E]' },
  'Active': { bgClass: 'bg-[rgba(34,197,94,0.12)]', textClass: 'text-[#16A34A]', dotClass: 'bg-[#22C55E]' },
  'Inactive': { bgClass: 'bg-gray-100 dark:bg-surface-200', textClass: 'text-gray-500 dark:text-ink-600', dotClass: 'bg-gray-400' },
  'Busy': { bgClass: 'bg-[rgba(139,92,246,0.12)]', textClass: 'text-[#7C3AED]', dotClass: 'bg-[#8B5CF6]' },
  'Delayed': { bgClass: 'bg-[rgba(239,68,68,0.10)]', textClass: 'text-[#DC2626]', dotClass: 'bg-[#EF4444]' },
};

const avatarBgClassMap: Record<string, string> = {
  '#C7D2FE': 'bg-[#C7D2FE]',
  '#BFDBFE': 'bg-[#BFDBFE]',
  '#8B5CF6': 'bg-[#8B5CF6]',
};

function mapApiResponseToManufacturer(apiItem: any): Manufacturer {
  const initials = apiItem.name
    ? apiItem.name.trim().split(' ').map((w: any) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'M';

  const mappedEmails = (apiItem.emails || []).map((e: any) => ({
    label: e.label || 'Work',
    value: e.email || e.value || '',
  }));

  return {
    id: String(apiItem.id),
    name: apiItem.name || 'Unnamed',
    initials,
    avatarColor: apiItem.avatar_color || '#8B5CF6',
    specialty: apiItem.speciality || 'General Specialist',
    location: apiItem.location || '—',
    email: mappedEmails[0]?.value || apiItem.email || '',
    emails: mappedEmails,
    phone: apiItem.phone_number || apiItem.phone || '',
    verified: apiItem.status === 'Active' || apiItem.status === 'ACTIVE' || apiItem.status === 'Available',
    status: (() => {
      if (!apiItem.status) return 'Inactive';
      const s = String(apiItem.status).trim().toLowerCase();
      if (s === 'active') return 'Active';
      if (s === 'inactive') return 'Inactive';
      return s.charAt(0).toUpperCase() + s.slice(1);
    })() as any,
    avgResponseTime: apiItem.stats?.avg_response_time || '—',
    lastActivity: apiItem.stats?.last_activity || '—',
    totalRequests: apiItem.stats?.total_requests || 0,
    completedRequests: apiItem.stats?.completed_requests || 0,
    pendingRequests: apiItem.stats?.pending_requests || 0,
    totalProfit: apiItem.stats?.total_profit ? `$${apiItem.stats.total_profit}` : '$0',
    requests: apiItem.sent_requests || [],
  };
}

function getAvatarBgClass(color?: string) {
  if (!color) return 'bg-[#8B5CF6]';
  return avatarBgClassMap[color] ?? 'bg-[#8B5CF6]';
}

export default function DetailSheetForm({ request, onClose, onSubmit, onSaveDraft, variantId, activeMetal = 'yellow' }: DetailSheetFormProps) {
  const dispatch = useAppDispatch();
  const { variants: variantHistory } = useAppSelector((s: any) => s.retailerDesignVariant);
  const { items: apiManufacturersList, listStatus, createStatus, total } = useAppSelector((s: any) => s.retailerManufacturer);
  const requestDrafts = request.drafts ?? [];
  const requestSpecs = request.specs ?? [];



  const selectedVariant = useMemo(() => {
    return (variantHistory ?? []).find((v: any) => String(v.id) === String(variantId)) ?? variantHistory?.[0] ?? null;
  }, [variantHistory, variantId]);

  const activeMetalObj = useMemo(() => {
    return METAL_COLORS.find((m) => m.id === activeMetal);
  }, [activeMetal]);

  const activeMetalPayload = useMemo(() => {
    return activeMetalObj?.id === 'yellow' ? 'gold' : (activeMetalObj?.id === 'white' ? 'silver' : (activeMetalObj?.id === 'rosegold' ? 'rose_gold' : 'gold'));
  }, [activeMetalObj]);

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
      console.error('Error parsing metal_variations_json in detail sheet:', e);
    }
    return null;
  }, [selectedVariant]);

  const displayMainImage = useMemo(() => {
    if (!selectedVariant) return request?.mainImage;
    if (activeMetalPayload === 'gold') {
      return getMetalImage(parsedMetalVariations, 'gold') || selectedVariant?.base_design_image_url || selectedVariant?.image_url || selectedVariant?.url || selectedVariant?.mainImage || selectedVariant?.image || selectedVariant?.base_design_image_url || request?.mainImage;
    } else {
      const metalImg = getMetalImage(parsedMetalVariations, activeMetalPayload);
      return metalImg || selectedVariant?.base_image_url || selectedVariant?.image_url || selectedVariant?.url || request?.mainImage;
    }
  }, [selectedVariant, activeMetalPayload, parsedMetalVariations, request?.mainImage]);

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
      console.error('Error parsing angles_json in detail sheet form:', e);
    }
    return null;
  }, [selectedVariant]);

  const displayAngles = useMemo(() => {
    const mapAnglesJson = (anglesObj: any): { id: string; label: string; image: string }[] => {
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

  const prefill = useMemo(() => {
    const metalSpec = requestSpecs.find((s) => s.label === 'Metal')?.value ?? '';
    const stoneSpec = requestSpecs.find((s) => s.label === 'Stone' || s.label === 'Center Stone' || s.label === 'Stones' || s.label === 'Charms')?.value ?? '';
    const settingSpec = requestSpecs.find((s) => s.label === 'Setting')?.value ?? '';
    const styleSpec = requestSpecs.find((s) => s.label === 'Style' || s.label === 'Cut')?.value ?? '';

    const matchedMetal = METAL_TYPES.find((m) => metalSpec.toLowerCase().includes(m.toLowerCase())) ?? '';
    const matchedColor = activeMetal;
    const matchedStone = STONE_TYPES.find((s) => stoneSpec.toLowerCase().includes(s.toLowerCase())) ?? 'No Stone';
    const matchedSetting = SETTING_TYPES.find((s) => settingSpec.toLowerCase().includes(s.toLowerCase())) ?? '';

    return { matchedMetal, matchedColor, matchedStone, matchedSetting, styleSpec };
  }, [requestSpecs, activeMetal]);

  const [form, setForm] = useState<DetailSheetData>({
    jewelleryType: request.type,
    subtype: prefill.styleSpec,
    metalType: prefill.matchedMetal,
    metalColor: prefill.matchedColor,
    twoToneSpec: '',
    threeToneSpec: '',
    metalPurity: '',
    stoneType: prefill.matchedStone,
    stoneCount: '',
    stoneSize: '',
    settingType: prefill.matchedSetting,
    approxWeight: '',
    dimensionLength: '',
    dimensionWidth: '',
    dimensionHeight: '',
    chainLength: '',
    customNotes: '',
    budgetRange: '',
    ringSize: '',
    ringSizeNotes: '',
    customChainLength: '',
    sizeNotes: '',
    bailSize: '',

    // Custom Fields
    metalWeight: '',
    hallmarkRequired: '',
    rhodiumFinish: '',
    stoneShape: '',
    stoneColor: '',
    stoneClarity: '',
    stoneCertificate: '',
    stoneSizeUnit: 'mm',
    braceletLength: '',
    bangleSize: '',
    pendantBailWidth: '',
  });

  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [dimUnit, setDimUnit] = useState<'mm' | 'ct' | 'in'>('mm');
  const [chainUnit, setChainUnit] = useState<'in' | 'cm' | 'mm'>('in');
  const [braceletUnit, setBraceletUnit] = useState<'in' | 'cm' | 'mm'>('in');
  const [showManufacturerSelect, setShowManufacturerSelect] = useState(false);
  const [selectedManufacturerIds, setSelectedManufacturerIds] = useState<string[]>([]);
  const [mfgSearch, setMfgSearch] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [manufacturersList, setManufacturersList] = useState(MANUFACTURERS);
  const [showAddMfgForm, setShowAddMfgForm] = useState(false);
  const [newMfgForm, setNewMfgForm] = useState({ name: '', emails: [{ label: 'Work', value: '' }], phone: '', location: '', is_active: true });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [addMfgError, setAddMfgError] = useState(false);
  const [addMfgErrors, setAddMfgErrors] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<string[]>([]);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedMfgSpecialty, setSelectedMfgSpecialty] = useState(SPECIALTIES[0]);
  const [showMfgSpecialtyDropdown, setShowMfgSpecialtyDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFetchingRef = useRef(false);

  // Production Sheet state
  const [productionSheetFile, setProductionSheetFile] = useState<File | null>(null);
  const [isProductionSheetSubmitting, setIsProductionSheetSubmitting] = useState(false);
  const [isDraftSavingState, setIsDraftSavingState] = useState(false);
  const productionSheetInputRef = useRef<HTMLInputElement>(null);
  const [productionSheetData, setProductionSheetData] = useState<any>(null);
  const [isFetchingProductionSheet, setIsFetchingProductionSheet] = useState(false);

  const [selectedEmailMap, setSelectedEmailMap] = useState<Record<string, string[]>>();
  const [isSending, setIsSending] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [excludedAngles, setExcludedAngles] = useState<string[]>([]);

  useEffect(() => {
    setExcludedAngles([]);
  }, [variantId, activeMetal]);

  useEffect(() => {
    if (showManufacturerSelect) {
      dispatch(resetManufacturers());
      isFetchingRef.current = false;
    }
  }, [showManufacturerSelect, dispatch]);

  useEffect(() => {
    if (!showManufacturerSelect) return;
    dispatch(resetManufacturers());
    isFetchingRef.current = true;
    const timer = setTimeout(() => {
      dispatch(listManufacturers({
        skip: 0,
        limit: 10,
        search: mfgSearch.trim() || undefined,
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
  }, [showManufacturerSelect, mfgSearch, dispatch]);

  const currentDraft = requestDrafts.find((d) => d.isCurrent);

  useEffect(() => {
    if (listStatus === 'succeeded' && apiManufacturersList) {
      const mapped = apiManufacturersList.map(mapApiResponseToManufacturer);
      setManufacturersList(mapped);
    } else if (listStatus === 'idle') {
      setManufacturersList([]);
    }
  }, [apiManufacturersList, listStatus]);

  useEffect(() => {
    const fetchProductionSheet = async () => {
      const rawId = variantId || selectedVariant?.id || currentDraft?.variantId || requestDrafts[0]?.variantId;
      let numericVariantId = Number(rawId);

      if (!numericVariantId || isNaN(numericVariantId)) {
        const rawRequestId = request?.id ? String(request.id) : '';
        const match = rawRequestId.match(/\d+/);
        if (match) {
          numericVariantId = Number(match[0]);
        }
      }

      if (numericVariantId && !isNaN(numericVariantId)) {
        setIsFetchingProductionSheet(true);
        try {
          const result = await dispatch(getProductionSheet(numericVariantId));
          if (getProductionSheet.fulfilled.match(result)) {
            setProductionSheetData(result.payload);
          }
        } catch (error) {
          console.error("Failed to fetch production sheet", error);
        } finally {
          setIsFetchingProductionSheet(false);
        }
      }
    };
    fetchProductionSheet();
  }, [dispatch, variantId, selectedVariant?.id, currentDraft?.variantId, requestDrafts, request?.id]);

  useEffect(() => {
    if (productionSheetData) {
      // Restore selected chain length unit if present
      const rawChainLength = productionSheetData.dimension?.chain_length || '';
      if (rawChainLength) {
        const match = String(rawChainLength).match(/([a-zA-Z]+)$/);
        if (match) {
          const unitVal = match[1].toLowerCase();
          if (['in', 'cm', 'mm'].includes(unitVal)) {
            setChainUnit(unitVal as any);
          }
        }
      }

      // Restore selected bracelet length unit if present
      const rawBraceletLength = productionSheetData.dimension?.bracelet_length || '';
      if (rawBraceletLength) {
        const match = String(rawBraceletLength).match(/([a-zA-Z]+)$/);
        if (match) {
          const unitVal = match[1].toLowerCase();
          if (['in', 'cm', 'mm'].includes(unitVal)) {
            setBraceletUnit(unitVal as any);
          }
        }
      }

      setForm((prev) => {
        let dimensionL = prev.dimensionLength;
        let dimensionW = prev.dimensionWidth;
        let dimensionH = prev.dimensionHeight;
        let ringSz = prev.ringSize;
        let szNotes = prev.sizeNotes;
        let ringSzNotes = prev.ringSizeNotes;

        const dim = productionSheetData.dimension;
        if (dim && typeof dim === 'object') {
          const stripMm = (val: any) => {
            if (val === undefined || val === null) return '';
            return String(val).replace(/mm/i, '').trim();
          };
          if (dim.length) dimensionL = stripMm(dim.length);
          if (dim.width) dimensionW = stripMm(dim.width);
          if (dim.height) dimensionH = stripMm(dim.height);
          if (dim.ring_size) ringSz = String(dim.ring_size);
          if (dim.notes) {
            szNotes = dim.notes;
            ringSzNotes = dim.notes;
          }
        }

        let mType = prev.metalType;
        let mPurity = prev.metalPurity;
        let mColor = prev.metalColor;

        const metDetails = productionSheetData.metal_details;
        if (metDetails && typeof metDetails === 'object') {
          if (metDetails.type) {
            const foundType = METAL_TYPES.find(t => t.toLowerCase() === metDetails.type.toLowerCase());
            mType = foundType || metDetails.type;
          }
          if (metDetails.karat) {
            mPurity = metDetails.karat;
          }
          if (metDetails.color) {
            const colorLower = metDetails.color.toLowerCase();
            const foundColor = METAL_COLORS.find(c => c.id.toLowerCase() === colorLower || c.label.toLowerCase().includes(colorLower));
            mColor = foundColor ? foundColor.id : metDetails.color;
          }
        }

        // Parse custom fields from metadata block inside manufacturing notes
        const rawNotes = productionSheetData.manufacturing_notes || '';
        const { cleanNotes, metadata } = deserializeMetadata(rawNotes);

        let sSize = prev.stoneSize;
        let sSizeUnit = productionSheetData.stone_size_unit || metadata.stoneSizeUnit || 'mm';
        const rawStoneSize = productionSheetData.stone_size || '';
        if (rawStoneSize) {
          const rawStr = String(rawStoneSize);
          if (rawStr.endsWith('ct')) {
            sSize = rawStr.replace('ct', '').trim();
            sSizeUnit = 'ct';
          } else if (rawStr.endsWith('mm')) {
            sSize = rawStr.replace('mm', '').trim();
            sSizeUnit = 'mm';
          } else {
            sSize = rawStr;
          }
        }

        // Helper to strip non-numeric characters for length fields to ensure validity
        const cleanLengthString = (val: any) => {
          if (val === undefined || val === null) return '';
          return String(val).replace(/[a-zA-Z]/g, '').trim();
        };

        return {
          ...prev,
          budgetRange: productionSheetData.budget_range || prev.budgetRange,
          metalType: mType,
          metalPurity: mPurity,
          metalColor: mColor,
          stoneType: productionSheetData.stone_type || prev.stoneType,
          settingType: productionSheetData.setting_type || prev.settingType,
          stoneCount: productionSheetData.stone_count ? String(productionSheetData.stone_count) : prev.stoneCount,
          stoneSize: sSize,
          stoneSizeUnit: sSizeUnit,
          ringSize: ringSz,
          ringSizeNotes: ringSzNotes,
          dimensionLength: dimensionL,
          dimensionWidth: dimensionW,
          dimensionHeight: dimensionH,
          sizeNotes: szNotes,
          customNotes: cleanNotes || prev.customNotes,

          // Metadata fields - read direct properties first, then metadata fallback
          metalWeight: String(productionSheetData.metal_details?.metal_weight || productionSheetData.metal_details?.weight || metadata.metalWeight || '').replace(/g(rams)?/i, '').trim(),
          hallmarkRequired: (productionSheetData.metal_details?.hallmark_required === 'Yes' || productionSheetData.metal_details?.hallmark_required === 'true') ? 'true' : (metadata.hallmarkRequired || ''),
          rhodiumFinish: (productionSheetData.metal_details?.rhodium_finish === 'Yes' || productionSheetData.metal_details?.rhodium_finish === 'true') ? 'true' : (metadata.rhodiumFinish || ''),
          stoneShape: productionSheetData.stone_shape || metadata.stoneShape || '',
          stoneColor: productionSheetData.stone_color || metadata.stoneColor || '',
          stoneClarity: productionSheetData.stone_clarity || metadata.stoneClarity || '',
          stoneCertificate: productionSheetData.stone_certificate || metadata.stoneCertificate || '',
          chainLength: cleanLengthString(productionSheetData.dimension?.chain_length || metadata.chainLength),
          braceletLength: cleanLengthString(productionSheetData.dimension?.bracelet_length || metadata.braceletLength),
          bangleSize: productionSheetData.dimension?.bangle_size || metadata.bangleSize || '',
          pendantBailWidth: productionSheetData.dimension?.pendant_bail_width || metadata.pendantBailWidth || '',
        };
      });

      if (productionSheetData.manufacturing_image) {
        setAttachments([productionSheetData.manufacturing_image]);
      }
      setIsSaved(true);
    }
  }, [productionSheetData]);

  const currentStatus = statusStyles[request.status] ?? { bg: 'bg-tint-gray', text: 'text-ink-500' };

  const filteredManufacturers = useMemo(() => {
    return manufacturersList;
  }, [manufacturersList]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 30) {
      if (listStatus !== 'loading' && !isFetchingRef.current && apiManufacturersList && apiManufacturersList.length < total) {
        isFetchingRef.current = true;
        dispatch(
          listManufacturers({
            skip: apiManufacturersList.length,
            limit: 10,
            search: mfgSearch.trim() || undefined,
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

  // Validation checking
  const errors = useMemo(() => {
    const e: Record<string, boolean> = {};
    if (!form.metalType?.trim()) e.metalType = true;
    if (!form.metalColor?.trim()) e.metalColor = true;
    if (!form.stoneType?.trim()) e.stoneType = true;
    if (!form.budgetRange?.trim()) {
      e.budgetRange = true;
    } else if (!/\d/.test(form.budgetRange)) {
      e.budgetRangeInvalid = true;
    }

    if (form.metalWeight?.trim()) {
      if (isNaN(Number(form.metalWeight)) || Number(form.metalWeight) <= 0) {
        e.metalWeightInvalid = true;
      }
    }
    if (form.stoneType && form.stoneType !== 'No Stone') {
      if (form.stoneCount?.trim()) {
        if (isNaN(Number(form.stoneCount)) || Number(form.stoneCount) <= 0) {
          e.stoneCountInvalid = true;
        }
      }
      if (form.stoneSize?.trim()) {
        if (isNaN(Number(form.stoneSize)) || Number(form.stoneSize) <= 0) {
          e.stoneSizeInvalid = true;
        }
      }
    }
    const jType = form.jewelleryType?.toLowerCase() || '';
    if (['pendant', 'necklace', 'choker'].includes(jType)) {
      if (form.chainLength?.trim()) {
        if (isNaN(Number(form.chainLength)) || Number(form.chainLength) <= 0) {
          e.chainLengthInvalid = true;
        }
      }
    }
    if (jType === 'pendant') {
      if (form.pendantBailWidth?.trim()) {
        if (isNaN(Number(form.pendantBailWidth)) || Number(form.pendantBailWidth) <= 0) {
          e.pendantBailWidthInvalid = true;
        }
      }
    }

    return e;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;
  console.log('[DetailSheetForm Validation] errors:', errors, 'isValid:', isValid, 'form:', form);

  const update = useCallback((field: keyof DetailSheetData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'metalType') {
        next.metalPurity = '';
        if (value === 'Gold') {
          next.metalColor = 'yellow';
        } else if (value === 'Silver' || value === 'Platinum' || value === 'Palladium') {
          next.metalColor = 'white';
        }
      }
      return next;
    });
    setIsSaved(false);
  }, []);

  const toggleManufacturer = (mfg: Manufacturer) => {
    setSelectedManufacturerIds((prev) => {
      const isNowSelected = !prev.includes(mfg.id);
      if (isNowSelected) {
        setSelectedEmailMap((map) => ({
          ...map,
          [mfg.id]: mfg.emails?.map((e) => e.value) || [],
        }));
        return [...prev, mfg.id];
      } else {
        setSelectedEmailMap((map) => {
          const next = { ...map };
          delete next[mfg.id];
          return next;
        });
        return prev.filter((i) => i !== mfg.id);
      }
    });
  };

  const toggleManufacturerEmail = (mfgId: string, emailValue: string) => {
    setSelectedEmailMap((prev) => {
      const current = prev?.[mfgId] || [];
      const next = current.includes(emailValue)
        ? current.filter((e) => e !== emailValue)
        : [...current, emailValue];
      return { ...prev, [mfgId]: next };
    });
  };

  const [isCheckingSheet, setIsCheckingSheet] = useState(false);

  const handleSend = async () => {
    setAttemptedSubmit(true);

    if (!isValid) {
      toast.error("Please fill in all required fields first.");
      return;
    }

    const rawId = variantId || selectedVariant?.id || currentDraft?.variantId || requestDrafts[0]?.variantId;
    let numericVariantId = Number(rawId);
    if (!numericVariantId || isNaN(numericVariantId)) {
      const rawRequestId = request?.id ? String(request.id) : '';
      const match = rawRequestId.match(/\d+/);
      if (match) {
        numericVariantId = Number(match[0]);
      }
    }
    if (!numericVariantId || isNaN(numericVariantId)) {
      toast.error("No valid numeric variant ID found for checking production sheet.");
      return;
    }

    setIsCheckingSheet(true);
    try {
      const result = await dispatch(getProductionSheet({ variantId: numericVariantId, forceRefresh: true }));
      if (getProductionSheet.fulfilled.match(result) && result.payload) {
        setProductionSheetData(result.payload);
        setShowManufacturerSelect(true);
      } else {
        toast.error("No production sheet found for this design variant. Please click 'Save Draft' to save it first.");
      }
    } catch (error) {
      console.error("Error fetching production sheet:", error);
      toast.error("Error checking production sheet. Please try again.");
    } finally {
      setIsCheckingSheet(false);
    }
  };

  const handleModalSend = async () => {
    if (selectedManufacturerIds.length === 0) return;

    const rawId = variantId || selectedVariant?.id || currentDraft?.variantId || requestDrafts[0]?.variantId;
    const numericVariantId = Number(rawId);
    if (!numericVariantId || isNaN(numericVariantId)) {
      toast.error('No valid variant ID found. Cannot send design.');
      return;
    }

    setIsSending(true);

    try {
      const hasDummy = selectedManufacturerIds.some((id) => id.startsWith('m') || isNaN(Number(id)));
      if (hasDummy) {
        toast.error("Dummy/invalid manufacturers cannot be shared with. Please select a registered manufacturer.");
        setIsSending(false);
        return;
      }

      const numericMfgIds = selectedManufacturerIds.map((id) => Number(id));

      const mfgEmailsMap: Record<string, string[]> = {};
      selectedManufacturerIds.forEach((mfgId) => {
        const emails = selectedEmailMap?.[mfgId] || [];
        mfgEmailsMap[String(mfgId)] = emails;
      });

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

      console.info('[DetailSheetForm] Sharing design variant:', {
        variantId: numericVariantId,
        manufacturer_ids: numericMfgIds,
        emails: mfgEmailsMap,
        angles: includedAngleKeys,
      });

      await dispatch(
        shareVariantWithManufacturer({
          variantId: numericVariantId,
          manufacturer_ids: numericMfgIds,
          emails: mfgEmailsMap,
          angles: includedAngleKeys,
        })
      ).unwrap();

      toast.success(
        selectedManufacturerIds.length === 1
          ? 'Design shared with manufacturer successfully!'
          : `Design shared with ${selectedManufacturerIds.length} manufacturers successfully!`
      );
      setShowManufacturerSelect(false);
      onSubmit(form, selectedManufacturerIds);
    } catch (err: any) {
      console.error('[DetailSheetForm] Sharing failed:', err);
      toast.error(String(err || 'Failed to share design with manufacturers.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleAddAndSelect = async () => {
    setSubmitError(null);
    setAddMfgErrors({});
    const errs: Record<string, string> = {};

    if (!newMfgForm.name.trim()) {
      errs.name = 'Manufacturer name is required';
      setAddMfgError(true);
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMfgForm.name.trim())) {
      errs.name = 'Manufacturer Name cannot be an email address';
    }

    const validEmails = newMfgForm.emails.filter((em) => em.value.trim());
    if (validEmails.length === 0) {
      errs.email = 'At least one email is required';
    } else {
      const invalid = validEmails.find((em) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim()));
      if (invalid) {
        errs.email = `Invalid email format: ${invalid.value.trim()}`;
      }
    }

    const phoneMaxLength = getPhoneMaxLength(phoneCountryCode);
    const normalizedPhone = sanitizePhoneDigits(newMfgForm.phone, phoneMaxLength);
    if (!normalizedPhone) {
      errs.phone = 'Phone number is required.';
    } else if (normalizedPhone.length !== phoneMaxLength) {
      errs.phone = getPhoneLengthMessage(phoneCountryCode);
    }

    if (Object.keys(errs).length > 0) {
      setAddMfgErrors(errs);
      return;
    }
    setAddMfgError(false);

    const mappedEmails = validEmails.map((em) => ({
      label: em.label.trim() || 'Work',
      email: em.value.trim(),
    }));

    const payload = {
      name: newMfgForm.name.trim(),
      speciality: selectedMfgSpecialty.label,
      emails: mappedEmails,
      phone_number: `${phoneCountryCode}${normalizedPhone}`,
      location: newMfgForm.location.trim(),
      is_active: newMfgForm.is_active,
    };

    try {
      const response = await dispatch(createManufacturer(payload)).unwrap();
      const stringifiedId = String(response.id);
      const primaryEmail = response.emails?.[0]?.email || '';

      setSelectedManufacturerIds((prev) => [...prev, stringifiedId]);
      setSelectedEmailMap((map) => ({
        ...map,
        [stringifiedId]: response.emails?.map((e) => e.email) || [primaryEmail],
      }));

      setNewMfgForm({ name: '', emails: [{ label: 'Work', value: '' }], phone: '', location: '', is_active: true });
      setSelectedMfgSpecialty(SPECIALTIES[0]);
      setPhoneCountryCode('+1');
      setShowAddMfgForm(false);
      setMfgSearch('');
    } catch (err: any) {
      setSubmitError(String(err || 'Failed to add manufacturer'));
      toast.error(err || 'Failed to add manufacturer');
    }
  };

  const buildPayload = (numericVariantId: number, imageFile: File | null) => {
    const metalDetailsObj = {
      type: form.metalType ? form.metalType.toLowerCase() : "",
      karat: form.metalPurity || "",
      color: form.metalColor ? form.metalColor.toLowerCase() : "",
      metal_weight: form.metalWeight ? `${form.metalWeight} grams` : "",
      weight: form.metalWeight ? `${form.metalWeight} grams` : "",
      hallmark_required: form.hallmarkRequired === 'true' || form.hallmarkRequired === 'Yes' ? 'Yes' : 'No',
      rhodium_finish: form.rhodiumFinish === 'true' || form.rhodiumFinish === 'Yes' ? 'Yes' : 'No',
    };

    const dimensionObj: Record<string, string> = {};
    if (form.dimensionLength) dimensionObj.length = form.dimensionLength + dimUnit;
    if (form.dimensionWidth) dimensionObj.width = form.dimensionWidth + dimUnit;
    if (form.dimensionHeight) dimensionObj.height = form.dimensionHeight + dimUnit;
    if (form.ringSize) dimensionObj.ring_size = form.ringSize;
    if (form.sizeNotes) dimensionObj.notes = form.sizeNotes;
    if (form.chainLength) dimensionObj.chain_length = form.chainLength + chainUnit;
    if (form.braceletLength) dimensionObj.bracelet_length = form.braceletLength + braceletUnit;
    if (form.bangleSize) dimensionObj.bangle_size = form.bangleSize;
    if (form.pendantBailWidth) dimensionObj.pendant_bail_width = form.pendantBailWidth;

    return {
      variant_id: numericVariantId,
      manufacturing_image: imageFile,
      budget_range: form.budgetRange || undefined,
      metal_details: metalDetailsObj,
      stone_type: form.stoneType || undefined,
      setting_type: form.stoneType !== 'No Stone' ? form.settingType || undefined : undefined,
      stone_count: form.stoneType !== 'No Stone' && form.stoneCount ? Number(form.stoneCount) : undefined,
      stone_size: form.stoneType !== 'No Stone' && form.stoneSize ? `${form.stoneSize}${form.stoneSizeUnit}` : undefined,
      stone_size_unit: form.stoneType !== 'No Stone' && form.stoneSizeUnit ? form.stoneSizeUnit : undefined,
      stone_shape: form.stoneType !== 'No Stone' && form.stoneShape ? form.stoneShape : undefined,
      stone_color: form.stoneType !== 'No Stone' && form.stoneColor ? form.stoneColor : undefined,
      stone_clarity: form.stoneType !== 'No Stone' && form.stoneClarity ? form.stoneClarity : undefined,
      stone_certificate: form.stoneType !== 'No Stone' && form.stoneCertificate ? form.stoneCertificate : undefined,
      dimension: dimensionObj,
      manufacturing_notes: form.customNotes || undefined,
    };
  };

  const handleSaveDraft = async () => {
    setAttemptedSubmit(true);
    const rawId = variantId || selectedVariant?.id || currentDraft?.variantId || requestDrafts[0]?.variantId;
    let numericVariantId = Number(rawId);
    if (!numericVariantId || isNaN(numericVariantId)) {
      const rawRequestId = request?.id ? String(request.id) : '';
      const match = rawRequestId.match(/\d+/);
      if (match) {
        numericVariantId = Number(match[0]);
      }
    }
    if (!numericVariantId || isNaN(numericVariantId)) {
      toast.error("No valid numeric variant ID found.");
      return;
    }

    setIsDraftSavingState(true);
    try {
      const payload = buildPayload(numericVariantId, selectedImageFile);
      console.log("[DetailSheetForm] Dispatching createProductionSheet payload from Save Draft:", payload);
      const result = await dispatch(createProductionSheet(payload));
      if (createProductionSheet.fulfilled.match(result)) {
        toast.success("Production sheet draft saved successfully!");
        setSelectedImageFile(null);
        setProductionSheetFile(null);

        const getResult = await dispatch(getProductionSheet({ variantId: numericVariantId, forceRefresh: true }));
        if (getProductionSheet.fulfilled.match(getResult)) {
          setProductionSheetData(getResult.payload);
        }

        onSaveDraft(form);
        setIsSaved(true);
      } else {
        toast.error("Failed to save draft");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving draft");
    } finally {
      setIsDraftSavingState(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setAttachments([localUrl]);
    setIsSaved(false);
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments([]);
    setSelectedImageFile(null);
    setIsSaved(false);
  };



  const handleProductionSheetSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setProductionSheetFile(file);

      const rawId = variantId || selectedVariant?.id || currentDraft?.variantId || requestDrafts[0]?.variantId;
      let numericVariantId = Number(rawId);
      if (!numericVariantId || isNaN(numericVariantId)) {
        const rawRequestId = request?.id ? String(request.id) : '';
        const match = rawRequestId.match(/\d+/);
        if (match) {
          numericVariantId = Number(match[0]);
        }
      }
      if (!numericVariantId || isNaN(numericVariantId)) {
        toast.error("No valid numeric variant ID found.");
        return;
      }

      setIsProductionSheetSubmitting(true);
      try {
        const payload = buildPayload(numericVariantId, file);
        const result = await dispatch(createProductionSheet(payload));
        if (createProductionSheet.fulfilled.match(result)) {
          toast.success("Production sheet created successfully");
          setProductionSheetFile(null);

          const getResult = await dispatch(getProductionSheet({ variantId: numericVariantId, forceRefresh: true }));
          if (getProductionSheet.fulfilled.match(getResult)) {
            setProductionSheetData(getResult.payload);
          }
        } else {
          toast.error("Failed to create production sheet");
        }
      } catch (err) {
        console.error(err);
        toast.error("Error creating production sheet");
      } finally {
        setIsProductionSheetSubmitting(false);
      }
    }
  };

  const karatOptions = useMemo(() => {
    return PURITY_MAP[form.metalType] || [];
  }, [form.metalType]);

  const colorOptions = useMemo(() => {
    return METAL_COLORS_MAP[form.metalType] || METAL_COLORS_MAP['Gold'];
  }, [form.metalType]);

  const jType = (form.jewelleryType || '').toLowerCase();

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-black/25 backdrop-blur-[2px]" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-[10000] w-full max-w-[520px] flex flex-col overflow-hidden bg-gradient-paper-warm dark:bg-none dark:bg-surface-100 shadow-[-16px_0_48px_rgba(0,0,0,0.10),_-4px_0_16px_rgba(0,0,0,0.06)] dark:shadow-[-16px_0_48px_rgba(0,0,0,0.40)] border-l border-transparent dark:border-border-default animate-[slideIn_280ms_cubic-bezier(0.16,1,0.3,1)_forwards]">

        {/* Header */}
        <div className="flex-shrink-0 px-7 pt-6 pb-5 border-b border-[rgba(0,0,0,0.05)] dark:border-border-default">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[18px] font-bold text-[#1A1A1A] dark:text-ink font-satoshi tracking-[-0.3px]">
                Detail Sheet
              </h2>
              <p className="text-[12px] text-[#9CA3AF] dark:text-ink-600 mt-0.5">Review manufacturing specifications before sending.</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
              <i className="ri-close-line text-[18px] text-[#9CA3AF] dark:text-[#D1D5DB]" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-7 py-5 flex flex-col gap-4">

          {/* Section 1 — Design Summary */}
          <div className="rounded-[16px] p-5 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] dark:border-border-default mt-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 flex items-center justify-center">
                <i className="ri-image-line text-[15px] text-[#3B82F6]" />
              </span>
              <h4 className="text-[13px] font-semibold text-[#1A1A1A] dark:text-ink font-satoshi">Design Summary</h4>
              <span className={`ml-auto text-[10.5px] font-medium px-2 py-0.5 rounded-full ${currentStatus.bg} ${currentStatus.text}`}>
                {request.status}
              </span>
            </div>
            <div className={`grid grid-cols-1 ${displayAngles.length > 0 ? 'sm:grid-cols-[1fr_130px]' : 'sm:grid-cols-1'} gap-3 sm:gap-4 mb-4`}>
              {/* LEFT: Large primary render */}
              <div className="rounded-[14px] overflow-hidden border border-black/[0.05] dark:border-border-default h-[220px] bg-[#F7F6F3] dark:bg-surface-150">
                {displayMainImage ? (
                  <img
                    src={displayMainImage}
                    alt="Primary Render"
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[12px] text-[#9CA3AF] dark:text-[#D1D5DB]">
                    No render available
                  </div>
                )}
              </div>
              {/* RIGHT: Stacked angle cards */}
              {displayAngles.length > 0 && (
                <div className="grid grid-cols-3 sm:flex sm:flex-col gap-2 h-auto min-h-0 justify-start">
                  {displayAngles.map((angle) => {
                    const isExcluded = excludedAngles.includes(angle.id);
                    return (
                      <div
                        key={angle.id}
                        className="relative w-full rounded-[10px] size-20 overflow-hidden group aspect-square border border-black/[0.05] dark:border-border-default bg-[#F7F6F3] dark:bg-surface-150 flex items-center justify-center"
                      >
                        <img
                          src={angle.image}
                          alt={angle.label}
                          className={`w-full h-full object-cover object-top ${isExcluded ? 'opacity-40 filter grayscale' : ''}`}
                        />
                        <div className="absolute bottom-0 left-0 right-0 px-2 py-0.5 bg-gradient-to-t from-black/50 to-transparent">
                          <span className="text-[8.5px] font-semibold text-white">
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
                            <i className="ri-add-line text-white text-[16px]" />
                            <span className="text-[8px] font-semibold text-white uppercase tracking-wider">Restore</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors cursor-pointer border-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExcludedAngles(prev => [...prev, angle.id]);
                            }}
                          >
                            <i className="ri-close-line text-[10px]" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#D1D5DB] px-2 py-0.5 rounded-md bg-[#F3F4F6] dark:bg-surface-150">{request.id}</span>
                  {currentDraft && (
                    <span className="text-[11px] font-semibold text-[#3B82F6] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10">{currentDraft.version}</span>
                  )}
                </div>
                <p className="text-[14px] font-semibold text-[#1A1A1A] dark:text-ink">{request.type}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {requestSpecs.map((spec) => (
                    <span key={spec.label} className="text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-[#F7F6F3] dark:bg-surface-150 text-[#6B7280] dark:text-[#D1D5DB] border border-black/[0.04] dark:border-border-default">
                      {spec.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 — Budget */}
          <div className="rounded-[16px] p-5 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] dark:border-border-default mt-2">
            <SectionHeader icon="ri-money-dollar-circle-line" label="Budget" />
            <div>
              <FieldLabel required>Budget Range ($)</FieldLabel>
              <TextInput
                value={form.budgetRange}
                onChange={(v) => {
                  let clean = v.replace(/[^0-9\-\s,\$]/g, '');
                  // Prevent negative number at start (no minus as first character or after space/dollar)
                  clean = clean.replace(/^[\s\$]*\-+/, '');
                  // Limit to at most one dash (range separator)
                  const dashIndex = clean.indexOf('-');
                  if (dashIndex !== -1) {
                    clean = clean.slice(0, dashIndex + 1) + clean.slice(dashIndex + 1).replace(/\-/g, '');
                  }
                  update('budgetRange', clean);
                }}
                placeholder="e.g. 1000-2000 or $1500"
                hasError={attemptedSubmit && (errors.budgetRange || errors.budgetRangeInvalid)}
              />
              {attemptedSubmit && errors.budgetRange && <p className="text-[11px] text-[#EF4444] mt-1">Required</p>}
              {attemptedSubmit && errors.budgetRangeInvalid && <p className="text-[11px] text-[#EF4444] mt-1">Please enter a valid amount or range (must contain numbers)</p>}
            </div>
          </div>

          {/* Section 3 — Metal Details */}
          <div className="rounded-[16px] relative z-[30] p-5 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] dark:border-border-default mt-2">
            <SectionHeader icon="ri-vip-crown-line" label="Metal Details" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <FieldLabel required>Metal Type</FieldLabel>
                <SelectDropdown value={form.metalType} onChange={(v) => update('metalType', v)} options={METAL_TYPES} placeholder="Select metal..." hasError={attemptedSubmit && errors.metalType} />
                {attemptedSubmit && errors.metalType && <p className="text-[11px] text-[#EF4444] mt-1">Required</p>}
              </div>
              <div>
                <FieldLabel>Metal Karat / Purity</FieldLabel>
                <SelectDropdown
                  value={form.metalPurity}
                  onChange={(v) => update('metalPurity', v)}
                  options={karatOptions}
                  placeholder={form.metalType ? "Select purity..." : "Select metal first"}
                />
              </div>
            </div>

            <div className="mb-4">
              <FieldLabel required>Metal Color</FieldLabel>
              <div className="flex items-center gap-2 flex-wrap">
                {colorOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update('metalColor', c.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12.5px] font-medium transition-all cursor-pointer border ${form.metalColor === c.id
                      ? 'bg-[#EFF6FF] dark:bg-blue-500/10 border-[#3B82F6]/30 dark:border-blue-500/30 text-[#3B82F6] dark:text-brand'
                      : attemptedSubmit && errors.metalColor
                        ? 'bg-[#FDF2F2] dark:bg-red-500/5 border-[#EF4444] text-red-500'
                        : 'bg-[#F7F6F3] dark:bg-surface-150 border-transparent dark:border-border-default text-[#6B7280] dark:text-[#D1D5DB] hover:border-black/[0.06] dark:hover:border-border-default'
                      }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0 ${c.dotClass}`} />
                    {c.label}
                  </button>
                ))}
              </div>
              {attemptedSubmit && errors.metalColor && <p className="text-[11px] text-[#EF4444] mt-1">Required</p>}
            </div>

            {form.metalColor === 'twotone' && (
              <div className="mt-3">
                <FieldLabel>Two Tone Specification</FieldLabel>
                <TextInput value={form.twoToneSpec} onChange={(v) => update('twoToneSpec', v)} placeholder="e.g. Yellow + White" />
              </div>
            )}
            {form.metalColor === 'threetone' && (
              <div className="mt-3">
                <FieldLabel>Three Tone Specification</FieldLabel>
                <TextInput value={form.threeToneSpec} onChange={(v) => update('threeToneSpec', v)} placeholder="e.g. Rose + White + Yellow" />
              </div>
            )}

            {/* Optional Metal Specs */}
            <div className="mt-4 border-t border-black/[0.05] dark:border-border-default pt-4">
              <div>
                <FieldLabel>Metal Weight (grams)</FieldLabel>
                <TextInput
                  value={form.metalWeight || ''}
                  onChange={(v) => update('metalWeight', v)}
                  placeholder="e.g. 8.5"
                  type="number"
                  hasError={attemptedSubmit && errors.metalWeightInvalid}
                />
                {attemptedSubmit && errors.metalWeightInvalid && <p className="text-[11px] text-[#EF4444] mt-1">Please enter a valid positive weight</p>}
              </div>
            </div>
          </div>

          {/* Section 4 — Stone Details */}
          <div className="rounded-[16px] relative z-[20] p-5 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] dark:border-border-default mt-2">
            <SectionHeader icon="ri-vip-diamond-line" label="Stone Details" />
            <div className="mb-4">
              <FieldLabel required>Stone Type</FieldLabel>
              <SelectDropdown value={form.stoneType} onChange={(v) => update('stoneType', v)} options={STONE_TYPES} placeholder="Select stone..." hasError={attemptedSubmit && errors.stoneType} />
              {attemptedSubmit && errors.stoneType && <p className="text-[11px] text-[#EF4444] mt-1">Required</p>}
            </div>

            {form.stoneType !== 'No Stone' && (
              <div className="grid grid-cols-2 gap-3 border-t border-black/[0.05] dark:border-border-default pt-4 animate-[fadeIn_200ms_ease-out_forwards]">
                <div>
                  <FieldLabel>Setting Type</FieldLabel>
                  <SelectDropdown value={form.settingType} onChange={(v) => update('settingType', v)} options={SETTING_TYPES} placeholder="Select setting..." />
                </div>
                <div>
                  <FieldLabel>Stone Count</FieldLabel>
                  <TextInput
                    value={form.stoneCount}
                    onChange={(v) => update('stoneCount', v)}
                    placeholder="e.g. 12"
                    type="number"
                    hasError={attemptedSubmit && form.stoneType !== 'No Stone' && errors.stoneCountInvalid}
                  />
                  {attemptedSubmit && form.stoneType !== 'No Stone' && errors.stoneCountInvalid && <p className="text-[11px] text-[#EF4444] mt-1">Must be positive number</p>}
                </div>

                <div className="col-span-2">
                  <FieldLabel>Stone Size</FieldLabel>
                  <div className={`flex items-center bg-[#FAF9F6] dark:bg-surface-150 rounded-[12px] p-1 border ${attemptedSubmit && form.stoneType !== 'No Stone' && errors.stoneSizeInvalid ? 'border-[#EF4444] focus-within:border-[#EF4444] focus-within:shadow-[0_0_0_2.5px_rgba(239,68,68,0.1)]' : 'border-black/[0.04] dark:border-border-default focus-within:bg-white focus-within:border-[#3B82F6]/30 focus-within:shadow-[0_0_0_2.5px_rgba(59,130,246,0.06)]'} transition-all`}>
                    <input
                      type="text"
                      value={form.stoneSize}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        update('stoneSize', val);
                      }}
                      placeholder="e.g. 3.0 or 0.5"
                      className="flex-1 min-w-0 bg-transparent px-3 py-1.5 text-[13.5px] text-[#1A1A1A] dark:text-ink placeholder:text-[#9CA3AF] dark:placeholder:text-ink-600 outline-none"
                    />
                    <div className="flex gap-1 pr-1">
                      {['mm', 'ct'].map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => update('stoneSizeUnit', u)}
                          className={`px-3 py-1.5 rounded-[8px] text-[10.5px] font-bold uppercase transition-all select-none cursor-pointer ${form.stoneSizeUnit === u
                            ? 'bg-[#3B82F6] text-white shadow-sm dark:text-black dark:bg-[#60A5FA]'
                            : 'bg-black/[0.03] dark:bg-white/[0.03] text-[#6B7280] dark:text-[#D1D5DB] hover:text-[#1A1A1A] dark:hover:text-ink'
                            }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                  {attemptedSubmit && form.stoneType !== 'No Stone' && errors.stoneSizeInvalid && <p className="text-[11px] text-[#EF4444] mt-1">Must be positive number</p>}
                </div>

              </div>
            )}
          </div>

          {/* Section 5 — Size & Dimensions */}
          <div className="rounded-[16px] relative z-[10] p-5 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] dark:border-border-default mt-2">
            <SectionHeader icon="ri-ruler-line" label="Size & Dimensions" />

            {/* If Type = Pendant */}
            {jType === 'pendant' && (
              <div className="mb-4 animate-[fadeIn_200ms_ease-out_forwards]">
                <div className="flex items-center justify-between mb-3 border-b border-black/[0.03] dark:border-white/[0.03] pb-3">
                  <span className="text-[12px] font-semibold text-[#1A1A1A] dark:text-ink">Pendant Dimensions</span>
                  <div className="flex gap-1">
                    {['mm', 'ct', 'in'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setDimUnit(u as any)}
                        className={`px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${dimUnit === u
                          ? 'bg-[#3B82F6] text-white shadow-sm dark:text-black dark:bg-[#60A5FA]'
                          : 'bg-black/[0.03] dark:bg-white/[0.03] text-[#6B7280] dark:text-[#D1D5DB] hover:text-[#1A1A1A] dark:hover:text-ink'
                          }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <FieldLabel>Length ({dimUnit})</FieldLabel>
                    <div className="relative">
                      <TextInput
                        value={form.dimensionLength}
                        onChange={(v) => update('dimensionLength', v)}
                        placeholder="L"
                        type="number"
                        className="pr-8"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#9CA3AF] dark:text-ink-600 pointer-events-none">{dimUnit}</span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Width ({dimUnit})</FieldLabel>
                    <div className="relative">
                      <TextInput
                        value={form.dimensionWidth}
                        onChange={(v) => update('dimensionWidth', v)}
                        placeholder="W"
                        type="number"
                        className="pr-8"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#9CA3AF] dark:text-ink-600 pointer-events-none">{dimUnit}</span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Height ({dimUnit})</FieldLabel>
                    <div className="relative">
                      <TextInput
                        value={form.dimensionHeight}
                        onChange={(v) => update('dimensionHeight', v)}
                        placeholder="H"
                        type="number"
                        className="pr-8"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#9CA3AF] dark:text-ink-600 pointer-events-none">{dimUnit}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel>Custom Size notes</FieldLabel>
                  <TextArea
                    value={form.sizeNotes}
                    onChange={(v) => update('sizeNotes', v)}
                    placeholder="Enter custom size notes..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* If Type = Ring */}
            {jType === 'ring' && (
              <div className="mb-4 animate-[fadeIn_200ms_ease-out_forwards]">
                <div className="mb-4">
                  <FieldLabel>Ring Size (US)</FieldLabel>
                  <SelectDropdown
                    value={form.ringSize}
                    onChange={(v) => update('ringSize', v)}
                    options={RING_SIZES}
                    placeholder="Select Ring Size..."
                  />
                </div>

                <div>
                  <FieldLabel>Custom Size notes</FieldLabel>
                  <TextArea
                    value={form.sizeNotes}
                    onChange={(v) => update('sizeNotes', v)}
                    placeholder="Enter custom size notes..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* If Type = Chain, Necklace, Choker */}
            {['chain', 'necklace', 'choker'].includes(jType) && (
              <div className="mb-4 animate-[fadeIn_200ms_ease-out_forwards]">
                <div className="flex items-center justify-between mb-3 border-b border-black/[0.03] dark:border-white/[0.03] pb-3">
                  <span className="text-[12px] font-semibold text-[#1A1A1A] dark:text-ink">Chain Specifications</span>
                  <div className="flex gap-1">
                    {['in', 'cm', 'mm'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setChainUnit(u as any)}
                        className={`px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${chainUnit === u
                          ? 'bg-[#3B82F6] text-white shadow-sm dark:text-black dark:bg-[#60A5FA]'
                          : 'bg-black/[0.03] dark:bg-white/[0.03] text-[#6B7280] dark:text-[#D1D5DB] hover:text-[#1A1A1A] dark:hover:text-ink'
                          }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <FieldLabel>Chain Length ({chainUnit})</FieldLabel>
                  <div className="relative">
                    <TextInput
                      value={form.chainLength || ''}
                      onChange={(v) => update('chainLength', v)}
                      placeholder="e.g. 18, 20"
                      type="number"
                      className="pr-8"
                      hasError={attemptedSubmit && errors.chainLengthInvalid}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#9CA3AF] dark:text-ink-600 pointer-events-none">{chainUnit}</span>
                  </div>
                  {attemptedSubmit && errors.chainLengthInvalid && <p className="text-[11px] text-[#EF4444] mt-1">Must be positive number</p>}
                </div>

                <div>
                  <FieldLabel>Custom Size notes</FieldLabel>
                  <TextArea
                    value={form.sizeNotes}
                    onChange={(v) => update('sizeNotes', v)}
                    placeholder="Enter custom size notes..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* If Type = Bracelet, Cuff, Anklet, Bangle */}
            {['bracelet', 'cuff', 'anklet', 'bangle'].includes(jType) && (
              <div className="mb-4 animate-[fadeIn_200ms_ease-out_forwards]">
                <div className="flex items-center justify-between mb-3 border-b border-black/[0.03] dark:border-white/[0.03] pb-3">
                  <span className="text-[12px] font-semibold text-[#1A1A1A] dark:text-ink">Bracelet Specifications</span>
                  <div className="flex gap-1">
                    {['in', 'cm', 'mm'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setBraceletUnit(u as any)}
                        className={`px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${braceletUnit === u
                          ? 'bg-[#3B82F6] text-white shadow-sm dark:text-black dark:bg-[#60A5FA]'
                          : 'bg-black/[0.03] dark:bg-white/[0.03] text-[#6B7280] dark:text-[#D1D5DB] hover:text-[#1A1A1A] dark:hover:text-ink'
                          }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <FieldLabel>Bracelet Length ({braceletUnit})</FieldLabel>
                  <div className="relative">
                    <TextInput
                      value={form.braceletLength || ''}
                      onChange={(v) => update('braceletLength', v)}
                      placeholder="e.g. 7.0, 7.5"
                      type="number"
                      className="pr-8"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#9CA3AF] dark:text-ink-600 pointer-events-none">{braceletUnit}</span>
                  </div>
                </div>

                <div>
                  <FieldLabel>Custom Size notes</FieldLabel>
                  <TextArea
                    value={form.sizeNotes}
                    onChange={(v) => update('sizeNotes', v)}
                    placeholder="Enter custom size notes..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Default for all other types */}
            {!['pendant', 'ring', 'chain', 'necklace', 'choker', 'bracelet', 'cuff', 'anklet', 'bangle'].includes(jType) && (
              <div className="animate-[fadeIn_200ms_ease-out_forwards]">
                <div>
                  <FieldLabel>Custom Size notes</FieldLabel>
                  <TextArea
                    value={form.sizeNotes}
                    onChange={(v) => update('sizeNotes', v)}
                    placeholder="Enter custom size notes..."
                    rows={4}
                  />
                </div>
              </div>
            )}

          </div>

          {/* Section 6 — Manufacturing Notes */}
          <div className="rounded-[16px] p-5 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] dark:border-border-default mt-2">
            <SectionHeader icon="ri-file-text-line" label="Manufacturing Notes" />
            <TextArea
              value={form.customNotes}
              onChange={(v) => update('customNotes', v)}
              placeholder="Add casting, finishing, polish, or production notes…"
              rows={4}
            />

            {/* Clickable Quick Example Tags */}
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#D1D5DB] uppercase tracking-wider block w-full mb-1">Quick Instructions</span>
              {EXAMPLE_NOTES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    const current = form.customNotes.trim();
                    const next = current ? `${current}\n- ${ex}` : `- ${ex}`;
                    update('customNotes', next);
                  }}
                  className="px-2.5 py-1 rounded-[6px] text-[11px] font-medium bg-[#F3F4F6] dark:bg-surface-150 text-[#374151] dark:text-ink hover:bg-[#EBECEF] dark:hover:bg-surface-200 border border-black/[0.03] dark:border-white/[0.03] transition-all cursor-pointer select-none"
                >
                  + {ex}
                </button>
              ))}
            </div>

            <p className="text-[11.5px] text-[#9CA3AF] dark:text-ink-600 mt-2 text-right font-medium font-inter">{form.customNotes.length}/500</p>

            <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/png,image/jpeg,image/jpg" onChange={handleFileSelect} />
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {attachments.length === 0 ? (
                <div className="w-16 h-16 rounded-[12px] bg-[#EBEBEB] dark:bg-surface-150 flex items-center justify-center text-[13px] text-[#9CA3AF] dark:text-ink-600 font-semibold font-inter select-none border border-black/[0.08] dark:border-white/[0.08]">
                  Image
                </div>
              ) : (
                attachments.map((url, idx) => (
                  <div key={idx} className="relative w-12 h-12 rounded-[12px] overflow-hidden border border-black/[0.05] dark:border-border-default flex-shrink-0 group shadow-sm bg-white dark:bg-surface-150">
                    <img src={url} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover object-top" />
                    <button onClick={() => removeAttachment(idx)} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <i className="ri-close-line text-[16px] text-white" />
                    </button>
                  </div>
                ))
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 h-[42px] rounded-[12px] text-[13px] font-semibold text-[#374151] dark:text-ink bg-[#EBECEF] hover:bg-[#E1E2E6] dark:bg-surface-150 dark:hover:bg-surface-200 transition-all cursor-pointer whitespace-nowrap shadow-[0px_1px_2px_rgba(0,0,0,0.05)] border border-black/[0.08] dark:border-white/[0.08]"
              >
                <span className="w-4.5 h-4.5 flex items-center justify-center">
                  <i className="ri-upload-cloud-line text-[16px] text-current" />
                </span>
                Upload
              </button>
            </div>
          </div>

          {/* Section 7 — Sheet Summary */}
          <div className="rounded-[16px] p-5 bg-white dark:bg-surface-100 shadow-[0px_2px_12px_rgba(0,0,0,0.04),_0px_0px_1px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-border-default">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[13px] font-semibold text-[#1A1A1A] dark:text-ink font-satoshi">Sheet Summary</h4>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${!isValid ? 'bg-[#F59E0B]' : !isSaved ? 'bg-[#3B82F6]' : 'bg-[#22C55E]'}`} />
                <p className={`text-[11.5px] font-medium ${!isValid ? 'text-[#B45309]' : !isSaved ? 'text-[#3B82F6]' : 'text-[#16A34A]'}`}>
                  {!isValid ? 'Complete required fields' : !isSaved ? 'Save draft before sending' : 'Ready to send'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[10px] px-3 py-2 bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.04] dark:border-border-default">
                <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wider">Product</p>
                <p className="text-[12px] font-medium text-[#1A1A1A] dark:text-ink mt-0.5 truncate">{form.jewelleryType || '—'}</p>
              </div>
              <div className="rounded-[10px] px-3 py-2 bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.04] dark:border-border-default">
                <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wider">Metal</p>
                <p className="text-[12px] font-medium text-[#1A1A1A] dark:text-ink mt-0.5 truncate">
                  {form.metalType && form.metalPurity ? `${form.metalPurity} ${form.metalType}` : '—'}
                </p>
              </div>
              <div className="rounded-[10px] px-3 py-2 bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.04] dark:border-border-default">
                <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wider">Budget</p>
                <p className="text-[12px] font-medium text-[#1A1A1A] dark:text-ink mt-0.5 truncate">{form.budgetRange || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Footer */}
        <div className="flex-shrink-0 px-6 py-4 flex flex-row items-center justify-between border-t border-black/[0.05] dark:border-border-default bg-white dark:bg-surface-100 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <input
            type="file"
            ref={productionSheetInputRef}
            className="hidden"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleProductionSheetSelect}
          />

          {/* Save Draft */}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isDraftSavingState}
            className="flex items-center justify-center gap-2 px-4 py-2.5 h-[42px] rounded-[12px] text-[12.5px] font-medium text-[#6B7280] dark:text-ink bg-white dark:bg-surface-100 border border-gray-200 dark:border-border-default hover:bg-gray-50 dark:hover:bg-surface-150 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer select-none"
          >
            <span className="w-4.5 h-4.5 flex items-center justify-center">
              {isDraftSavingState ? (
                <i className="ri-loader-4-line animate-spin text-[15px]" />
              ) : (
                <i className="ri-draft-line text-[15px]" />
              )}
            </span>
            <span>{isDraftSavingState ? 'Saving...' : 'Save Draft'}</span>
          </button>

          {/* Send to Manufacturer */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isCheckingSheet || !isValid || !isSaved}
            className="flex items-center gap-1.5 px-5 py-2.5 h-[42px] rounded-[12px] text-[12.5px] font-semibold text-white transition-all cursor-pointer hover:opacity-90 justify-center bg-[#3B82F6] shadow-[0px_4px_14px_rgba(59,130,246,0.28)] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed dark:text-black dark:bg-[#60A5FA]"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              {isCheckingSheet ? (
                <i className="ri-loader-4-line animate-spin text-[14px]" />
              ) : (
                <i className="ri-send-plane-line text-[14px]" />
              )}
            </span>
            <span>{isCheckingSheet ? 'Checking...' : 'Send to Manufacturer'}</span>
          </button>
        </div>

        <style jsx>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0.9; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (max-w: 480px) {
            .detail-sheet-actions {
              flex-direction: column !important;
              align-items: stretch !important;
            }
          }
        `}</style>
      </div>

      {/* Manufacturer Selection Modal */}
      {showManufacturerSelect && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowManufacturerSelect(false)} />
          <div
            className="relative w-full max-w-[480px] mx-4 rounded-[20px] overflow-hidden flex flex-col max-h-[85vh] bg-white dark:bg-surface-100 shadow-[0px_24px_64px_rgba(0,0,0,0.14),_0px_4px_16px_rgba(0,0,0,0.08)] border border-hairline animate-[fadeUp_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-violet-500/10">
                    <i className="ri-send-plane-line text-[15px] text-[#8B5CF6]" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#1A1A1A] dark:text-ink font-satoshi">Send to Manufacturer</h3>
                </div>
                <button onClick={() => setShowManufacturerSelect(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F3F4F6] dark:hover:bg-surface-150 transition-colors cursor-pointer">
                  <i className="ri-close-line text-[18px] text-[#9CA3AF] dark:text-[#D1D5DB]" />
                </button>
              </div>
            </div>

            <div className="px-6 pb-3 flex-shrink-0">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <i className="ri-search-line text-[14px] text-[#BDBDBD] dark:text-ink-600" />
                </span>
                <input
                  type="text"
                  value={mfgSearch}
                  onChange={(e) => setMfgSearch(e.target.value.trimStart())}
                  onBlur={() => setMfgSearch(mfgSearch.trim())}
                  placeholder="Search by name, specialty, or location..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-[12px] text-[13px] text-[#1A1A1A] dark:text-ink placeholder:text-sm placeholder:text-[#C4C4C4] dark:placeholder:text-ink-700 outline-none bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.06] dark:border-border-default font-inter"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6" onScroll={handleScroll}>
              {((listStatus === 'loading' || listStatus === 'idle') && (!apiManufacturersList || apiManufacturersList.length === 0)) ? (
                <div className="flex flex-col gap-2.5 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-[14px] p-4 bg-[#FAFAF8] dark:bg-surface-150 border border-transparent">
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-surface-200 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-1/3 bg-gray-200 dark:bg-surface-200 rounded" />
                          <div className="h-3 w-1/2 bg-gray-200 dark:bg-surface-200 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2.5">
                    {filteredManufacturers.length === 0 && (
                      <div className="py-8 text-center">
                        <p className="text-[13px] text-[#9CA3AF] dark:text-ink-600">No manufacturers found</p>
                      </div>
                    )}
                    {filteredManufacturers.map((mfg) => {
                      const isSelected = selectedManufacturerIds.includes(mfg.id);
                      const badge = statusBadgeMap[mfg.status] ?? statusBadgeMap['Available'];
                      const hasMultipleEmails = (mfg.emails?.length ?? 0) > 1;
                      const selectedEmails = selectedEmailMap?.[mfg.id] || [];
                      return (
                        <div key={mfg.id} className="flex flex-col">
                          <button
                            onClick={() => toggleManufacturer(mfg)}
                            className={`w-full text-left rounded-[14px] p-4 transition-all cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30' : 'bg-[#FAFAF8] dark:bg-surface-150 border border-transparent dark:border-border-default hover:border-black/[0.06] dark:hover:hover:border-border-default'}`}
                          >
                            <div className="flex items-start gap-3.5">
                              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 ${getAvatarBgClass(mfg.avatarColor)}`}>
                                {mfg.initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <p className="text-[13.5px] font-semibold text-[#1A1A1A] dark:text-ink">{mfg.name}</p>
                                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${badge.bgClass} ${badge.textClass}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                                    {mfg.status}
                                  </div>
                                </div>
                                <p className="text-[11.5px] text-[#9CA3AF] dark:text-[#D1D5DB] mb-1.5">{mfg.specialty} · {mfg.location}</p>
                                <div className="flex items-center gap-3 text-[11px] text-[#9CA3AF] dark:text-ink-600 font-inter">
                                  <span className="flex items-center gap-1"><i className="ri-time-line text-[11px]" />{mfg.avgResponseTime}</span>
                                  <span className="flex items-center gap-1"><i className="ri-briefcase-line text-[11px]" />{mfg.totalRequests} requests</span>
                                </div>
                              </div>
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isSelected ? 'border-[#8B5CF6] bg-[#8B5CF6]' : 'border-[#D1D5DB] dark:border-border-default'}`}>
                                {isSelected && <i className="ri-check-line text-[12px] text-white" />}
                              </div>
                            </div>
                          </button>

                          {isSelected && hasMultipleEmails && (
                            <div className="ml-[54px] mt-1.5 mb-1 flex flex-col gap-1.5 font-inter">
                              {mfg.emails && mfg.emails.map((em) => {
                                const emailSelected = selectedEmails.includes(em.value);
                                return (
                                  <label
                                    key={em.value}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] cursor-pointer select-none transition-colors ${emailSelected ? 'bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/10 dark:border-violet-500/30' : 'bg-transparent border border-transparent'}`}
                                    onClick={(e) => { e.stopPropagation(); toggleManufacturerEmail(mfg.id, em.value); }}
                                  >
                                    <div className={`w-[16px] h-[16px] rounded-[5px] flex items-center justify-center flex-shrink-0 transition-colors ${emailSelected ? 'bg-[#8B5CF6]' : 'bg-white dark:bg-surface-150 border border-[#D1D5DB] dark:border-border-default'}`}>
                                      {emailSelected && <i className="ri-check-line text-[11px] text-white" />}
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {em.label && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 bg-slate-500/10 text-slate-500">
                                          {em.label}
                                        </span>
                                      )}
                                      <span className="text-[12px] text-[#374151] dark:text-ink truncate">{em.value}</span>
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

                  {listStatus === 'loading' && apiManufacturersList && apiManufacturersList.length > 0 && (
                    <div className="flex flex-col gap-2.5 animate-pulse mt-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="rounded-[14px] p-4 bg-[#FAFAF8] dark:bg-surface-150 border border-transparent opacity-60">
                          <div className="flex items-start gap-3.5">
                            <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-surface-200 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3.5 w-1/3 bg-gray-200 dark:bg-surface-200 rounded" />
                              <div className="h-3 w-1/2 bg-gray-200 dark:bg-surface-200 rounded" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddMfgForm((v) => !v); setAddMfgError(false); }}
                  className="flex items-center gap-1.5 w-full justify-center py-2.5 rounded-[10px] text-[12.5px] font-medium text-[#8B5CF6] dark:text-violet-accent hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors cursor-pointer border border-dashed border-purple-200 dark:border-purple-500/30"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className={`${showAddMfgForm ? 'ri-subtract-line' : 'ri-add-line'} text-[14px]`} />
                  </span>
                  {showAddMfgForm ? 'Cancel' : 'Add New Manufacturer'}
                </button>

                {showAddMfgForm && (
                  <div className="mt-3 rounded-[14px] p-4 flex flex-col gap-3 bg-[#F7F6F3] dark:bg-surface-150 border border-violet-500/10 dark:border-purple-500/20">
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wide mb-1 block">
                          Manufacturer Name <span className="text-[#EF4444]">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ArtisanGold Co."
                          value={newMfgForm.name}
                          onChange={(e) => {
                            setNewMfgForm({ ...newMfgForm, name: e.target.value });
                            setAddMfgErrors((prev) => ({ ...prev, name: '' }));
                          }}
                          className={`w-full px-3 py-2.5 rounded-[10px] text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border ${addMfgErrors.name ? 'border-danger-bright shadow-glow-danger-ring border-1.5' : 'border-black/[0.06] dark:border-border-default'} placeholder:text-[#C4C4C4] dark:placeholder:text-ink-700 max-sm:placeholder:text-[12px]`}
                        />
                        {addMfgErrors.name && (
                          <p className="text-[12px] text-danger mt-1">{addMfgErrors.name}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wide mb-1.5 block">Specialty</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowMfgSpecialtyDropdown((prev) => !prev)}
                            className="w-full px-3 py-2.5 rounded-[10px] text-[13px] text-[#1A1A1A] dark:text-ink outline-none border border-black/[0.06] dark:border-border-default flex items-center justify-between cursor-pointer bg-white dark:bg-surface-200 font-inter">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${selectedMfgSpecialty.bg} ${selectedMfgSpecialty.color}`}>
                              {selectedMfgSpecialty.label}
                            </span>
                            <i className={`ri-arrow-down-s-line text-[14px] text-[#9CA3AF] transition-transform ${showMfgSpecialtyDropdown ? 'rotate-180' : ''}`} />
                          </button>
                          {showMfgSpecialtyDropdown && (
                            <div className="absolute left-0 right-0 top-full mt-1 rounded-[12px] p-1.5 z-[1002] bg-white dark:bg-surface-150 shadow-[0px_8px_32px_rgba(0,0,0,0.12),_0px_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.06] dark:border-border-default max-h-[160px] overflow-y-auto">
                              {SPECIALTIES.map((spec) => (
                                <button
                                  type="button"
                                  key={spec.label}
                                  onClick={() => { setSelectedMfgSpecialty(spec); setShowMfgSpecialtyDropdown(false); }}
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
                            onClick={() => setNewMfgForm({ ...newMfgForm, emails: [...newMfgForm.emails, { label: 'Work', value: '' }] })}
                            className="text-[11px] font-semibold text-[#8B5CF6] dark:text-violet-accent hover:underline flex items-center gap-1 cursor-pointer select-none"
                          >
                            + Add another email
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          {newMfgForm.emails.map((em, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Label"
                                value={em.label}
                                onChange={(e) => {
                                  const newEmails = [...newMfgForm.emails];
                                  newEmails[idx].label = e.target.value;
                                  setNewMfgForm({ ...newMfgForm, emails: newEmails });
                                }}
                                className="w-[80px] px-3 py-2.5 rounded-[10px] text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border border-black/[0.06] dark:border-border-default font-inter placeholder:text-[#C4C4C4] dark:placeholder:text-ink-700 max-sm:placeholder:text-[12px]"
                              />
                              <input
                                type="email"
                                placeholder="Email address"
                                value={em.value}
                                onChange={(e) => {
                                  const newEmails = [...newMfgForm.emails];
                                  newEmails[idx].value = e.target.value;
                                  setNewMfgForm({ ...newMfgForm, emails: newEmails });
                                  setAddMfgErrors((prev) => ({ ...prev, email: '' }));
                                }}
                                className={`flex-1 min-w-0 px-3 py-2.5 rounded-[10px] text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border ${addMfgErrors.email ? 'border-danger-bright shadow-glow-danger-ring border-1.5' : 'border-black/[0.06] dark:border-border-default'} font-inter placeholder:text-[#C4C4C4] dark:placeholder:text-ink-700 max-sm:placeholder:text-[12px]`}
                              />
                              {newMfgForm.emails.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newEmails = newMfgForm.emails.filter((_, i) => i !== idx);
                                    setNewMfgForm({ ...newMfgForm, emails: newEmails });
                                  }}
                                  className="w-9 h-9 flex items-center justify-center rounded-full bg-black/5 text-red-500 hover:bg-black/10 flex-shrink-0 cursor-pointer"
                                >
                                  <i className="ri-close-line text-[16px]" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {addMfgErrors.email && (
                          <p className="text-[12px] text-danger mt-1">{addMfgErrors.email}</p>
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
                              const sanitized = sanitizePhoneDigits(newMfgForm.phone, maxLen);
                              setNewMfgForm({ ...newMfgForm, phone: sanitized });
                              if (sanitized && sanitized.length !== maxLen) {
                                setAddMfgErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(code) }));
                              } else {
                                setAddMfgErrors((prev) => ({ ...prev, phone: '' }));
                              }
                            }}
                            className="!bg-white dark:!bg-surface-200 !border-black/[0.06] dark:!border-border-default rounded-[10px] text-[13px] text-[#1A1A1A] dark:text-ink outline-none !px-3 !py-2.5 !h-[42px]"
                          />
                          <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="Phone Number"
                            value={newMfgForm.phone}
                            maxLength={getPhoneMaxLength(phoneCountryCode)}
                            onChange={(e) => {
                              const maxLen = getPhoneMaxLength(phoneCountryCode);
                              const sanitized = sanitizePhoneDigits(e.target.value, maxLen);
                              setNewMfgForm({ ...newMfgForm, phone: sanitized });
                              if (sanitized && sanitized.length !== maxLen) {
                                setAddMfgErrors((prev) => ({ ...prev, phone: getPhoneLengthMessage(phoneCountryCode) }));
                              } else {
                                setAddMfgErrors((prev) => ({ ...prev, phone: '' }));
                              }
                            }}
                            className={`flex-1 px-3 py-2.5 rounded-[10px] text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border font-inter min-w-0 ${addMfgErrors.phone ? 'border-danger-bright shadow-glow-danger-ring border-1.5' : 'border-black/[0.06] dark:border-border-default'} placeholder:text-[#C4C4C4] dark:placeholder:text-ink-700 max-sm:placeholder:text-[12px]`}
                          />
                        </div>
                        {addMfgErrors.phone && (
                          <p className="text-[12px] text-danger mt-1">{addMfgErrors.phone}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-[#9CA3AF] dark:text-ink-600 uppercase tracking-wide mb-1 block">
                          Location <span className="lowercase font-normal text-[#9CA3AF]">(optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Milan, Italy"
                          value={newMfgForm.location}
                          onChange={(e) => setNewMfgForm({ ...newMfgForm, location: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-[10px] text-[13px] text-[#1A1A1A] dark:text-ink outline-none bg-white dark:bg-surface-200 border border-black/[0.06] dark:border-border-default font-inter placeholder:text-[#C4C4C4] dark:placeholder:text-ink-700 max-sm:placeholder:text-[12px]"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAndSelect}
                      disabled={createStatus === 'loading'}
                      className="w-full py-3 rounded-[12px] text-[13px] font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity bg-[linear-gradient(135deg,#8B5CF6_0%,#6366F1_100%)] shadow-[0_4px_16px_rgba(139,92,246,0.28)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-inter"
                    >
                      {createStatus === 'loading' ? (
                        <>
                          <i className="ri-loader-4-line animate-spin text-[14px]" />
                          <span>Adding...</span>
                        </>
                      ) : (
                        <span>Add & Select Manufacturer</span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* <div className="mt-4">
                <label className="block text-[12px] font-semibold text-[#6B7280] dark:text-[#D1D5DB] mb-1.5">
                  Note <span className="text-[#C4C4C4] dark:text-ink-700 font-normal">(optional)</span>
                </label>
                <textarea
                  value={sendNote}
                  onChange={(e) => setSendNote(e.target.value)}
                  placeholder="Add production instructions..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-[12px] text-[13px] text-[#1A1A1A] dark:text-ink placeholder:text-[#C4C4C4] dark:placeholder:text-ink-700 outline-none resize-none bg-[#F7F6F3] dark:bg-surface-150 border border-black/[0.06] dark:border-border-default font-inter max-sm:placeholder:text-[12px]"
                />
              </div> */}
            </div>

            <div className="px-6 py-4 flex-shrink-0 flex items-center justify-between border-t border-black/[0.05] dark:border-border-default">
              <span className="text-[12.5px] text-[#9CA3AF] dark:text-[#D1D5DB]">
                {selectedManufacturerIds.length} manufacturer{selectedManufacturerIds.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowManufacturerSelect(false)} className="px-4 py-2.5 rounded-[10px] text-[13px] font-medium text-[#6B7280] dark:text-[#D1D5DB] hover:bg-[#F3F4F6] dark:hover:bg-surface-150 transition-colors cursor-pointer whitespace-nowrap">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleModalSend}
                  disabled={isSending || selectedManufacturerIds.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed bg-violet-500 dark:text-black"
                >
                  {isSending ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-[13px]" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-send-plane-line text-[13px]" />
                      </span>
                      <span>Send Design</span>
                    </>
                  )}
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
      )}
    </>
  );
}
