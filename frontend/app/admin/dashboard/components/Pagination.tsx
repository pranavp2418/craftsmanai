import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

    if (currentPage <= 3) return [1, 2, 3, 4, totalPages];
    if (currentPage >= totalPages - 2) return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];

    return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-t border-gray-200 bg-[#F1F1F1] rounded-b-2xl gap-2 sm:gap-0">
      {/* Results Info */}
      <div className="text-xs sm:text-sm text-[#374151] text-center sm:text-left">
        <span className="hidden sm:inline">Showing {startItem} to {endItem} of {totalItems}</span>
        <span className="sm:hidden">{startItem}-{endItem} of {totalItems}</span>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center sm:justify-end">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
            currentPage === 1
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-[#374151] hover:bg-gray-100 cursor-pointer'
          }`}
        >
          <span className="hidden sm:inline">Previous</span>
          <span className="sm:hidden">Prev</span>
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto hide-scrollbar max-w-37.5 sm:max-w-none">
          <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none;}`}</style>
          {getVisiblePages().map((page, index, arr) => (
            <React.Fragment key={page}>
              {index > 0 && page - arr[index - 1] > 1 && (
                <span className="px-1 text-xs sm:text-sm text-gray-500">...</span>
              )}
              <button
                onClick={() => onPageChange(page)}
                className={`w-6 h-6 md:w-8 md:h-8 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer shrink-0 ${
                  currentPage === page
                    ? 'bg-[#2F68C5] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
            currentPage === totalPages
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-[#374151] hover:bg-gray-100 cursor-pointer'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;
