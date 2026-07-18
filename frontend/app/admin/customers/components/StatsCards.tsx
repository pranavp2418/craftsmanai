import React from 'react';

interface StatsCardsProps {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  totalOrders: number;
}

const StatsCards: React.FC<StatsCardsProps> = ({
  totalCustomers,
  activeCustomers,
  inactiveCustomers,
  totalOrders
}) => {
  const stats = [
    {
      label: 'Total Customers',
      value: totalCustomers,
      color: 'text-[#1E1E1E]'
    },
    {
      label: 'Active Customers',
      value: activeCustomers,
      color: 'text-[#1E1E1E]'
    },
    {
      label: 'Inactive Customers',
      value: inactiveCustomers,
      color: 'text-[#1E1E1E]'
    },
    {
      label: 'Total Orders',
      value: totalOrders,
      color: 'text-[#1E1E1E]'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-5 xl:gap-6 mb-4 sm:mb-5 md:mb-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 lg:p-6 xl:p-7 border border-gray-100"
        >
          <p className="text-xs sm:text-sm md:text-base lg:text-base text-[#6B7280] mb-1 sm:mb-1.5 md:mb-2 lg:mb-2.5 font-medium leading-tight sm:leading-snug">{stat.label}</p>
          <p className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-4xl font-bold text-[#373737] ${stat.color} leading-tight sm:leading-snug md:leading-tight`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
