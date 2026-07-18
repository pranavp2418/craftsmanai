"use client";

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

type DataPoint = { month: string; churned: number; newSubs: number };
type Props = { data: DataPoint[] };

export default function SubsGrowthChart({ data }: Props) {
  return (
    <div className="w-full h-full min-w-0 min-h-0 rounded-lg">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" />
          <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="churned" name="Churned" fill="#FB7185" barSize={14} />
          <Bar dataKey="newSubs" name="New" fill="#3B82F6" barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
