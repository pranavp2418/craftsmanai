"use client";

import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type DataPoint = { month: string; revenue: number };
type Props = { data: DataPoint[] };

const formatAxisCurrency = (value: number) => `$${Math.round(value / 1000)}k`;

export default function RevenueGrowthChart({ data }: Props) {
  return (
    <div className="w-full h-full min-w-0 min-h-0 rounded-lg">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" />
          <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickFormatter={formatAxisCurrency}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => {
              const numericValue = typeof value === 'number' ? value : Number(value || 0);
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(numericValue);
            }}
            labelStyle={{ color: '#111827' }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#2563EB"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#2563EB', stroke: '#DBEAFE', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
