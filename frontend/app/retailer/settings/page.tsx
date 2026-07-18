'use client';

import { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import SettingsNav from './SettingsNav';
import ProfileCard from './ProfileCard';
import NotificationsCard from './NotificationsCard';
import BrandCard from './BrandCard';
import SecurityCard from './SecurityCard';
import UsagePlanCard from './UsagePlanCard';
import TeamCard from './TeamCard';
import AppearanceCard from './AppearanceCard';

const validSections = ['profile', 'notifications', 'brand', 'security', 'usage-plan', 'team', 'appearance'] as const;
type SectionId = (typeof validSections)[number];

function normalizeSection(hash: string | null | undefined): SectionId {
  if (typeof hash !== 'string') return 'profile';

  const cleanedHash = hash
    .split('#')
    .filter(Boolean)
    .pop();

  if (!cleanedHash) return 'profile';

  return validSections.includes(cleanedHash as SectionId)
    ? (cleanedHash as SectionId)
    : 'profile';
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SectionId>('profile');

  useEffect(() => {
    const syncSectionFromHash = () => {
      if (typeof window === 'undefined') return;

      const nextSection = normalizeSection(window.location.hash);
      setActiveSection(nextSection);

      const expectedHash = nextSection === 'profile' ? '' : `#${nextSection}`;
      if (window.location.hash !== expectedHash) {
        const nextUrl = `${window.location.pathname}${expectedHash}${window.location.search}`;
        window.history.replaceState(null, '', nextUrl);
      }
    };

    syncSectionFromHash();
    window.addEventListener('hashchange', syncSectionFromHash);
    window.addEventListener('popstate', syncSectionFromHash);

    // Poll for changes to detect pushState/replaceState changes made by client router
    let lastHash = window.location.hash;
    const intervalId = setInterval(() => {
      if (window.location.hash !== lastHash) {
        lastHash = window.location.hash;
        syncSectionFromHash();
      }
    }, 100);

    return () => {
      window.removeEventListener('hashchange', syncSectionFromHash);
      window.removeEventListener('popstate', syncSectionFromHash);
      clearInterval(intervalId);
    };
  }, []);

  const handleSectionChange = (sectionId: string) => {
    const nextSection = normalizeSection(sectionId);
    setActiveSection(nextSection);

    if (typeof window !== 'undefined') {
      const nextHash = nextSection === 'profile' ? '' : `#${nextSection}`;
      const nextUrl = `${window.location.pathname}${nextHash}${window.location.search}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextUrl);
      }
    }
  };

  return (
    <div
      className="min-h-screen bg-surface-page">
      <TopBar />
      <div className="max-w-[1350px] mx-auto px-4 sm:px-6 lg:px-8 pb-8 lg:pb-12 pt-5 lg:pt-7">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-start ">
          <SettingsNav active={activeSection} onChange={handleSectionChange} />

          <div className="flex-1 min-w-0">
            {activeSection === 'profile' && <ProfileCard />}
            {activeSection === 'notifications' && <NotificationsCard />}
            {activeSection === 'brand' && <BrandCard />}
            {activeSection === 'security' && <SecurityCard />}
            {activeSection === 'usage-plan' && (
              <div className="rounded-sheet-lg p-4 sm:p-6 shadow-card-lg bg-glass-72 backdrop-blur-xl border border-glass-vivid">
                <UsagePlanCard />
              </div>
            )}
            {activeSection === 'team' && <TeamCard />}
            {activeSection === 'appearance' && <AppearanceCard />}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderCard({ title, icon, desc }: { title: string; icon: string; desc: string }) {
  return (
    <div
      className="rounded-sheet p-10 flex flex-col items-center justify-center min-h-[320px] gap-4 shadow-glow-indigo-soft bg-glass-72 backdrop-blur-xl border border-glass-strong">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-indigo-tint"

      >
        <span className={`w-7 h-7 flex items-center justify-center ${icon} text-display-sm text-indigo-accent`}></span>
      </div>
      <div className="text-center">
        <p className="text-ui font-semibold text-ink-900 font-satoshi">{title}</p>
        <p className="text-body-sm text-ink-400 mt-1">{desc}</p>
      </div>
      <span
        className="px-4 py-1.5 rounded-full text-label font-medium text-indigo-accent bg-tint-indigo-soft">
        Coming soon
      </span>
    </div>
  );
}
