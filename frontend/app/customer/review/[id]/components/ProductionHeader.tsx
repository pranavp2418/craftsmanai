import React from 'react';
import { CheckCircle, Info, Eye } from 'lucide-react';

interface ProductionHeaderProps {
  title: string;
  requestSku: string;
  orderDate: string;
  retailer: string;
  status: string;
  orderId?: string;
  isAwaitingApproval?: boolean;
  approveLoading?: boolean;
  refinementLoading?: boolean;
  brandPrimaryColor?: string;
  onReject?: () => void;
  onApprove?: () => void;
}

export default function ProductionHeader({
  title,
  requestSku,
  orderDate,
  retailer,
  status,
  orderId,
  isAwaitingApproval = false,
  approveLoading = false,
  refinementLoading = false,
  brandPrimaryColor = '#3B82F6',
  onReject,
  onApprove,
}: ProductionHeaderProps) {
  const isInProduction = status.toLowerCase().includes('production');
  const isDesignReview = status.toLowerCase().includes('design');

  // Status badge styling based on status
  const getStatusStyle = () => {
    if (isInProduction) {
      return {
        backgroundColor: '#DBEAFE',
        color: '#2563EB',
      };
    }
    if (isDesignReview) {
      return {
        backgroundColor: '#E3E3E3',
        color: '#515151',
      };
    }
    return {
      backgroundColor: '#FFECD1',
      color: '#D97706',
    };
  };

  const getStatusIcon = () => {
    if (isInProduction) {
      return <Info className="w-3 h-3 sm:w-4 sm:h-4" />;
    }
    if (isDesignReview) {
      return <Eye className="w-3 h-3 sm:w-4 sm:h-4" />;
    }
    return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />;
  };

  const getStatusText = () => {
    if (isDesignReview) {
      return 'Design review';
    }
    return status;
  };

  if (isInProduction && orderId) {
    // Simplified header for "In Production" status
    return (
      <div
        className="bg-white p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <h2 className="text-lg sm:text-xl md:text-2xl font-medium text-gray-900">
            Order {orderId}
          </h2>
          <div>
            <span
              className="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full whitespace-nowrap text-xs sm:text-sm font-medium"
              style={{
                ...getStatusStyle(),
              }}
            >
              {getStatusIcon()}
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Default header for other statuses
  return (
    <div
      className="bg-white p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between h-full">
        <div>
          <h2 className="text-xl sm:text-2xl  flex justify-between  font-medium text-gray-900 mb-2 sm:mb-3">
            {title} <span
            className="inline-flex  md:hidden items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full whitespace-nowrap text-xs sm:text-sm font-medium"
            style={{
              ...getStatusStyle(),
            }}
          >
            {getStatusIcon()}
            {getStatusText()}
          </span>
          </h2>
          <div className="space-y-1 sm:space-y-1.5">
            <p className="text-sm sm:text-base text-gray-600">
              {requestSku}
            </p>
            <p className="text-sm sm:text-base text-gray-600">
              <span className="font-bold">Order Date:</span> {orderDate}
            </p>
            <p className="text-sm sm:text-base text-gray-600">
              <span className="font-bold">Retailer:</span> {retailer}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col items-start justify-between gap-16 h-full lg:min-w-[18rem] lg:items-end">
          <span
            className="hidden md:inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full whitespace-nowrap text-xs sm:text-sm font-medium"
            style={{
              ...getStatusStyle(),
            }}
          >
            {getStatusIcon()}
            {getStatusText()}
          </span>

          {isAwaitingApproval && onReject && onApprove && (
            <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onReject}
                disabled={approveLoading || refinementLoading}
                className="w-full min-w-0 cursor-pointer rounded-lg border px-5 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[7.5rem] sm:px-6 sm:py-3 sm:text-base"
                style={{ borderColor: '#EF4444' }}
              >
                Reject Design
              </button>

              <button
                type="button"
                onClick={onApprove}
                disabled={approveLoading || refinementLoading}
                className="w-full min-w-0 cursor-pointer rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[9rem] sm:px-6 sm:py-3 sm:text-base"
                style={{ backgroundColor: brandPrimaryColor }}
              >
                {approveLoading ? 'Approving...' : 'Approve Design'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
