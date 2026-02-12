'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { WageData } from '@/utils/wage-helpers';

// --- Interfaces ---
interface SocCode {
    code: string;
    title: string;
    description: string;
}

interface CountyInfo {
    county: string;
    state: string;
    stateAb: string;
}

interface AreaMapping {
    name: string;
    counties: CountyInfo[];
}

interface CountyMappingData {
    [areaCode: string]: AreaMapping;
}

interface SidebarProps {
    onSocSelect: (soc: SocCode | null) => void;
    selectedSoc: SocCode | null;
    salary: number;
    onSalaryChange: (salary: number) => void;
    wageData: WageData | null;
    countyMapping: CountyMappingData | null;
    onLocationSelect: (counties: string[]) => void;
}

// --- Helper Functions ---
function formatCurrency(amount: number): string {
    if (amount >= 1000) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    }
    return `$${amount}`;
}

function calculateWageLevel(salary: number, wageData: WageData): number {
    if (salary >= wageData.level4 * 2080) return 4;
    if (salary >= wageData.level3 * 2080) return 3;
    if (salary >= wageData.level2 * 2080) return 2;
    return 1;
}

// --- Components ---

export default function Sidebar({ onSocSelect, selectedSoc, salary, onSalaryChange, wageData, countyMapping, onLocationSelect }: SidebarProps) {
    const [query, setQuery] = useState('');
    const [locationQuery, setLocationQuery] = useState('');
    const [socCodes, setSocCodes] = useState<SocCode[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLocationOpen, setIsLocationOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [locationHighlightIndex, setLocationHighlightIndex] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const locationWrapperRef = useRef<HTMLDivElement>(null);
    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(true); // Default open on mobile to show search

    // Load SOC codes
    useEffect(() => {
        fetch('/data/soc-codes.json')
            .then((res) => res.json())
            .then(setSocCodes)
            .catch(console.error);
    }, []);

    // Filter results for Job Title
    const filteredResults = useMemo(() => {
        if (!query.trim()) return [];
        const lowerQuery = query.toLowerCase();
        return socCodes
            .filter((soc) => soc.title.toLowerCase().includes(lowerQuery) || soc.code.includes(query))
            .slice(0, 8);
    }, [query, socCodes]);

    // Filter results for Location
    const filteredLocations = useMemo(() => {
        if (!locationQuery.trim() || !countyMapping) return [];
        const lowerQuery = locationQuery.toLowerCase();
        const results: { label: string, type: 'County' | 'Area', counties: string[] }[] = [];

        // Search in Area Names because county mapping keys are area codes, values have name
        // We also want to search individual counties.

        // Create a set to avoid duplicates
        const seen = new Set<string>();

        // 1. Search Counties
        for (const area of Object.values(countyMapping)) {
            for (const county of area.counties) {
                const fullName = `${county.county}, ${county.stateAb}`;
                if (fullName.toLowerCase().includes(lowerQuery) && !seen.has(fullName)) {
                    results.push({
                        label: fullName,
                        type: 'County',
                        counties: [`${county.county}::${county.stateAb}`] // Pass composite key
                    });
                    seen.add(fullName);
                }
            }
        }

        // 2. Search Areas
        for (const area of Object.values(countyMapping)) {
            if (area.name.toLowerCase().includes(lowerQuery) && !seen.has(area.name)) {
                results.push({
                    label: area.name,
                    type: 'Area',
                    counties: area.counties.map(c => `${c.county}::${c.stateAb}`)
                });
                seen.add(area.name);
            }
        }

        return results.slice(0, 8);
    }, [locationQuery, countyMapping]);


    // Click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
            if (locationWrapperRef.current && !locationWrapperRef.current.contains(event.target as Node)) {
                setIsLocationOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (soc: SocCode) => {
        onSocSelect(soc);
        setQuery('');
        setIsOpen(false);
        // On mobile, keep open so they can select location if they want
    };

    const handleLocationSelect = (location: { label: string, counties: string[] }) => {
        onLocationSelect(location.counties);
        setLocationQuery(''); // Clear query
        setIsLocationOpen(false);

        // On mobile, collapse sheet after selection to show map
        if (window.innerWidth < 768) {
            setIsMobileSheetOpen(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightIndex((prev) => Math.min(prev + 1, filteredResults.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightIndex((prev) => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredResults[highlightIndex]) handleSelect(filteredResults[highlightIndex]);
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const handleLocationKeyDown = (e: React.KeyboardEvent) => {
        if (!isLocationOpen) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setLocationHighlightIndex((prev) => Math.min(prev + 1, filteredLocations.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setLocationHighlightIndex((prev) => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredLocations[locationHighlightIndex]) handleLocationSelect(filteredLocations[locationHighlightIndex]);
                break;
            case 'Escape':
                setIsLocationOpen(false);
                break;
        }
    };

    return (
        <>
            {/* Mobile Toggle Button (Visible only when sheet is collapsed on mobile) */}
            <button
                onClick={() => setIsMobileSheetOpen(true)}
                className={`md:hidden fixed z-30 bottom-4 left-4 right-4 bg-indigo-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform duration-300 ${isMobileSheetOpen ? 'translate-y-[150%]' : 'translate-y-0'}`}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="font-medium">Search Jobs</span>
            </button>

            <aside className={`
                fixed z-20 transition-all duration-300 ease-in-out
                md:left-6 md:top-6 md:bottom-6 md:w-96 md:transform-none md:rounded-2xl
                left-0 right-0 bottom-0 bg-white/95 backdrop-blur-xl md:bg-transparent
                rounded-t-3xl shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] md:shadow-none
                ${isMobileSheetOpen ? 'translate-y-0' : 'translate-y-[100%] md:translate-y-0'}
            `}>
                {/* Mobile Handle */}
                <div
                    className="md:hidden w-full flex justify-center pt-3 pb-1 cursor-pointer"
                    onClick={() => setIsMobileSheetOpen(false)}
                >
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                </div>

                {/* Search Card */}
                <div className="glass-panel md:rounded-2xl p-6 flex flex-col gap-5 h-full md:h-auto overflow-y-auto md:overflow-visible max-h-[80vh] md:max-h-full">
                    {/* Header */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h1 className="text-xl font-bold tracking-tight text-slate-900">H1b Wage Map</h1>
                            </div>
                            {/* Mobile Close Button */}
                            <button
                                onClick={() => setIsMobileSheetOpen(false)}
                                className="md:hidden p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Maximize your salary potential with nationwide H1B wage insights.
                        </p>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-5">
                        {/* Job Title */}
                        <div ref={wrapperRef} className="relative group">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Job Title</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    value={selectedSoc ? selectedSoc.title : query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setIsOpen(true);
                                        if (selectedSoc) onSocSelect(null);
                                    }}
                                    onFocus={() => !selectedSoc && setIsOpen(true)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Software Engineer..."
                                    className="w-full pl-11 pr-10 py-3 bg-white/50 border border-slate-200 rounded-xl focus:bg-white transition-all shadow-sm focus:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-900 placeholder:text-slate-400"
                                />
                                {selectedSoc && (
                                    <button
                                        onClick={() => {
                                            onSocSelect(null);
                                            setQuery('');
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-md transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Results */}
                            {isOpen && filteredResults.length > 0 && (
                                <div className="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <ul className="max-h-64 overflow-y-auto py-1">
                                        {filteredResults.map((soc, index) => (
                                            <li
                                                key={soc.code}
                                                onClick={() => handleSelect(soc)}
                                                className={`px-4 py-3 cursor-pointer text-sm transition-colors border-b last:border-0 border-slate-50 ${index === highlightIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="font-medium">{soc.title}</div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{soc.code}</div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Location Search */}
                        <div ref={locationWrapperRef} className="relative group">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Location</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-pink-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    value={locationQuery}
                                    onChange={(e) => {
                                        setLocationQuery(e.target.value);
                                        setIsLocationOpen(true);
                                    }}
                                    onFocus={() => setIsLocationOpen(true)}
                                    onKeyDown={handleLocationKeyDown}
                                    placeholder="County or Area..."
                                    className="w-full pl-11 pr-10 py-3 bg-white/50 border border-slate-200 rounded-xl focus:bg-white transition-all shadow-sm focus:shadow-md focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none text-slate-900 placeholder:text-slate-400"
                                />
                                {locationQuery && (
                                    <button
                                        onClick={() => {
                                            setLocationQuery('');
                                            onLocationSelect([]);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-md transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Location Dropdown Results */}
                            {isLocationOpen && filteredLocations.length > 0 && (
                                <div className="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <ul className="max-h-64 overflow-y-auto py-1">
                                        {filteredLocations.map((loc, index) => (
                                            <li
                                                key={`${loc.label}-${index}`}
                                                onClick={() => handleLocationSelect(loc)}
                                                className={`px-4 py-3 cursor-pointer text-sm transition-colors border-b last:border-0 border-slate-50 ${index === locationHighlightIndex ? 'bg-pink-50 text-pink-700' : 'text-slate-700 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="font-medium">{loc.label}</div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{loc.type}</div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Salary Slider */}
                        <div className="group">
                            <div className="flex justify-between items-end mb-2 ml-1">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Base Salary</label>
                                <div className="text-lg font-bold text-slate-900 tabular-nums tracking-tight">
                                    {salary.toLocaleString()} <span className="text-sm font-normal text-slate-400">USD</span>
                                </div>
                            </div>

                            <div className="relative h-6 flex items-center">
                                {/* Custom Track Background */}
                                <div className="absolute w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                        style={{ width: `${Math.min(((salary - 30000) / (300000 - 30000)) * 100, 100)}%` }}
                                    />
                                </div>

                                <input
                                    type="range"
                                    min="30000"
                                    max="300000"
                                    step="1000"
                                    value={salary}
                                    onChange={(e) => onSalaryChange(Number(e.target.value))}
                                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                                />

                                {/* Custom Thumb (Visual only since input handles interaction) */}
                                <div
                                    className="absolute h-5 w-5 bg-white border-2 border-indigo-600 rounded-full shadow-md pointer-events-none transition-transform group-hover:scale-110"
                                    style={{
                                        left: `calc(${((salary - 30000) / (300000 - 30000)) * 100}% - 10px)`
                                    }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-1 px-1 font-medium">
                                <span>$30k</span>
                                <span>$300k+</span>
                            </div>
                        </div>
                    </div>

                    {/* Legend / Heatmap Explanation */}
                    <div className="pt-5 border-t border-slate-100 pb-8 md:pb-0">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 ml-1">Visa Affordability Heatmap</label>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                                <div>
                                    <div className="text-xs font-bold text-slate-700">Strong</div>
                                    <div className="text-[10px] text-slate-400 leading-tight">Level 3+ Wage</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></div>
                                <div>
                                    <div className="text-xs font-bold text-slate-700">Good</div>
                                    <div className="text-[10px] text-slate-400 leading-tight">Level 2 Wage</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
                                <div>
                                    <div className="text-xs font-bold text-slate-700">Risky</div>
                                    <div className="text-[10px] text-slate-400 leading-tight">Level 1 Wage</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
                                <div>
                                    <div className="text-xs font-bold text-slate-700">Unlikely</div>
                                    <div className="text-[10px] text-slate-400 leading-tight">Below Prevailing</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
