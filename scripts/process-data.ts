import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'data');

interface WageRecord {
  Area: string;
  SocCode: string;
  GeoLvl: string;
  Level1: string;
  Level2: string;
  Level3: string;
  Level4: string;
  Average: string;
  Label: string;
}

interface GeographyRecord {
  Area: string;
  AreaName: string;
  StateAb: string;
  State: string;
  CountyTownName: string;
}

interface SocRecord {
  soccode: string;
  Title: string;
  Description: string;
}

interface ProcessedWage {
  area: number;
  areaName: string;
  level1: number;
  level2: number;
  level3: number;
  level4: number;
}

interface SocCodeData {
  code: string;
  title: string;
  description: string;
}

interface WagesOutput {
  [socCode: string]: ProcessedWage[];
}

interface CountyMapping {
  [areaCode: string]: {
    name: string;
    counties: Array<{ county: string; state: string; stateAb: string }>;
  };
}

function parseCSV<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    Papa.parse<T>(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error: Error) => reject(error),
    });
  });
}

async function processData() {
  console.log('Starting data processing...');

  // Ensure output directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  // Parse all CSV files
  console.log('Parsing ALC_Export.csv...');
  const wages = await parseCSV<WageRecord>(path.join(DATA_DIR, 'ALC_Export.csv'));
  console.log(`  Loaded ${wages.length} wage records`);

  console.log('Parsing Geography.csv...');
  const geography = await parseCSV<GeographyRecord>(path.join(DATA_DIR, 'Geography.csv'));
  console.log(`  Loaded ${geography.length} geography records`);

  console.log('Parsing oes_soc_occs.csv...');
  const socCodes = await parseCSV<SocRecord>(path.join(DATA_DIR, 'oes_soc_occs.csv'));
  console.log(`  Loaded ${socCodes.length} SOC codes`);

  // Build area name lookup from geography
  const areaNameMap = new Map<string, string>();
  const countyMapping: CountyMapping = {};

  for (const geo of geography) {
    if (!areaNameMap.has(geo.Area)) {
      areaNameMap.set(geo.Area, geo.AreaName);
      countyMapping[geo.Area] = {
        name: geo.AreaName,
        counties: [],
      };
    }
    countyMapping[geo.Area].counties.push({
      county: geo.CountyTownName,
      state: geo.State,
      stateAb: geo.StateAb,
    });
  }

  // Process wages by SOC code
  console.log('Processing wages by SOC code...');
  const wagesOutput: WagesOutput = {};

  for (const wage of wages) {
    if (!wage.SocCode || !wage.Area) continue;

    const socCode = wage.SocCode.trim();
    const areaCode = wage.Area.trim();

    if (!wagesOutput[socCode]) {
      wagesOutput[socCode] = [];
    }

    // Parse hourly rates and convert to numbers
    const level1 = parseFloat(wage.Level1) || 0;
    const level2 = parseFloat(wage.Level2) || 0;
    const level3 = parseFloat(wage.Level3) || 0;
    const level4 = parseFloat(wage.Level4) || 0;

    wagesOutput[socCode].push({
      area: parseInt(areaCode, 10),
      areaName: areaNameMap.get(areaCode) || 'Unknown Area',
      level1,
      level2,
      level3,
      level4,
    });
  }

  // Process SOC codes for search
  console.log('Processing SOC codes...');
  const socOutput: SocCodeData[] = socCodes.map((soc) => ({
    code: soc.soccode,
    title: soc.Title,
    description: soc.Description,
  }));

  // Write output files
  console.log('Writing wages.json...');
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'wages.json'),
    JSON.stringify(wagesOutput),
    'utf8'
  );

  console.log('Writing soc-codes.json...');
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'soc-codes.json'),
    JSON.stringify(socOutput),
    'utf8'
  );

  console.log('Writing county-mapping.json...');
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'county-mapping.json'),
    JSON.stringify(countyMapping),
    'utf8'
  );

  console.log('\\nData processing complete!');
  console.log(`  - ${Object.keys(wagesOutput).length} SOC codes with wage data`);
  console.log(`  - ${socOutput.length} searchable SOC codes`);
  console.log(`  - ${Object.keys(countyMapping).length} area/county mappings`);
}

processData().catch(console.error);
