import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const DATA = [
  { name: 'Dr. Sarah', Sport: 10, Neuro: 5, Geriatric: 2, Women: 0, Other: 1 },
  { name: 'Dr. Budi', Sport: 5, Neuro: 12, Geriatric: 3, Women: 0, Other: 2 },
  { name: 'Dr. Ayu', Sport: 2, Neuro: 3, Geriatric: 8, Women: 5, Other: 1 },
  { name: 'Dr. Reza', Sport: 8, Neuro: 4, Geriatric: 1, Women: 0, Other: 5 },
];

const ServiceDistributionChart = () => {
  return (
    <Card className="rounded-xl border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-800">Distribusi Layanan per Fisioterapis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DATA} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="Sport" stackId="a" fill="#3b82f6" />
              <Bar dataKey="Neuro" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="Geriatric" stackId="a" fill="#10b981" />
              <Bar dataKey="Women" stackId="a" fill="#f43f5e" />
              <Bar dataKey="Other" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceDistributionChart;