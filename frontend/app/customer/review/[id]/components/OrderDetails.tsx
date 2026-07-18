'use client';

import React from 'react';

interface OrderDetailsProps {
  orderId: string;
  orderIdLabel?: string;
  orderDate: string;
  retailer: string;
  manufacturer: string;
  finalPrice?: string;
  showFinalPrice?: boolean;
}

export default function OrderDetails({
  orderId,
  orderIdLabel = 'Order ID',
  orderDate,
  retailer,
  manufacturer,
  finalPrice,
  showFinalPrice = true,
}: OrderDetailsProps) {
  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm w-full lg:h-full lg:overflow-auto">
      <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 pb-2 md:pb-3 mb-3 md:mb-5  border-b-2 border-[#D5D5D5]">Order Details</h3>
      
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        {/* Order ID */}
        <div>
          <p className="text-xs sm:text-sm text-gray-500 mb-1">{orderIdLabel}</p>
          <p className="text-sm sm:text-base font-medium text-gray-900">{orderId}</p>
        </div>

        {/* Order Date */}
        <div>
          <p className="text-xs sm:text-sm text-gray-500 mb-1">Order Date</p>
          <p className="text-sm sm:text-base font-medium text-gray-900">{orderDate}</p>
        </div>

        {/* Retailer */}
        <div>
          <p className="text-xs sm:text-sm text-gray-500 mb-1">Retailer</p>
          <p className="text-sm sm:text-base font-medium text-gray-900">{retailer}</p>
        </div>

        {/* Manufacturer */}
        {/* <div>
          <p className="text-xs sm:text-sm text-gray-500 mb-1">Manufacturer</p>
          <p className="text-sm sm:text-base font-medium text-gray-900">{manufacturer}</p>
        </div> */}

        {/* Final Price */}
        {showFinalPrice && (
          <div>
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Final Price</p>
            <p className="text-sm sm:text-base font-medium text-gray-900">{finalPrice || '-'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
