"use client";

import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

type DataPoint = { name: string; value: number; percentage?: number };
type Props = { data: DataPoint[] };

// Matches the blue shades from the screenshot
const COLORS = ['#93C5FD', '#3B82F6', '#1D4ED8'];

export default function PlanPieChart({ data }: Props) {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  return (
    <div className="flex flex-col md:flex-row items-center justify-center md:justify-start w-full h-full min-w-0 min-h-0 gap-8 md:gap-12">
      {/* Chart Section */}
      <div className="w-32 h-32 sm:w-44 sm:h-44 relative shrink-0 min-w-0 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={data}
              innerRadius="65%"
              outerRadius="90%"
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend Section */}
      <div className="flex flex-col gap-5 w-full max-w-sm">
        {data.map((entry, index) => {
          const percentage = entry.percentage ?? (total > 0 ? Math.round((entry.value / total) * 100) : 0);
          return (
            <div key={entry.name} className="flex items-center gap-4">
              {/* Dot */}
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              
              <div className="flex items-baseline gap-2">
                {/* Plan Name */}
                <span className="text-sm font-bold text-[#374151] min-w-[70px]">
                  {entry.name}
                </span>
                
                {/* Count */}
                <span className="text-sm font-medium text-[#6B7280]">
                  {entry.value} retailers
                </span>
                
                {/* Percentage */}
                <span className="text-sm font-normal text-[#9CA3AF]">
                  ({percentage}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
