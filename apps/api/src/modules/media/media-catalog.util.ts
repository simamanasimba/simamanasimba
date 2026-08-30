import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { MediaHostType } from "@event-intel/database";

export interface CatalogProgram {
  id: string;
  name: string;
  category?: string;
}
export interface CatalogChannel {
  id: string;
  name: string;
  type: string;
  programs?: CatalogProgram[];
}
export interface CatalogHouse {
  id: string;
  name: string;
  channels: CatalogChannel[];
}
export interface MediaCatalog {
  media_houses: CatalogHouse[];
}

export const CATALOG_TYPE_MAP: Record<string, MediaHostType> = {
  television: "TV",
  radio: "RADIO",
  online_tv: "ONLINE_TV",
  news_website: "NEWS_WEBSITE",
  newspaper: "NEWSPAPER",
  magazine: "MAGAZINE",
  blog: "BLOG",
  forum: "FORUM",
  podcast: "PODCAST",
  digital_publisher: "DIGITAL_PUBLISHER",
};

/** Reads the checked-in Media House -> Channel -> Program reference catalog. Used ONLY to
 * populate the Media/Channel/Kipindi dropdown suggestions when registering a MediaHost — never
 * to seed rows that would make catalog data look like it's already "in use." A media house from
 * here only becomes real, registered data once an admin actually picks it and saves a host. */
export function loadMediaCatalog(): MediaCatalog | null {
  const candidates = [
    join(process.cwd(), "..", "..", "data", "tanzania_media_catalog.json"),
    join(__dirname, "..", "..", "..", "..", "..", "data", "tanzania_media_catalog.json"),
    join(process.cwd(), "data", "tanzania_media_catalog.json"),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as MediaCatalog;
}
