'use client';

import React, { useRef, useEffect, useState } from 'react';
import IntlTelInput, { intlTelInput, IntlTelInputRef } from '@intl-tel-input/react/with-utils';
import 'intl-tel-input/styles';

interface CountryCodeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  preferredPlacement?: 'top' | 'bottom';
  theme?: string;
}

// Lazily-initialized OPTIONS for BrandCard/ProfileCard phone parsing.
// Uses Proxy so [...OPTIONS], .sort(), .find() etc all work at runtime,
// while intlTelInput.getAllCountries() is only called when first accessed.
function buildOptions(): { value: string; label: string; flag: string }[] {
  try {
    const countries = intlTelInput.getAllCountries();
    return countries.map((c: any) => ({
      value: `+${c.dialCode}`,
      label: `+${c.dialCode} (${c.iso2.toUpperCase()})`,
      flag: `+${c.dialCode}`,
    }));
  } catch {
    return [
      { value: '+1', label: '+1 (US/CA)', flag: '+1' },
      { value: '+91', label: '+91 (IN)', flag: '+91' },
      { value: '+44', label: '+44 (UK)', flag: '+44' },
      { value: '+61', label: '+61 (AU)', flag: '+61' },
      { value: '+86', label: '+86 (CN)', flag: '+86' },
      { value: '+81', label: '+81 (JP)', flag: '+81' },
      { value: '+49', label: '+49 (DE)', flag: '+49' },
      { value: '+33', label: '+33 (FR)', flag: '+33' },
      { value: '+971', label: '+971 (AE)', flag: '+971' },
      { value: '+65', label: '+65 (SG)', flag: '+65' },
      { value: '+64', label: '+64 (NZ)', flag: '+64' },
      { value: '+39', label: '+39 (IT)', flag: '+39' },
      { value: '+34', label: '+34 (ES)', flag: '+34' },
      { value: '+31', label: '+31 (NL)', flag: '+31' },
      { value: '+41', label: '+41 (CH)', flag: '+41' },
      { value: '+32', label: '+32 (BE)', flag: '+32' },
      { value: '+46', label: '+46 (SE)', flag: '+46' },
      { value: '+55', label: '+55 (BR)', flag: '+55' },
      { value: '+27', label: '+27 (ZA)', flag: '+27' },
      { value: '+52', label: '+52 (MX)', flag: '+52' },
    ];
  }
}

let _optionsCache: ReturnType<typeof buildOptions> | null = null;

function getOptions() {
  if (!_optionsCache) _optionsCache = buildOptions();
  return _optionsCache;
}

export const OPTIONS: { value: string; label: string; flag: string }[] = new Proxy(
  {} as { value: string; label: string; flag: string }[],
  {
    get(_target, prop) {
      const opts = getOptions();
      if (prop === 'length') return opts.length;
      if (prop === Symbol.iterator) return opts[Symbol.iterator].bind(opts);
      if (prop === 'filter') return opts.filter.bind(opts);
      if (prop === 'map') return opts.map.bind(opts);
      if (prop === 'find') return opts.find.bind(opts);
      if (prop === 'sort') return opts.sort.bind(opts);
      if (prop === 'slice') return opts.slice.bind(opts);
      if (prop === 'includes') return opts.includes.bind(opts);
      if (typeof prop === 'string') return (opts as any)[prop];
      return (opts as any)[prop];
    },
  },
);

const CountryCodeSelect: React.FC<CountryCodeSelectProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const itiRef = useRef<IntlTelInputRef>(null);
  const [bodyEl, setBodyEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBodyEl(document.body);
    }
  }, []);

  // Define preferred country codes for shared dial codes to avoid incorrect flag mapping (e.g. +1 defaults to US)
  const preferredMapping: Record<string, string> = {
    '1': 'us',
    '7': 'ru',
    '44': 'gb',
  };

  // Extract dial code without '+' to look up country
  const cleanDialCode = value.replace('+', '');
  const countries = intlTelInput.getAllCountries();

  const matchedCountry = preferredMapping[cleanDialCode]
    ? countries.find((c) => c.dialCode === cleanDialCode && c.iso2 === preferredMapping[cleanDialCode])
    : countries.find((c) => c.dialCode === cleanDialCode);

  const initialCountryCode = matchedCountry ? matchedCountry.iso2 : 'us';

  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(initialCountryCode);

  // Sync country selection if value prop changes
  useEffect(() => {
    if (value) {
      const dial = value.replace('+', '');
      const list = intlTelInput.getAllCountries();
      const currentSelected = list.find((c) => c.iso2 === selectedCountryCode);
      if (currentSelected && currentSelected.dialCode === dial) {
        return;
      }

      const targetIso2 = preferredMapping[dial];
      const found = targetIso2
        ? list.find((c) => c.dialCode === dial && c.iso2 === targetIso2)
        : list.find((c) => c.dialCode === dial);
      if (found) {
        setSelectedCountryCode(found.iso2);
        itiRef.current?.getInstance()?.setSelectedCountry(found.iso2);
      }
    }
  }, [value, selectedCountryCode]);

  return (
    <div className="relative inline-block text-left">
      {/* Styles to inject dark mode overrides and fix z-index for the dropdown appended to body */}
      <style>{`
        .iti--detached-country-selector {
          z-index: 999999 !important;
        }
        .dark .iti__country-selector {
          --iti-hover-color: rgba(255, 255, 255, 0.08) !important;
          --iti-border-color: #2e3a52 !important;
          --iti-country-selector-bg: #1e2535 !important;
          --iti-icon-color: #e4e9f0 !important;
          background-color: #1e2535 !important;
          border: 1px solid #2e3a52 !important;
          color: #e4e9f0 !important;
        }
        .dark .iti__search-input {
          background-color: #1e2535 !important;
          color: #e4e9f0 !important;
          border-bottom: 1px solid #2e3a52 !important;
        }
        .dark .iti__country {
          color: #e4e9f0 !important;
        }
        .dark .iti__country-name {
          color: #e4e9f0 !important;
        }
        .dark .iti__dial-code {
          color: #a0aec0 !important;
        }
        .dark .iti__no-results {
          color: #a0aec0 !important;
        }
      `}</style>

      <button
        type="button"
        onClick={() => {
          itiRef.current?.getInstance()?.openCountrySelector();
        }}
        className={`flex h-9 xl:h-10 items-center justify-between gap-2 rounded-[10px] border border-[#D5D5D5] bg-[#F0F2F4] px-3 text-[13px] text-[#1E1E1E] transition-all focus:outline-none focus:border-[#3676E0] dark:border-[#2E3A52] dark:bg-[#1E2535] dark:text-[#E4E9F0] dark:focus:border-[#5B9BFF] ${className}`}
      >
        <span className="flex items-center gap-2">
          {/* Display standard CSS flags to render correctly across all operating systems, including Windows */}
          <span className={`iti__flag iti__${selectedCountryCode} shrink-0`}></span>
          <span>{value}</span>
        </span>

        <svg
          className="h-4 w-4 text-[#8A8A8A] dark:text-[#5A6A7E] transition-transform duration-200"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Hidden/invisible IntlTelInput to manage the actual dropdown */}
      {bodyEl && (
        <div className="absolute inset-0 pointer-events-none opacity-0" style={{ zIndex: -1 }}>
          <IntlTelInput
            ref={itiRef}
            onChangeCountry={(iso2) => {
              const list = intlTelInput.getAllCountries();
              const found = list.find((c) => c.iso2 === iso2);
              if (found) {
                setSelectedCountryCode(iso2);
                onChange(`+${found.dialCode}`);
              }
            }}
            initialCountry={initialCountryCode}
            separateDialCode={true}
            dropdownParent={bodyEl}
          />
        </div>
      )}
    </div>
  );
};

export default CountryCodeSelect;