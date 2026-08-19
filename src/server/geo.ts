import type { Db } from "@/db/client";
import * as schema from "@/db/schema";

/**
 * GeoProvider adapter (docs/ARCHITECTURE.md). Google Maps (Places/Geocoding)
 * plugs in at M-launch when GOOGLE_MAPS_API_KEY exists; until then the dev
 * fallback resolves the service zone by matching the address text against the
 * zone's configured city strings — honest, labeled, never a fake API.
 */

export interface GeoResult {
  zoneId: string | null;
  zoneNameHe: string | null;
  travelCharge: number | null; // agorot; null = TBD
  travelChargeKnown: boolean;
  lat: string | null;
  lng: string | null;
  provider: "dev-city-match" | "google";
}

/** Rough zone centroids for the dev provider (real coords come from Google). */
const DEV_CENTROIDS: Record<string, { lat: string; lng: string }> = {
  "באר שבע": { lat: "31.2518", lng: "34.7913" },
  אופקים: { lat: "31.3141", lng: "34.6203" },
  חצרים: { lat: "31.2335", lng: "34.7269" },
  עומר: { lat: "31.2687", lng: "34.8481" },
  מיתר: { lat: "31.3232", lng: "34.9324" },
  כרמית: { lat: "31.3363", lng: "34.9096" },
};

export async function resolveZone(d: Db, address: string): Promise<GeoResult> {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    // Real provider lands with the API key (M-launch); never faked here.
    throw new Error("GoogleGeoProvider not implemented yet — unset GOOGLE_MAPS_API_KEY");
  }
  const zones = await d.select().from(schema.serviceZones);
  const normalized = address.replace(/[-־]/g, " ").toLowerCase().trim();
  // the city is expected as its own trailing/comma-delimited segment —
  // a street merely CONTAINING a city name (רחוב עומר...) must not match
  const cityMatches = (c: string) => {
    const city = c.toLowerCase();
    return (
      normalized === city ||
      normalized.endsWith(` ${city}`) ||
      normalized.endsWith(`,${city}`) ||
      normalized.includes(`, ${city}`) ||
      normalized.includes(`,${city},`)
    );
  };
  for (const zone of zones) {
    if (!zone.active) continue;
    const match = (zone.cityMatch ?? []).some(cityMatches);
    if (match) {
      const centroid = DEV_CENTROIDS[zone.nameHe] ?? null;
      return {
        zoneId: zone.id,
        zoneNameHe: zone.nameHe,
        travelCharge: zone.travelCharge,
        travelChargeKnown: zone.travelCharge != null,
        lat: centroid?.lat ?? null,
        lng: centroid?.lng ?? null,
        provider: "dev-city-match",
      };
    }
  }
  return {
    zoneId: null,
    zoneNameHe: null,
    travelCharge: null,
    travelChargeKnown: false,
    lat: null,
    lng: null,
    provider: "dev-city-match",
  };
}
