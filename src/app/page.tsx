'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import JobSearch from '@/components/JobSearch';
import WagePanel from '@/components/WagePanel';

// Dynamically import map to avoid SSR issues with MapLibre
const WageMap = dynamic(() => import('@/components/WageMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800/50 rounded-2xl flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading map...</div>
    </div>
  ),
});

interface SocCode {
  code: string;
  title: string;
  description: string;
}

interface WageData {
  area: number;
  areaName: string;
  level1: number;
  level2: number;
  level3: number;
  level4: number;
}

export default function Home() {
  const [selectedSoc, setSelectedSoc] = useState<SocCode | null>(null);
  const [selectedWage, setSelectedWage] = useState<WageData | null>(null);
  const [salary, setSalary] = useState<number>(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">H1B Wage Map</h1>
                <p className="text-xs text-slate-400">DOL Prevailing Wage Data 2025-2026</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search */}
        <div className="mb-6">
          <JobSearch onSelect={setSelectedSoc} selectedSoc={selectedSoc} />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {/* Map - takes 2 columns */}
          <div className="lg:col-span-2 min-h-[400px] lg:min-h-0">
            <WageMap
              selectedSocCode={selectedSoc?.code || null}
              onAreaSelect={setSelectedWage}
            />
          </div>

          {/* Wage panel - takes 1 column */}
          <div className="lg:col-span-1">
            <WagePanel
              wageData={selectedWage}
              salary={salary}
              onSalaryChange={setSalary}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-slate-500">
            Data from U.S. Department of Labor • Updated annually
          </p>
        </div>
      </footer>
    </div>
  );
}
