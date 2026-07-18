import React from 'react';

interface StatsCardsProps {
  totalManufacturers: number;
  activeManufacturers: number;
  disabledManufacturers: number;
  totalQuotes: number;
}

const StatsCards: React.FC<StatsCardsProps> = ({
  totalManufacturers,
  activeManufacturers,
  disabledManufacturers,
  totalQuotes
}) => {
  const stats = [
    {
      label: 'Total Manufacturers',
      value: totalManufacturers,
      color: 'text-[#1E1E1E]'
    },
    {
      label: 'Active Manufacturers',
      value: activeManufacturers,
      color: 'text-[#1E1E1E]'
    },
    {
      label: 'Disabled Manufacturers',
      value: disabledManufacturers,
      color: 'text-[#1E1E1E]'
    },
    {
      label: 'Total Quotes',
      value: totalQuotes,
      color: 'text-[#1E1E1E]'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-3xl p-4 sm:p-5 md:p-6 border border-gray-100"
        >
          <p className="text-sm sm:text-base text-[#6B7280] mb-2 font-medium">{stat.label}</p>
          <p className={`text-2xl sm:text-3xl md:text-4xl font-bold text-[#373737] ${stat.color}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
