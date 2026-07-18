'use client';

export type WorkspaceTab = 'Design' | 'Customer' | 'Manufacturer';

const tabs: readonly WorkspaceTab[] = ['Design', 'Customer', 'Manufacturer'];

interface WorkspaceTabsProps {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}

export default function WorkspaceTabs({ active, onChange }: WorkspaceTabsProps) {
  return (
    <div className="flex items-center mb-4 sm:mb-6 overflow-x-auto hide-scrollbar w-full">
      <div className="flex items-center gap-1 p-1 rounded-full bg-[#F3F4F6] dark:bg-[#20262E] w-full sm:w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={`flex-1 sm:flex-none px-2 sm:px-5 py-1.5 sm:py-2 rounded-full text-[12px] sm:text-[13px] font-medium transition-all duration-150 cursor-pointer whitespace-nowrap text-center ${
              active === tab
                ? 'text-white dark:text-black bg-[#3B82F6] dark:bg-[#60A5FA]'
                : 'text-[#6B7280] dark:text-ink-600 hover:text-[#1A1A1A] dark:hover:text-ink'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
