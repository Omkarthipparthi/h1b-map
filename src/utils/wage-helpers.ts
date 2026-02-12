export interface WageData {
    area: number;
    areaName: string;
    level1: number;
    level2: number;
    level3: number;
    level4: number;
}

export interface AreaMapping {
    name: string;
    counties: {
        county: string;
        state: string;
        stateAb: string;
    }[];
}

export interface CountyMappingData {
    [areaCode: string]: AreaMapping;
}

// Map State Abbreviation to FIPS Code
export const STATE_FIPS: { [key: string]: string } = {
    'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10', 'DC': '11',
    'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20', 'KY': '21',
    'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29', 'MT': '30',
    'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39',
    'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49',
    'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55', 'WY': '56',
    'PR': '72' // Puerto Rico
};

// Build reverse lookup: county name -> area codes
// Key format: "normalized_name::state_fips"
export function buildCountyToAreaMap(data: CountyMappingData): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const [areaCode, areaInfo] of Object.entries(data)) {
        for (const county of areaInfo.counties) {
            const name = county.county.toLowerCase().replace(/\s*(county|parish|municipio|borough|census area)\s*/gi, '').trim();
            const fips = STATE_FIPS[county.stateAb];

            // Store by specific key including state to handle duplicates (e.g. Orange County)
            if (fips) {
                const key = `${name}::${fips}`;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(areaCode);
            }
        }
    }
    return map;
}
