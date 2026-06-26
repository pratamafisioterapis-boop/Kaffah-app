import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const DATA = [
  { name: 'Dr. Sarah', Sport: 10, Neuro: 5, Geriatric: 2, Women: 0, Other: 1 },
  { name: 'Dr. Budi',  Sport: 5,  Neuro: 12, Geriatric: 3, Women: 0, Other: 2 },
  { name: 'Dr. Ayu',  Sport: 2,  Neuro: 3,  Geriatric: 8, Women: 5, Other: 1 },
  { name: 'Dr. Reza', Sport: 8,  Neuro: 4,  Geriatric: 1, Women: 0, Other: 5 },
];

const COLORS = {
  Sport:    '#6366f1',
  Neuro:    '#8b5cf6',
  Geriatric:'#10b981',
  Women:    '#f43f5e',
  Other:    '#cbd5e1',
};

const ServiceDistributionChart = () => {
  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="p-5 md:p-6 pb-0">
        <h3 className="text-base font-bold text-slate-800">Distribusi Layanan per Fisioterapis</h3>
        <p className="text-xs text-slate-400 mt-0.5">Breakdown tipe layanan per terapis</p>
      </div>

      <CardContent className="pt-4 pb-5 px-5 md:px-6">
        <div className="h-[220px] md:h-[270px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DATA} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
              />
              <YAxis
                axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px', border: 'none',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px'
                }}
                cursor={{ fill: '#f8fafc', radius: 6 }}
              />
              <Legend
                verticalAlign="top"
                height={32}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingBottom: '8px' }}
              />
              {Object.entries(COLORS).map(([key, color], i, arr) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={color}
                  radius={i === arr.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  animationDuration={1200}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceDistributionChart;