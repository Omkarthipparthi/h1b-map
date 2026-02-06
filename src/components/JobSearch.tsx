'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

interface SocCode {
    code: string;
    title: string;
    description: string;
}

interface JobSearchProps {
    onSelect: (soc: SocCode) => void;
    selectedSoc: SocCode | null;
}

export default function JobSearch({ onSelect, selectedSoc }: JobSearchProps) {
    const [query, setQuery] = useState('');
    const [socCodes, setSocCodes] = useState<SocCode[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Load SOC codes on mount
    useEffect(() => {
        fetch('/data/soc-codes.json')
            .then((res) => res.json())
            .then(setSocCodes)
            .catch(console.error);
    }, []);

    // Filter results based on query
    const filteredResults = useMemo(() => {
        if (!query.trim()) return [];
        const lowerQuery = query.toLowerCase();
        return socCodes
            .filter(
                (soc) =>
                    soc.title.toLowerCase().includes(lowerQuery) ||
                    soc.code.includes(query)
            )
            .slice(0, 10);
    }, [query, socCodes]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle keyboard navigation
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
                if (filteredResults[highlightIndex]) {
                    handleSelect(filteredResults[highlightIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const handleSelect = (soc: SocCode) => {
        onSelect(soc);
        setQuery('');
        setIsOpen(false);
        setHighlightIndex(0);
    };

    return (
        <div ref={wrapperRef} className="relative w-full max-w-lg">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                        setHighlightIndex(0);
                    }}
                    onFocus={() => query && setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search job title or SOC code..."
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                />
                <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                </svg>
            </div>

            {/* Selected job display */}
            {selectedSoc && (
                <div className="mt-3 px-4 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-xs font-mono text-blue-400">{selectedSoc.code}</span>
                            <h3 className="text-white font-medium">{selectedSoc.title}</h3>
                        </div>
                        <button
                            onClick={() => onSelect(null as unknown as SocCode)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Dropdown results */}
            {isOpen && filteredResults.length > 0 && (
                <ul className="absolute z-50 w-full mt-2 bg-slate-800/95 border border-slate-600 rounded-xl shadow-2xl backdrop-blur-sm overflow-hidden">
                    {filteredResults.map((soc, index) => (
                        <li
                            key={soc.code}
                            onClick={() => handleSelect(soc)}
                            className={`px-4 py-3 cursor-pointer transition-colors ${index === highlightIndex
                                    ? 'bg-blue-600/30 text-white'
                                    : 'text-slate-300 hover:bg-slate-700/50'
                                }`}
                        >
                            <span className="text-xs font-mono text-blue-400 mr-2">{soc.code}</span>
                            <span>{soc.title}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
