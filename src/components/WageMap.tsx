import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AreaMapping, CountyMappingData, STATE_FIPS, buildCountyToAreaMap, WageData } from '../utils/wage-helpers';

export interface WageSelection {
    wage: WageData | null;
    county: string;
    state: string;
}

interface WageMapProps {
    selectedSocCode: string | null;
    salary: number; // New prop for heatmap
    focusedCounties?: string[]; // Array of "CountyName::StateAb"
    onAreaSelect: (selection: WageSelection) => void;
    onAreaHover?: (selection: WageSelection) => void;
}

export default function WageMap({ selectedSocCode, salary, focusedCounties = [], onAreaSelect, onAreaHover }: WageMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [wageData, setWageData] = useState<WageData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [countyToArea, setCountyToArea] = useState<Map<string, string[]>>(new Map());
    const [hoveredCountyId, setHoveredCountyId] = useState<string | number | null>(null);

    // Store loaded GeoJSON features for zooming
    const geoJsonFeatures = useRef<any[]>([]);

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

        // Fetch GeoJSON explicitly to have access to features for zooming
        fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json')
            .then(res => res.json())
            .then(data => {
                if (data && data.features) {
                    geoJsonFeatures.current = data.features;
                }
            })
            .catch(console.error);
    }, []);

    // Handle zooming to focused counties
    useEffect(() => {
        if (!map.current || !focusedCounties || focusedCounties.length === 0 || geoJsonFeatures.current.length === 0) return;

        const bounds = new maplibregl.LngLatBounds();
        let found = false;

        // Parse focusedCounties: "CountyName::StateAb"
        // Normalize for comparison
        const targets = focusedCounties.map(fc => {
            const parts = fc.split('::');
            if (parts.length < 2) return null;
            return {
                name: parts[0].toLowerCase().replace(/\s*(county|parish|municipio|borough|census area)\s*/gi, '').trim(),
                stateFips: STATE_FIPS[parts[1]] || ''
            };
        }).filter(t => t !== null && t.stateFips);

        if (targets.length === 0) return;

        for (const feature of geoJsonFeatures.current) {
            const featureName = (feature.properties.NAME || '').toLowerCase();
            const featureState = feature.properties.STATE;

            // Check if feature matches any target
            for (const target of targets) {
                if (target && featureState === target.stateFips && featureName === target.name) {
                    if (feature.geometry.type === 'Polygon') {
                        feature.geometry.coordinates.forEach((ring: any[]) => {
                            ring.forEach((coord: any[]) => {
                                bounds.extend(coord as [number, number]);
                            });
                        });
                    } else if (feature.geometry.type === 'MultiPolygon') {
                        feature.geometry.coordinates.forEach((polygon: any[]) => {
                            polygon.forEach((ring: any[]) => {
                                ring.forEach((coord: any[]) => {
                                    bounds.extend(coord as [number, number]);
                                });
                            });
                        });
                    }
                    found = true;
                }
            }
        }

        if (found) {
            map.current.fitBounds(bounds, {
                padding: { top: 50, bottom: 50, left: 350, right: 50 }, // Padding for sidebar (left)
                maxZoom: 10
            });
        }

    }, [focusedCounties, mapReady]); // Depend on mapReady to ensure map exists

    // Find wage data for a county
    const findWageForCounty = useCallback((countyName: string, stateFips?: string): WageData | null => {
        const currentWages = wageDataRef.current;
        const lookup = countyToAreaRef.current;
        const normalizedCounty = countyName.toLowerCase().trim();

        if (currentWages.length === 0) return null;

        // Try composite key first (Name::FIPS)
        let areaCodes: string[] | undefined;
        if (stateFips) {
            areaCodes = lookup.get(`${normalizedCounty}::${stateFips}`);
        }

        if (areaCodes && areaCodes.length > 0) {
            for (const areaCode of areaCodes) {
                const match = currentWages.find(w => w.area === parseInt(areaCode, 10));
                if (match) return match;
            }
        }

        return null;
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
        map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

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

        const matchExpression: any[] = ['match', ['get', 'NAME']];
        const lookup = countyToAreaRef.current;

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

        // Group colors by County Name -> Array of { stateFips, color }
        const nameGroups = new Map<string, Array<{ fips: string, color: string }>>();

        lookup.forEach((areaCodes, key) => {
            // key is "normalized_name::stateFips"
            const parts = key.split('::');
            const name = parts[0];
            const fips = parts[1]; // might be undefined if key format is wrong, but we enforce it now

            if (!name || !fips) return;

            // Find matching wage color
            let color = null;
            for (const code of areaCodes) {
                const c = areaStatus.get(parseInt(code));
                if (c) {
                    color = c;
                    break;
                }
            }

            if (color) {
                const titleCase = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));

                if (!nameGroups.has(titleCase)) {
                    nameGroups.set(titleCase, []);
                }
                nameGroups.get(titleCase)!.push({ fips, color });
            }
        });

        // Build the expression
        let hasmatches = false;

        nameGroups.forEach((entries, name) => {
            if (entries.length === 1) {
                // Simple case: unique name
                matchExpression.push(name, entries[0].color);
            } else {
                // Collision case: multiple states have this county name
                // Use nested match on STATE
                const stateMatch: any[] = ['match', ['get', 'STATE']];

                // Add branches for each state FIPS
                entries.forEach(entry => {
                    stateMatch.push(entry.fips, entry.color);
                });

                // Default color for this name if state doesn't match known ones (shouldn't happen)
                stateMatch.push('#e2e8f0');

                matchExpression.push(name, stateMatch);
            }
            hasmatches = true;
        });

        matchExpression.push('#e2e8f0'); // Default fallback for unknown names

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
            // Disable hover on touch devices/mobile to prevent "flashing" behavior
            if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768) return;

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
                    const stateFips = feature.properties?.STATE || ''; // Get state FIPS

                    const wage = findWageForCounty(countyName, stateFips);
                    if (onAreaHoverRef.current) {
                        onAreaHoverRef.current({ wage, county: countyName, state: stateFips });
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
            if (onAreaHoverRef.current) onAreaHoverRef.current({ wage: null, county: '', state: '' });
        };

        const clickHandler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.GeoJSONFeature[] }) => {
            if (e.features && e.features.length > 0) {
                const countyName = e.features[0].properties?.NAME || '';
                const stateFips = e.features[0].properties?.STATE || '';
                const wage = findWageForCounty(countyName, stateFips);

                onAreaSelectRef.current({ wage, county: countyName, state: stateFips });
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
            onAreaSelect({ wage: null, county: '', state: '' });
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
