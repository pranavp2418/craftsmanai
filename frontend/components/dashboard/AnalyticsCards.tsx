'use client';

interface AnalyticsStat {
  value: string;
  label: string;
  icon: string;
}

const stats: readonly AnalyticsStat[] = [
  { value: '24', label: 'Total Renders', icon: 'ri-folder-3-line' },
  { value: '8', label: 'Active Renders', icon: 'ri-sparkling-line' },
  { value: '3', label: 'Pending Approvals', icon: 'ri-time-line' },
  { value: '13', label: 'Completed', icon: 'ri-checkbox-circle-line' },
];

export default function AnalyticsCards() {
  return (
    <div className="grid grid-cols-4 gap-6 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-[#F8F9FB] rounded-[14px] px-6 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-[28px] font-bold text-[#3B82F6] leading-none mb-1.5"
                
              >
                {stat.value}
              </p>
              <p
                className="text-[13px] text-[#6B7280] font-normal"
                
              >
                {stat.label}
              </p>
            </div>
            <div className="w-10 h-10 flex items-center justify-center bg-[#EEF1F5] rounded-[11px] shrink-0">
              <i className={`${stat.icon} text-[18px] text-[#94A3B8]`}></i>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}