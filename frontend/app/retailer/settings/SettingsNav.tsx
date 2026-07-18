'use client';

import { useEffect, useState } from 'react';

const navItems = [
  { label: 'Profile', icon: 'ri-user-3-line', id: 'profile', desc: 'Manage your personal information.' },
  { label: 'Notifications', icon: 'ri-notification-3-line', id: 'notifications', desc: 'Control your notification preferences.' },
  { label: 'Brand', icon: 'ri-store-3-line', id: 'brand', desc: 'Customize how your brand appears.' },
  { label: 'Security', icon: 'ri-shield-keyhole-line', id: 'security', desc: 'Manage your account security settings.' },
  { label: 'Usage & Plan', icon: 'ri-pie-chart-2-line', id: 'usage-plan', desc: 'Monitor your render usage and plan details.' },
  { label: 'Team', icon: 'ri-group-line', id: 'team', desc: 'Manage your team members and roles.' },
  { label: 'Appearance', icon: 'ri-palette-line', id: 'appearance', desc: 'Customize how the app looks and feels.' },
];

interface Props {
  active: string;
  onChange: (id: string) => void;
}

export default function SettingsNav({ active, onChange }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeItem = navItems.find((i) => i.id === active);

  return (
    <div
      className="w-full lg:w-[220px] lg:flex-shrink-0 rounded-sheet flex flex-col bg-glass-72 backdrop-blur-xl border border-glass-strong shadow-glow-indigo-card lg:sticky lg:top-7 lg:self-start"

    >
      {/* Title block — hidden on mobile (the page-level TopBar already shows "Settings"); full on lg+ */}
      <div className="hidden lg:block px-5 pt-5 pb-4 border-b border-black/[0.05]">
        <h2
          className="text-ui-lg font-bold text-ink-900 dark:text-[#E7EAEE] leading-tight transition-all duration-200 font-satoshi">
          {mounted && activeItem ? activeItem.label : 'Settings'}
        </h2>
        <p className="text-label-sm text-ink-400 mt-0.5 leading-snug transition-all duration-200">
          {mounted && activeItem ? activeItem.desc : 'Manage your account and preferences.'}
        </p>
      </div>

      {/* Nav: horizontal scroll on mobile, vertical stack on lg+ */}
      <div className="p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible scrollbar-hide">
        <p className="hidden lg:block text-caption font-semibold text-ink-400 uppercase tracking-widest px-3 pt-1 pb-1">
          Account
        </p>
        {navItems.map((item) => {
          const isActive = mounted && active === item.id;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onChange(item.id)}
              aria-pressed={isActive}
              className={`flex items-center justify-center lg:justify-start gap-2 lg:gap-3 px-3.5 min-h-touch rounded-xl text-body-sm lg:text-body font-medium transition-all duration-150 whitespace-nowrap text-left flex-shrink-0 lg:w-full ${
                isActive
                  ? 'bg-gradient-indigo-tint text-brand'
                  : 'text-ink-500'
              }`}
            >
              <span className={`w-[18px] h-[18px] flex items-center justify-center ${item.icon} text-ui-lg`} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
