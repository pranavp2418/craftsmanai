import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-3 sm:p-6 shadow-sm">
        {/* Title shimmer */}
        <div className="h-3.5 sm:h-4 w-3/4 rounded-md bg-gray-200 animate-pulse mb-3 sm:mb-4" />
        {/* Value shimmer */}
        <div className="h-6 sm:h-8 w-1/2 rounded-md bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-3 sm:p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between">
      <h3 className="text-[#373737] text-xs sm:text-sm md:text-base font-medium mb-2 sm:mb-3 leading-tight">
        {title}
      </h3>
      <p className="text-xl sm:text-2xl md:text-[32px] font-bold text-gray-900 leading-none">
        {value}
      </p>
    </div>
  );
};

export default StatCard;
