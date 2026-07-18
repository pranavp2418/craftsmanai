'use client';

import React from 'react';
import { ArrowUp } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  subtitle: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, subtitle }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-[#F1F1F1] flex items-center justify-center mb-4">
        <div className="w-10 h-10 rounded-full text-[#515151] flex items-center justify-center">
          <ArrowUp className="w-6 h-6" />
        </div>
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  );
};

export default EmptyState;
