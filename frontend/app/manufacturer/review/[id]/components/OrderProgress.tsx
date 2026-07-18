'use client';

import React from 'react';
import {
  AppWindow,
  Send,
  Timer,
} from 'lucide-react';

interface ProgressStep {
  step: string;
  completed: boolean;
  current?: boolean;
  date?: string;
}

interface OrderProgressProps {
  progress: ProgressStep[];
  loading?: boolean;
  action?: React.ReactNode;
}

export default function OrderProgress({
  progress,
  loading = false,
  action,
}: OrderProgressProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.08)]">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-6" />

        <div className="space-y-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getIcon = (step: string) => {
    const name = step.toLowerCase();

    if (name.includes('job'))
      return <AppWindow className="w-5 h-5" />;

    if (name.includes('quote'))
      return <Send className="w-5 h-5" />;

    return <Timer className="w-5 h-5" />;
  };

  const getState = (
    item: ProgressStep
  ): 'completed' | 'current' | 'pending' => {
    if (item.completed) return 'completed';
    if (item.current) return 'current';
    return 'pending';
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] h-full">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Order Progress
        </h3>
        
      </div>

      <div className="relative flex flex-col justify-between">
        {progress.map((item, index) => {
          const state = getState(item);

          return (
            <div key={index} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Progress Line */}
              {index !== progress.length - 1 && (
                <div
                  className={`absolute left-5 top-10 bottom-0 w-[2px] ${
                    state === 'completed' ? 'bg-[#2563EB]' : 'bg-gray-200'
                  }`}
                />
              )}

              {/* Icon */}
              <div
                className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full ${
                  state === 'completed'
                    ? 'bg-[#2563EB] text-white'
                    : state === 'current'
                    ? 'bg-blue-50 text-[#2563EB] ring-2 ring-blue-100'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {getIcon(item.step)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <p
                  className={`text-sm font-medium ${
                    state === 'pending' ? 'text-gray-500' : 'text-gray-900'
                  }`}
                >
                  {item.step}
                </p>

                {item.date && (
                  <p className="text-xs text-gray-500 mt-1">
                    {item.date}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {action}
      </div>
    </div>
  );
}
