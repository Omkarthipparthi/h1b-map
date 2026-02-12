'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { WageData, CountyMappingData, STATE_FIPS } from '@/utils/wage-helpers';

// Dynamically import map to avoid SSR issues with MapLibre
const WageMap = dynamic(() => import('@/components/WageMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading map...</div>
    </div>
  ),
});

interface SocCode {
  code: string;
  title: string;
  description: string;
}

// Helper to get state abbreviation
function getStateAb(fips: string): string {
  const entry = Object.entries(STATE_FIPS).find(([k, v]) => v === fips);
  return entry ? entry[0] : '';
}

export default function Home() {
  const [selectedSoc, setSelectedSoc] = useState<SocCode | null>(null);

  // Selection State
  const [selectedWage, setSelectedWage] = useState<WageData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ county: string, state: string } | null>(null);

  // Hover State
  const [hoveredWage, setHoveredWage] = useState<WageData | null>(null);
  const [hoveredLocation, setHoveredLocation] = useState<{ county: string, state: string } | null>(null);

  const [salary, setSalary] = useState<number>(120000);

  // Location Search State
  const [countyMapping, setCountyMapping] = useState<CountyMappingData | null>(null);
  const [focusedCounties, setFocusedCounties] = useState<string[]>([]);

  // Load county mapping data
  useEffect(() => {
    fetch('/data/county-mapping.json')
      .then((res) => res.json())
      .then((data: CountyMappingData) => {
        setCountyMapping(data);
      })
      .catch(console.error);
  }, []);

  // Show hovered wage if available, otherwise show selected
  const displayedWage = hoveredWage || selectedWage;
  const displayedLocation = hoveredWage ? hoveredLocation : selectedLocation;

  const handleAreaSelect = (selection: { wage: WageData | null, county: string, state: string }) => {
    setSelectedWage(selection.wage);
    if (selection.wage) {
      setSelectedLocation({ county: selection.county, state: selection.state });
    } else {
      setSelectedLocation(null);
    }
  };

  const handleAreaHover = (selection: { wage: WageData | null, county: string, state: string }) => {
    setHoveredWage(selection.wage);
    if (selection.wage) {
      setHoveredLocation({ county: selection.county, state: selection.state });
    } else {
      setHoveredLocation(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          onSocSelect={setSelectedSoc}
          selectedSoc={selectedSoc}
          salary={salary}
          onSalaryChange={setSalary}
          wageData={displayedWage}
          countyMapping={countyMapping}
          onLocationSelect={setFocusedCounties}
        />

        {/* Map */}
        <main className="flex-1 relative">
          <WageMap
            selectedSocCode={selectedSoc?.code || null}
            salary={salary}
            onAreaSelect={handleAreaSelect}
            onAreaHover={handleAreaHover}
            focusedCounties={focusedCounties}
          />

          {/* Selected Area Popup */}
          {displayedWage && (
            <div className={`
              fixed md:absolute z-40 transition-all duration-300 ease-in-out bg-white shadow-2xl overflow-hidden
              md:top-4 md:right-4 md:w-80 md:rounded-xl md:border md:border-slate-200 md:bottom-auto md:left-auto
              bottom-0 left-0 right-0 rounded-t-3xl border-t border-slate-200
              ${hoveredWage ? 'md:border-indigo-300' : 'md:border-slate-200'}
            `}>
              <div className="p-4 border-b border-slate-100 relative">
                {/* Mobile Drag Handle */}
                <div className="md:hidden w-full flex justify-center absolute top-2 left-0">
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                </div>

                {selectedWage && !hoveredWage && (
                  <button
                    onClick={() => { setSelectedWage(null); setSelectedLocation(null); }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 md:p-0"
                  >
                    <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <div className="flex flex-col gap-1 mt-4 md:mt-0">
                  <div className="flex items-center gap-2">
                    {hoveredWage && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">Preview</span>}
                    {displayedLocation && (
                      <h2 className="font-bold text-slate-900 text-lg md:text-xl">
                        {displayedLocation.county}, {getStateAb(displayedLocation.state)}
                      </h2>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-medium pl-0.5 max-w-[90%] truncate">
                    {displayedWage.areaName}
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-2 font-medium">Base Offer: <span className="text-slate-700">${salary.toLocaleString()}</span></p>
              </div>

              <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto md:max-h-none">
                {[
                  { level: 4, hourly: displayedWage.level4 },
                  { level: 3, hourly: displayedWage.level3 },
                  { level: 2, hourly: displayedWage.level2 },
                  { level: 1, hourly: displayedWage.level1 },
                ].map(({ level, hourly }) => {
                  const annual = hourly * 2080;
                  const isCurrentLevel = salary >= annual && (level === 4 || salary < [0, displayedWage.level2, displayedWage.level3, displayedWage.level4, Infinity][level] * 2080);
                  const diff = salary - annual;
                  const diffPercent = Math.round((diff / annual) * 100);

                  return (
                    <div
                      key={level}
                      className={`flex items-center justify-between p-3 rounded-lg ${isCurrentLevel ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full level-${level}`} />
                        <span className={`text-sm ${isCurrentLevel ? 'font-medium text-indigo-700' : 'text-slate-600'}`}>
                          Level {level === 1 ? 'I' : level === 2 ? 'II' : level === 3 ? 'III' : 'IV'}
                        </span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={`text-sm font-mono ${isCurrentLevel ? 'text-indigo-700 font-bold' : 'text-slate-700'}`}>
                          ${annual.toLocaleString()}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 inline-flex items-center gap-1 ${level >= 3 ? 'bg-emerald-100 text-emerald-700' :
                          level === 2 ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                          {level}x Entry
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Goal message */}
              {salary > 0 && (() => {
                const l1 = displayedWage.level1 * 2080;
                const l2 = displayedWage.level2 * 2080;
                const l3 = displayedWage.level3 * 2080;
                const l4 = displayedWage.level4 * 2080;

                let currentLevel = 1;
                if (salary >= l4) currentLevel = 4;
                else if (salary >= l3) currentLevel = 3;
                else if (salary >= l2) currentLevel = 2;

                if (currentLevel < 4) {
                  const nextThreshold = [0, l2, l3, l4][currentLevel];
                  const gap = nextThreshold - salary;
                  return (
                    <div className="px-4 pb-8 md:pb-4">
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <span className="font-medium">Goal:</span> Raise offer by ${gap.toLocaleString()} to reach Level {currentLevel + 1}.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
