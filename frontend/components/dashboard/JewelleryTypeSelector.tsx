'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { typeIcons, typeDarkIcons } from './iconsData';

const mainTypes = [
  { label: 'Pendant' },
  { label: 'Ring' },
  { label: 'Bracelet' },
  { label: 'Necklace' },
  { label: 'Earring' },
];

const moreTypes = [
  { label: 'Body Jewelry', icon: '' },
  { label: 'Brooch', icon: '' },
  { label: 'Grillz', icon: '' },
  { label: 'Watch', icon: '' },
  { label: 'Bail', icon: '' },
  { label: 'Clasp', icon: '' },
  { label: 'Buckle', icon: '' },
  { label: 'Cufflink', icon: '' },
];

interface JewelleryTypeSelectorProps {
  value: string;
  onChange: (type: string) => void;
  shakeTrigger?: number;
  hasError?: boolean;
}

const shake = {
  rotate: [0, -10, 8, -6, 4, -2, 0],
  x: [0, -4, 4, -3, 2, -1, 0],
};

const shakeTransition = { type: 'tween', duration: 0.5, ease: 'easeInOut' } as const;

interface TypeCardProps {
  item: { label: string };
  index: number;
  isActive: boolean;
  onChange: (type: string) => void;
  shakeTrigger?: number;
  hasError?: boolean;
}

function TypeCard({
  item,
  index,
  isActive,
  onChange,
  shakeTrigger,
  hasError,
}: TypeCardProps) {
  const controls = useAnimationControls();

  useEffect(() => {
    if (shakeTrigger && shakeTrigger > 0) {
      controls.start(shake, shakeTransition);
    }
  }, [shakeTrigger, controls]);

  return (
    <motion.button
      type="button"
      onClick={() => onChange(isActive ? '' : item.label)}
      // onMouseEnter={() => controls.start(shake, shakeTransition)}
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.04, y: -2 }}
      className={`group w-full md:flex-1 md:flex-shrink-0 md:min-w-max flex items-center justify-start sm:justify-center gap-2.5 py-3.5 px-4 sm:px-3.5 rounded-xl border transition-colors duration-200 cursor-pointer shadow-sm shadow-[#E3E3E3] dark:shadow-none ${isActive
        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 text-blue-600 dark:text-blue-400 shadow-[0_2px_8px_rgba(59,130,246,0.08)] dark:shadow-none'
        : hasError
          ? 'bg-red-50/10 dark:bg-red-950/5 border-red-300 dark:border-red-900/50 text-gray-500 dark:text-gray-300 hover:border-red-400 shadow-sm dark:shadow-none'
          : 'bg-white dark:bg-surface-100 border-[#ECEEF2] dark:border-border-default text-gray-500 dark:text-gray-300 hover:border-[#D1D5DB] dark:hover:border-gray-500 shadow-sm dark:shadow-none'
        }`}
    >
      <motion.span
        animate={controls}
        transition={shakeTransition}
        className={`md:w-12 md:h-12 h-10 w-10 rounded-full border flex items-center justify-center transition-colors duration-200 ${isActive
          ? 'bg-blue-100/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 '
          : 'bg-[#F8F9FB] dark:bg-surface-150 text-[#94A3B8] dark:text-[#A1A8B3] group-hover:bg-gray-100/50 dark:group-hover:bg-surface-200'
          }`}
      >
        <div
          className={`w-full h-full flex items-center justify-center ${(index === 0) ? 'scale-[105%]' : (index === 3) ? 'scale-[110%]' : 'scale-[125%]'} [&>svg]:w-full [&>svg]:h-full dark:hidden `}
        >
          {typeIcons[item.label]}
        </div>
        <div
          className={`w-full h-full flex items-center justify-center ${(index === 0 || index === 3) ? 'scale-[110%]' : 'scale-[125%]'} [&>svg]:w-full [&>svg]:h-full hidden dark:flex`}
        >
          {typeDarkIcons[item.label] || typeIcons[item.label]}
        </div>
      </motion.span>
      <span className="text-[13px] font-medium leading-none font-inter whitespace-nowrap dark:text-[#A1A8B3]">
        {item.label}
      </span>
    </motion.button>
  );
}

export default function JewelleryTypeSelector({
  value,
  onChange,
  shakeTrigger,
  hasError,
}: JewelleryTypeSelectorProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 640px)');
    setIsDesktop(media.matches);
    const listener = () => setIsDesktop(media.matches);
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      media.addListener(listener);
      return () => media.removeListener(listener);
    }
  }, []);

  useEffect(() => {
    if (shakeTrigger && shakeTrigger > 0) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [shakeTrigger]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [moreOpen]);

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const words = val.trim().split(/\s+/);
    if (words.length > 2 && val.endsWith(' ')) return;
    setCustomInput(val);
  };

  const handleCustomSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customInput.trim()) {
      onChange(customInput.trim());
      setMoreOpen(false);
      setCustomInput('');
    }
  };

  const selectedExtra =
    value && !mainTypes.some((t) => t.label === value)
      ? (moreTypes.find((t) => t.label === value) ?? { label: value, icon: 'ri-apps-line' })
      : null;
  const selectedExtraNeedsCompactScale = selectedExtra?.label === 'Clasp' || selectedExtra?.label === 'Watch' || selectedExtra?.label === 'Bail';

  return (
    <div className="mb-6 pt-2 relative" ref={dropdownRef}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
      <p className="text-[14px] sm:text-sm font-bold text-[#6B7280] dark:text-[#D1D5DB] uppercase tracking-wider  font-inter">
        SELECT JEWELRY TYPE <span className="text-red-500 font-semibold">*</span>
      </p>
      <div
        className={`grid grid-cols-2 gap-3 md:flex md:flex-nowrap md:items-center md:gap-3 md:overflow-x-auto w-full md:pb-2 md:scrollbar-none  pt-2 px-2 -mx-2 ${isShaking ? 'animate-shake' : ''}`}
      >
        {mainTypes.map((item, index) => {
          const isActive = value === item.label;
          return (
            <TypeCard
              key={item.label}
              item={item}
              index={index}
              isActive={isActive}
              onChange={onChange}
              shakeTrigger={shakeTrigger}
              hasError={hasError}
            />
          );
        })}

        {selectedExtra && (
          <motion.button
            type="button"
            onClick={() => onChange('')}
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.04, y: -2 }}
            className="group w-full md:flex-1 md:flex-shrink-0 md:min-w-max flex items-center justify-start sm:justify-center gap-2.5 py-3.5 px-4 sm:px-3.5 rounded-xl border transition-colors duration-200 cursor-pointer bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 text-blue-600 dark:text-blue-400 shadow-[0_2px_8px_rgba(59,130,246,0.08)] dark:shadow-none"
          >
            <span className="md:w-12 md:h-12 h-10 w-10 rounded-full border flex items-center justify-center bg-blue-100/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              {typeIcons[selectedExtra.label] ? (
                <>
                  <div className={`w-full h-full flex items-center justify-center overflow-visible origin-center [&>svg]:w-full [&>svg]:h-full dark:hidden ${selectedExtraNeedsCompactScale ? 'scale-[1.1]' : 'scale-[1.25]'
                    }`}>
                    {typeIcons[selectedExtra.label]}
                  </div>
                  <div
                    className={`w-full h-full flex items-center justify-center overflow-visible origin-center [&>svg]:w-full [&>svg]:h-full hidden dark:flex ${selectedExtraNeedsCompactScale ? 'scale-[1.1]' : 'scale-[1.25]'
                      }`}
                  >
                    {typeDarkIcons[selectedExtra.label] || typeIcons[selectedExtra.label]}
                  </div>
                </>
              ) : (
                <i
                  className={`${selectedExtra.icon || 'ri-apps-line'} text-[18px] sm:text-[20px]`}
                />
              )}
            </span>
            <span className="text-[13px] font-medium leading-none font-inter whitespace-nowrap dark:text-[#A1A8B3]">
              {selectedExtra.label}
            </span>
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.04, y: -2 }}
          className={`group w-full md:flex-1 md:flex-shrink-0 md:min-w-max flex items-center justify-start sm:justify-center gap-2.5 py-3.5 px-4 sm:px-3.5 rounded-xl border border-dashed transition-colors duration-200 cursor-pointer dark:shadow-none ${moreOpen
            ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 text-blue-600 dark:text-blue-400 shadow-[0_2px_8px_rgba(59,130,246,0.08)] dark:shadow-none'
            : hasError
              ? 'bg-red-50/10 dark:bg-red-950/5 border-red-300 dark:border-red-900/50 text-red-500 dark:text-red-400 hover:bg-red-50/20 shadow-sm'
              : 'bg-white dark:bg-surface-100 border-[#3B82F6] dark:border-blue-500/50 text-blue-500 dark:text-blue-400 hover:bg-blue-50/20 shadow-sm'
            }`}
        >
          <span
            className={`md:w-12 md:h-12 h-10 w-10 rounded-full border flex items-center justify-center transition-colors duration-200 ${moreOpen
              ? 'border-blue-200 dark:border-blue-500/30 bg-blue-100/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
              : 'border-blue-200 dark:border-blue-500/30 text-blue-500 dark:text-blue-400 bg-blue-50/50 dark:bg-surface-150 group-hover:bg-blue-50 dark:group-hover:bg-surface-200'
              }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          <span className="text-[13px] font-medium leading-none font-inter whitespace-nowrap dark:text-[#A1A8B3]">
            More
          </span>
        </motion.button>
      </div>

      {moreOpen && (
        <>
          {/* Desktop / tablet: absolute popup */}
          {isDesktop && (
            <div className="hidden sm:block absolute top-full right-0 mt-2 z-50 rounded-[14px] p-5 bg-white dark:bg-surface-100 shadow-[0px_12px_40px_rgba(0,0,0,0.10),_0px_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-[#F0F0F0] dark:border-border-default sm:min-w-[480px] min-w-[300px]">
              <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#D1D5DB] uppercase tracking-[0.15em] mb-3.5 font-inter">
                Popular Types
              </p>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {moreTypes.map((item) => {
                  const isActive = value === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        onChange(item.label);
                        setMoreOpen(false);
                      }}
                      className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-[10px] transition-all duration-150 cursor-pointer ${isActive
                        ? 'bg-blue-500/10 dark:bg-blue-500/20 border-[1.5px] border-blue-500/40'
                        : 'bg-[#F8F9FB] dark:bg-surface-150 border-[1.5px] border-transparent dark:border-border-default'
                        }`}
                    >
                      <span
                        className={`w-8 h-8 flex items-center justify-center rounded-[8px] text-[16px] ${isActive
                          ? 'bg-blue-500/10 dark:bg-blue-500/30 text-blue-500 dark:text-blue-400'
                          : ' dark:bg-surface-150 text-[#94A3B8] dark:text-[#A1A8B3]'
                          }`}
                      >
                        {typeIcons[item.label] ? (
                          <>
                            <div className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full dark:hidden">
                              {typeIcons[item.label]}
                            </div>
                            <div className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full hidden dark:flex">
                              {typeDarkIcons[item.label] || typeIcons[item.label]}
                            </div>
                          </>
                        ) : (
                          <i className={`${item.icon || 'ri-apps-line'} text-[16px]`} />
                        )}
                      </span>
                      <span
                        className={`text-[10.5px] font-medium leading-none whitespace-nowrap font-inter ${isActive
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-[#6B7280] dark:text-[#A1A8B3]'
                          }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border-default pt-3">
                <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#D1D5DB] uppercase tracking-[0.15em] mb-2 font-inter">
                  Custom Object
                </p>
                <input
                  type="text"
                  value={customInput}
                  onChange={handleCustomInput}
                  onKeyDown={handleCustomSubmit}
                  placeholder="Add custom type"
                  className="w-full px-3 py-2 rounded-[10px] text-[12px] text-[#374151] dark:text-ink placeholder:text-[#BDBDBD] dark:placeholder:text-ink-400 outline-none border border-border-default focus:border-[#3B82F6] transition-colors bg-[#F8F9FB] dark:bg-surface-150 font-inter"
                />
              </div>
            </div>
          )}

          {/* Mobile: inline full-width panel to avoid overlap */}
          {!isDesktop && (
            <div className="sm:hidden mt-3 p-4 z-40 rounded-[12px] bg-white dark:bg-surface-100 shadow-lg border border-[#F0F0F0] dark:border-border-default">
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#D1D5DB] uppercase tracking-[0.15em] font-inter">
                  Popular Types
                </p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                {moreTypes.map((item) => {
                  const isActive = value === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        onChange(item.label);
                        setMoreOpen(false);
                      }}
                      className={`flex flex-col items-center gap-1 py-2 px-2 rounded-[10px] transition-all duration-150 cursor-pointer ${isActive
                        ? 'border-[1.5px] border-blue-500/40 bg-[#F8F9FB] dark:bg-surface-150'
                        : 'bg-[#F8F9FB] dark:bg-surface-150 border-[1.5px] border-transparent dark:border-border-default'
                        }`}
                    >
                      <span
                        className={`w-8 h-8 flex items-center justify-center rounded-[8px] text-[16px] ${isActive
                          ? 'bg-blue-500/10 dark:bg-blue-500/30 text-blue-500 dark:text-blue-400'
                          : 'bg-[#F8F9FB] dark:bg-surface-150 text-[#94A3B8] dark:text-[#A1A8B3]'  // ← added bg
                          }`}
                      >
                        {typeIcons[item.label] ? (
                          <>
                            <div className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full dark:hidden">  {/* ← removed text-[10px] */}
                              {typeIcons[item.label]}
                            </div>
                            <div className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full hidden dark:flex">
                              {typeDarkIcons[item.label] || typeIcons[item.label]}
                            </div>
                          </>
                        ) : (
                          <i className={`${item.icon || 'ri-apps-line'} text-[16px]`} />
                        )}
                      </span>
                      <span
                        className={`text-[10px] font-medium leading-none whitespace-nowrap font-inter ${isActive
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-[#6B7280] dark:text-ink-300'
                          }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-[#F0F0F0] dark:border-border-default pt-3">
                <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#D1D5DB] uppercase tracking-[0.15em] mb-2 font-inter">
                  Custom Object
                </p>
                <input
                  type="text"
                  value={customInput}
                  onChange={handleCustomInput}
                  onKeyDown={handleCustomSubmit}
                  placeholder="Add custom type"
                  className="w-full px-3 py-2 rounded-[10px] text-[12px] text-[#374151] dark:text-ink placeholder:text-[#BDBDBD] dark:placeholder:text-ink-400 outline-none border border-[#E5E7EB] dark:border-border-default focus:border-[#3B82F6] transition-colors bg-[#F8F9FB] dark:bg-surface-150 font-inter"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
