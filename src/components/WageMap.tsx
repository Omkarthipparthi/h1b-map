'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface WageData {
    area: number;
    areaName: string;
    level1: number;
    level2: number;
    level3: number;
    level4: number;
}

interface CountyToAreaMapping {
    [countyFips: string]: number; // maps county FIPS to area code
}

interface WageMapProps {
    selectedSocCode: string | null;
    onAreaSelect: (wage: WageData | null) => void;
}

export default function WageMap({ selectedSocCode, onAreaSelect }: WageMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [wageData, setWageData] = useState<WageData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [mapReady, setMapReady] = useState(false);

    // Use refs to access current data in event handlers
    const wageDataRef = useRef<WageData[]>([]);
    const onAreaSelectRef = useRef(onAreaSelect);

    // Keep refs in sync
    useEffect(() => {
        wageDataRef.current = wageData;
    }, [wageData]);

    useEffect(() => {
        onAreaSelectRef.current = onAreaSelect;
    }, [onAreaSelect]);

    // Handle county click - this is called from map click handler
    const handleCountyClick = useCallback((countyName: string, stateFips: string) => {
        const currentWages = wageDataRef.current;
        console.log('Looking for match in', currentWages.length, 'wage entries for', countyName);

        if (currentWages.length > 0) {
            // Try to find a matching area by county name in the area name
            const match = currentWages.find(w =>
                w.areaName.toLowerCase().includes(countyName.toLowerCase())
            );

            if (match) {
                console.log('Found match:', match);
                onAreaSelectRef.current(match);
            } else {
                // Fallback: show first area for this SOC code
                console.log('No exact match, showing first area:', currentWages[0]);
                onAreaSelectRef.current(currentWages[0]);
            }
        }
    }, []);

    // Initialize map
    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'carto-dark': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                        ],
                        tileSize: 256,
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    },
                },
                layers: [
                    {
                        id: 'carto-dark-layer',
                        type: 'raster',
                        source: 'carto-dark',
                        minzoom: 0,
                        maxzoom: 19,
                    },
                ],
            },
            center: [-98.5795, 39.8283],
            zoom: 3.5,
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Load county GeoJSON after map loads
        map.current.on('load', () => {
            // Load county boundaries from public source
            map.current!.addSource('counties', {
                type: 'geojson',
                data: 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json',
            });

            map.current!.addLayer({
                id: 'counties-fill',
                type: 'fill',
                source: 'counties',
                paint: {
                    'fill-color': '#1e293b',
                    'fill-opacity': 0.5,
                },
            });

            map.current!.addLayer({
                id: 'counties-line',
                type: 'line',
                source: 'counties',
                paint: {
                    'line-color': '#475569',
                    'line-width': 0.5,
                },
            });

            // Hover effect
            map.current!.on('mouseenter', 'counties-fill', () => {
                map.current!.getCanvas().style.cursor = 'pointer';
            });

            map.current!.on('mouseleave', 'counties-fill', () => {
                map.current!.getCanvas().style.cursor = '';
            });

            setMapReady(true);
        });

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, []);

    // Set up click handler separately so it can access current refs
    useEffect(() => {
        if (!map.current || !mapReady) return;

        const clickHandler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.GeoJSONFeature[] }) => {
            if (e.features && e.features[0]) {
                const feature = e.features[0];
                const countyName = feature.properties?.NAME || '';
                const stateFips = feature.properties?.STATE || '';
                console.log('Clicked county:', countyName, 'State FIPS:', stateFips);
                handleCountyClick(countyName, stateFips);
            }
        };

        map.current.on('click', 'counties-fill', clickHandler);

        return () => {
            map.current?.off('click', 'counties-fill', clickHandler);
        };
    }, [mapReady, handleCountyClick]);

    // Load wage data when SOC code changes
    useEffect(() => {
        if (!selectedSocCode) {
            setWageData([]);
            onAreaSelect(null);
            return;
        }

        setIsLoading(true);
        fetch(`/api/wages?soc=${encodeURIComponent(selectedSocCode)}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load wages');
                return res.json();
            })
            .then((wages: WageData[]) => {
                console.log('Loaded', wages.length, 'wage entries for SOC', selectedSocCode);
                setWageData(wages);
                setIsLoading(false);

                // Update map colors based on wages
                if (map.current && map.current.isStyleLoaded()) {
                    map.current.setPaintProperty('counties-fill', 'fill-color',
                        wages.length > 0 ? '#2563eb' : '#1e293b'
                    );
                    map.current.setPaintProperty('counties-fill', 'fill-opacity', 0.4);
                }
            })
            .catch((err) => {
                console.error('Failed to load wages:', err);
                setIsLoading(false);
            });
    }, [selectedSocCode, onAreaSelect]);

    return (
        <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-700">
            <div ref={mapContainer} className="w-full h-full" />

            {isLoading && (
                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center backdrop-blur-sm">
                    <div className="flex items-center gap-3 text-white">
                        <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Loading wage data...</span>
                    </div>
                </div>
            )}

            {!selectedSocCode && (
                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center backdrop-blur-sm">
                    <p className="text-slate-300 text-lg">Select a job title to view wage data</p>
                </div>
            )}

            {/* Info panel */}
            {selectedSocCode && wageData.length > 0 && (
                <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 border border-slate-600">
                    <h4 className="text-xs font-medium text-slate-400 mb-1">Click any county</h4>
                    <p className="text-sm text-white">{wageData.length} areas with wage data</p>
                </div>
            )}
        </div>
    );
}
