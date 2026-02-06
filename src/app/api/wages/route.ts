import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cache the wages data in memory on the server
let wagesCache: Record<string, Array<{
    area: number;
    areaName: string;
    level1: number;
    level2: number;
    level3: number;
    level4: number;
}>> | null = null;

function loadWages() {
    if (wagesCache) return wagesCache;

    const filePath = path.join(process.cwd(), 'public', 'data', 'wages.json');
    const data = fs.readFileSync(filePath, 'utf8');
    wagesCache = JSON.parse(data);
    return wagesCache;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const socCode = searchParams.get('soc');
    const areaCode = searchParams.get('area');

    if (!socCode) {
        return NextResponse.json({ error: 'SOC code is required' }, { status: 400 });
    }

    try {
        const wages = loadWages();
        if (!wages) {
            return NextResponse.json({ error: 'Wage data not available' }, { status: 500 });
        }

        const socWages = wages[socCode];
        if (!socWages) {
            return NextResponse.json({ error: 'No wage data for this SOC code' }, { status: 404 });
        }

        // If area code specified, filter to that area
        if (areaCode) {
            const areaNum = parseInt(areaCode, 10);
            const areaWage = socWages.find(w => w.area === areaNum);
            if (!areaWage) {
                return NextResponse.json({ error: 'No wage data for this area' }, { status: 404 });
            }
            return NextResponse.json(areaWage);
        }

        // Return all areas for this SOC code
        return NextResponse.json(socWages);
    } catch (error) {
        console.error('Error loading wage data:', error);
        return NextResponse.json({ error: 'Failed to load wage data' }, { status: 500 });
    }
}
