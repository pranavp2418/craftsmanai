'use client';

import { useAppearance } from '@/lib/appearance-context';
import type { Theme } from '@/lib/appearance-context';
import { toast } from 'react-toastify';

const THEMES: { id: Theme; label: string; desc: string; icon: string }[] = [
  { id: 'light', label: 'Light', desc: 'Always use light mode', icon: 'ri-sun-line' },
  { id: 'dark', label: 'Dark', desc: 'Always use dark mode', icon: 'ri-moon-line' },
  { id: 'system', label: 'System', desc: 'Follow your device settings', icon: 'ri-computer-line' },
];

export default function AppearanceCard() {
  const { theme, setTheme } = useAppearance();


  const handleTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    toast.success(`Theme set to ${nextTheme === 'system' ? 'System' : nextTheme === 'dark' ? 'Dark' : 'Light'}`);
  };

  const sectionCN = 'bg-section border border-sand';

  return (
    <div className="rounded-sheet p-5 sm:p-8 shadow-glow-indigo-soft bg-glass-72 backdrop-blur-xl border border-glass-strong">
      <div className="mb-8">
        <h2 className="text-heading font-bold text-ink-900 font-satoshi dark:text-[#E7EAEE]">Appearance</h2>
        <p className="text-body-sm text-ink-400 mt-1">Customize how the app looks and feels.</p>
      </div>

      <div className="flex flex-col gap-5">
        <div className={`rounded-2xl p-6 ${sectionCN}`}>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-4 h-4 flex items-center justify-center ri-palette-line text-ui text-indigo-accent" />
            <p className="text-body font-semibold text-ink-900 font-satoshi">Theme</p>
          </div>
          <p className="text-label text-ink-400 mb-5 ml-6">Choose how the interface appears.</p>

          <div className="grid md:grid-cols-3 gap-3">
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => handleTheme(t.id)}
                  className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200 text-left disabled:cursor-not-allowed disabled:opacity-70 ${
                    isActive
                      ? 'bg-tint-indigo-soft border-2 border-tint-indigo-strong shadow-glow-indigo-tag'
                      : 'bg-glass-80 border-2 border-sand-soft'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center bg-gradient-indigo">
                      <span className="ri-check-line text-white  text-label-xs" />
                    </div>
                  )}
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      isActive ? 'bg-gradient-indigo-tint-strong' : 'bg-muted-bg'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 flex items-center justify-center ${t.icon} text-heading transition-colors duration-200 ${
                        isActive ? 'text-indigo-accent' : 'text-ink-400'
                      }`}
                    />
                  </div>
                  <div className="text-center">
                    <p
                      className={`text-body-sm font-semibold transition-colors duration-200 font-satoshi ${
                        isActive ? 'text-ink-900' : 'text-ink-700'
                      }`}
                    >
                      {t.label}
                    </p>
                    <p className={`text-label-xs mt-0.5 ${isActive ? 'text-ink-500' : 'text-ink-400'}`}>
                      {t.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-label-sm text-ink-400 mt-4 flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 flex items-center justify-center ri-information-line text-body-sm" />
            Your theme preference is saved on this device automatically.
          </p>
        </div>

        <div className="rounded-2xl px-5 py-4 flex items-start gap-3 bg-tint-indigo-faint border border-tint-indigo-light">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-tint-indigo-strong">
            <span className="w-4 h-4 flex items-center justify-center ri-save-line text-body-md text-indigo-accent" />
          </div>
          <p className="text-label-md text-ink-600 leading-relaxed">
            Your appearance preferences are applied instantly across your retailer session.
          </p>
        </div>
      </div>
    </div>
  );
}
