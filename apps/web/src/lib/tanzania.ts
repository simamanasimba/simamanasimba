import raw from "./tanzania-locations.json";

interface District {
  name: string;
  wards: string[];
}

interface Region {
  name: string;
  districts: District[];
}

const REGIONS = raw as Region[];

export function listRegions(): string[] {
  return REGIONS.map((r) => r.name);
}

export function listDistricts(regionName: string | undefined): string[] {
  if (!regionName) return [];
  return REGIONS.find((r) => r.name === regionName)?.districts.map((d) => d.name) ?? [];
}

export function listWards(regionName: string | undefined, districtName: string | undefined): string[] {
  if (!regionName || !districtName) return [];
  const region = REGIONS.find((r) => r.name === regionName);
  return region?.districts.find((d) => d.name === districtName)?.wards ?? [];
}
