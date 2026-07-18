'use client';

import React from 'react';

export default function TeamCard() {
  return (
    <div className="flex-1 rounded-sheet p-6 sm:p-10 shadow-glow-indigo-soft bg-glass-72 backdrop-blur-xl border border-glass-strong">
      {/* Header section with Invite button */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 mb-8">
        <div>
          <h2 className="text-heading font-bold text-ink-900 font-satoshi text-xl sm:text-2xl dark:text-[#E7EAEE]">Team Management</h2>
          <p className="text-body-sm text-ink-400 mt-1">Multi-user support is coming in a future update.</p>
        </div>
        <button
          type="button"
          disabled
          className="px-4 py-2.5 rounded-xl text-body-sm font-semibold bg-[#F3F4F6] dark:bg-surface-150 text-[#9CA3AF] dark:text-[#A1A8B3] cursor-not-allowed flex items-center justify-center gap-2 self-start sm:self-auto shrink-0 border border-gray-100/50 dark:border-border-default"
        >
          <span className="ri-user-add-line text-base"></span>
          Invite Member
        </button>
      </div>

      {/* Centered Coming Soon Section */}
      <div className="flex flex-col items-center justify-center py-16 px-4">
        {/* Lavender badge with Team Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] dark:bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center mb-5 shadow-sm">
          <span className="ri-team-line text-3xl"></span>
        </div>

        {/* Titles */}
        <h3 className="text-lg font-bold text-[#111827] dark:text-white text-center mb-2 font-satoshi">Team Management</h3>
        
        {/* Paragraphs */}
        <p className="text-sm font-medium text-[#4B5563] dark:text-[#A1A8B3] text-center mb-1 leading-relaxed">
          Multi-user support is coming in a future update.
        </p>
        <p className="text-xs text-[#9CA3AF] dark:text-ink-300 text-center max-w-[420px] leading-relaxed mb-6 font-inter">
          Invite teammates, assign roles, and collaborate across requests and workflows in a future release.
        </p>

        {/* Coming soon Pill */}
        <span className="px-5 py-2 rounded-full text-xs font-semibold text-[#6366F1] bg-[#EEF2FF] dark:bg-[#6366F1]/10 select-none font-satoshi">
          Coming soon
        </span>
      </div>
    </div>
  );
}
