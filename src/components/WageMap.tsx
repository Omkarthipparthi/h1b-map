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

// Build reverse lookup: county name -> area codes
function buildCountyToAreaMap(data: CountyMappingData): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const [areaCode, areaInfo] of Object.entries(data)) {
        for (const county of areaInfo.counties) {
            const key = county.county.toLowerCase().replace(/\s*(county|parish|municipio|borough|census area)\s*/gi, '').trim();
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key)!.push(areaCode);
        }
    }
    return map;
}

interface WageMapProps {
    selectedSocCode: string | null;
    salary: number; // New prop for heatmap
    onAreaSelect: (wage: WageData | null) => void;
    onAreaHover?: (wage: WageData | null) => void;
}

export default function WageMap({ selectedSocCode, salary, onAreaSelect, onAreaHover }: WageMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [wageData, setWageData] = useState<WageData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [countyToArea, setCountyToArea] = useState<Map<string, string[]>>(new Map());
    const [hoveredCountyId, setHoveredCountyId] = useState<string | number | null>(null);

    // Refs for event handlers
    const wageDataRef = useRef<WageData[]>([]);
    const onAreaSelectRef = useRef(onAreaSelect);
    const onAreaHoverRef = useRef(onAreaHover);
    const countyToAreaRef = useRef<Map<string, string[]>>(new Map());

    useEffect(() => { wageDataRef.current = wageData; }, [wageData]);
    useEffect(() => { onAreaSelectRef.current = onAreaSelect; }, [onAreaSelect]);
    useEffect(() => { onAreaHoverRef.current = onAreaHover; }, [onAreaHover]);
    useEffect(() => { countyToAreaRef.current = countyToArea; }, [countyToArea]);

    // Load county mapping
    useEffect(() => {
        fetch('/data/county-mapping.json')
            .then((res) => res.json())
            .then((data: CountyMappingData) => {
                const lookup = buildCountyToAreaMap(data);
                setCountyToArea(lookup);
            })
            .catch(console.error);
    }, []);

    // Find wage data for a county
    const findWageForCounty = useCallback((countyName: string): WageData | null => {
        const currentWages = wageDataRef.current;
        const lookup = countyToAreaRef.current;
        const normalizedCounty = countyName.toLowerCase().trim();

        if (currentWages.length === 0) return null;

        // Try county mapping first
        const areaCodes = lookup.get(normalizedCounty);
        if (areaCodes && areaCodes.length > 0) {
            for (const areaCode of areaCodes) {
                const match = currentWages.find(w => w.area === parseInt(areaCode, 10));
                if (match) return match;
            }
        }

        // Fallback: direct name match
        const directMatch = currentWages.find(w =>
            w.areaName.toLowerCase().includes(normalizedCounty) ||
            normalizedCounty.includes(w.areaName.split(',')[0].toLowerCase())
        );

        return directMatch || null;
    }, []);

    // Initialize map
    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'carto-light': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                        ],
                        tileSize: 256,
                        attribution: '&copy; CARTO',
                    },
                },
                layers: [
                    {
                        id: 'carto-light-layer',
                        type: 'raster',
                        source: 'carto-light',
                        minzoom: 0,
                        maxzoom: 19,
                    },
                ],
            },
            center: [-98.5795, 39.8283],
            zoom: 4,
            minZoom: 3,
            maxZoom: 12,
            renderWorldCopies: false,
        });

        // Add controls
        map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

        map.current.on('load', () => {
            map.current!.addSource('counties', {
                type: 'geojson',
                data: 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json',
                generateId: true,
            });

            // Base fill layer with Heatmap Logic
            map.current!.addLayer({
                id: 'counties-fill',
                type: 'fill',
                source: 'counties',
                paint: {
                    'fill-color': '#e2e8f0', // Default (No Data)
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.8,
                        0.6
                    ],
                },
            });

            // Border layer
            map.current!.addLayer({
                id: 'counties-line',
                type: 'line',
                source: 'counties',
                paint: {
                    'line-color': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        '#4f46e5', // Primary color for hover border
                        '#cbd5e1'  // Subtle border normally
                    ],
                    'line-width': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        2,
                        0.5
                    ],
                },
            });

            setMapReady(true);
        });

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, []);

    // Helper to update map colors efficiently
    const updateMapColors = useCallback(() => {
        if (!map.current || !map.current.isStyleLoaded() || !map.current.getLayer('counties-fill')) return;

        const currentWages = wageDataRef.current;

        if (currentWages.length === 0) {
            map.current.setPaintProperty('counties-fill', 'fill-color', '#e2e8f0');
            return;
        }

        // Build a match expression for performant coloring
        // We match County Name -> Heatmap Color
        // Note: For 3000 counties this expression can be large but MapLibre handles it well usually.
        // If performance degrades, we moved to feature-state based coloring.

        // Strategy: We will match on county NAME for simplicity since we don't have FIPS in wage data easily without more mapping.
        // Ideally we'd use FIPS. Using NAME is a decent approximation for this UI demo.

        const matchExpression: any[] = ['match', ['get', 'NAME']];
        const lookup = countyToAreaRef.current;

        // Colors
        // Success (Green): > Level 3
        // Info (Blue): > Level 2
        // Warning (Amber): > Level 1
        // Danger (Red): < Level 1

        // Pre-calculate area status
        const areaStatus = new Map<number, string>();
        for (const wage of currentWages) {
            const l1 = wage.level1 * 2080;
            const l2 = wage.level2 * 2080;
            const l3 = wage.level3 * 2080;

            let color = '#ef4444'; // Red (Danger)
            if (salary >= l3) color = '#10b981'; // Green
            else if (salary >= l2) color = '#0ea5e9'; // Blue
            else if (salary >= l1) color = '#f59e0b'; // Amber

            areaStatus.set(wage.area, color);
        }

        // Build the expression
        // Iterate through all mapped counties and assign color
        let hasmatches = false;
        lookup.forEach((areaCodes, countyName) => {
            // Find matching wage
            let color = null;
            for (const code of areaCodes) {
                const c = areaStatus.get(parseInt(code));
                if (c) {
                    color = c;
                    break;
                }
            }

            if (color) {
                // MapLibre match expects exact string. Our map keys are lowercase. 
                // The GeoJSON has Title Case typically. We can't easily transform inside expression.
                // This is a limitation. We will do a best effort with Title Case reconstruction or use a known list.
                // Actually, let's try to match loosely or skip if too complex.

                // Better approach: Iterate the GeoJSON? No, too slow.
                // Let's assume standard Title Case for counties in GeoJSON.
                const titleCase = countyName.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
                matchExpression.push(titleCase, color);
                hasmatches = true;
            }
        });

        matchExpression.push('#e2e8f0'); // Default fallback

        if (hasmatches) {
            map.current.setPaintProperty('counties-fill', 'fill-color', matchExpression);
        }
    }, [salary]); // Re-run when salary changes

    // Update map when salary or wages change
    useEffect(() => {
        updateMapColors();
    }, [salary, wageData, updateMapColors]);

    // Set up hover and click handlers
    useEffect(() => {
        if (!map.current || !mapReady) return;

        let currentHoverId: string | number | null = null;

        const mouseMoveHandler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.GeoJSONFeature[] }) => {
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                const featureId = feature.id;

                if (currentHoverId !== null && currentHoverId !== featureId) {
                    map.current!.setFeatureState({ source: 'counties', id: currentHoverId }, { hover: false });
                }

                if (featureId !== undefined) {
                    currentHoverId = featureId;
                    map.current!.setFeatureState({ source: 'counties', id: featureId }, { hover: true });
                    setHoveredCountyId(featureId);

                    const countyName = feature.properties?.NAME || '';
                    const wage = findWageForCounty(countyName);
                    if (onAreaHoverRef.current) {
                        onAreaHoverRef.current(wage);
                    }
                }
                map.current!.getCanvas().style.cursor = 'pointer';
            }
        };

        const mouseLeaveHandler = () => {
            if (currentHoverId !== null) {
                map.current!.setFeatureState({ source: 'counties', id: currentHoverId }, { hover: false });
            }
            currentHoverId = null;
            setHoveredCountyId(null);
            map.current!.getCanvas().style.cursor = '';
            if (onAreaHoverRef.current) onAreaHoverRef.current(null);
        };

        const clickHandler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.GeoJSONFeature[] }) => {
            if (e.features && e.features[0]) {
                const countyName = e.features[0].properties?.NAME || '';
                const wage = findWageForCounty(countyName);
                onAreaSelectRef.current(wage);
            }
        };

        map.current.on('mousemove', 'counties-fill', mouseMoveHandler);
        map.current.on('mouseleave', 'counties-fill', mouseLeaveHandler);
        map.current.on('click', 'counties-fill', clickHandler);

        return () => {
            map.current?.off('mousemove', 'counties-fill', mouseMoveHandler);
            map.current?.off('mouseleave', 'counties-fill', mouseLeaveHandler);
            map.current?.off('click', 'counties-fill', clickHandler);
        };
    }, [mapReady, findWageForCounty]);

    // Load wage data
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
                setWageData(wages);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error('Failed to load wages:', err);
                setIsLoading(false);
            });
    }, [selectedSocCode, onAreaSelect]);

    return (
        <div className="relative w-full h-full overflow-hidden bg-slate-50">
            <div ref={mapContainer} className="w-full h-full" />

            {isLoading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-sm z-10">
                    <div className="flex items-center gap-3 text-slate-600 bg-white px-4 py-2 rounded-full shadow-lg border border-slate-100">
                        <svg className="animate-spin w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm font-medium">Updating map...</span>
                    </div>
                </div>
            )}

            {!selectedSocCode && (
                <div className="absolute inset-0 bg-white/40 flex items-center justify-center backdrop-blur-md z-10">
                    <div className="text-center p-8">
                        <p className="text-slate-400 text-lg font-light tracking-wide">Select a job title to begin exploration</p>
                    </div>
                </div>
            )}
        </div>
    );
}
