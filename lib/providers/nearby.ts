import { getApiKey } from "../store/settings";
import type { Coords, NearbyFacility, SeverityTier } from "../types";

export class NearbyError extends Error {}

const SEARCH_RADIUS_METERS = 15000;

function haversineMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Always query the broad set — hospitals, clinics, and urgent care — rather
// than gating the query itself to hospitals-only for severe/critical. A
// hospital-only query that finds nothing nearby used to dead-end with an
// empty result; querying broadly and sorting hospitals first for high
// urgency (see nearbyWithOverpass below) means a clinic still shows up
// rather than nothing at all.
const OVERPASS_FILTER = `
  nwr["amenity"="hospital"](around:{radius},{lat},{lng});
  nwr["healthcare"="hospital"](around:{radius},{lat},{lng});
  nwr["amenity"="clinic"](around:{radius},{lat},{lng});
  nwr["healthcare"="urgent_care"](around:{radius},{lat},{lng});
`;

function isHospitalLike(tags: Record<string, string>): boolean {
  return tags.amenity === "hospital" || tags.healthcare === "hospital";
}

/** OpenStreetMap Overpass API — free, no key required. */
export async function nearbyWithOverpass(
  origin: Coords,
  tier: SeverityTier
): Promise<NearbyFacility[]> {
  const filter = OVERPASS_FILTER.replaceAll("{radius}", String(SEARCH_RADIUS_METERS))
    .replaceAll("{lat}", String(origin.lat))
    .replaceAll("{lng}", String(origin.lng));
  const query = `[out:json][timeout:20];(${filter});out center 20;`;

  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    // Overpass's edge rejects requests with React Native's default OkHttp
    // User-Agent (406 Not Acceptable) — confirmed live: identical request,
    // only the UA differs, 406 vs 200. An identifying UA fixes it, same as
    // geocoding.ts already does for Nominatim.
    headers: { "Content-Type": "text/plain", "User-Agent": "gethelp-app/1.0" },
    body: query,
  });
  if (!resp.ok) throw new NearbyError(`Overpass request failed (${resp.status}).`);
  const data = await resp.json();
  const elements: unknown[] = Array.isArray(data?.elements) ? data.elements : [];

  const seen = new Set<string>();
  const facilities: (NearbyFacility & { isHospital: boolean })[] = elements
    .map((el): (NearbyFacility & { isHospital: boolean }) | null => {
      const e = el as Record<string, unknown>;
      const lat = typeof e.lat === "number" ? e.lat : (e.center as Coords | undefined)?.lat;
      const lng = typeof e.lng === "number" ? e.lng : (e.center as Coords | undefined)?.lng;
      const tags = (e.tags as Record<string, string> | undefined) ?? {};
      if (lat == null || lng == null || !tags.name) return null;
      const id = `${e.type}/${e.id}`;
      if (seen.has(id)) return null; // a place can match more than one filter clause above
      seen.add(id);
      const dist = haversineMeters(origin, { lat, lng });
      const addressParts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean);
      return {
        id,
        name: tags.name,
        lat,
        lng,
        distanceMeters: dist,
        address: addressParts.length ? addressParts.join(" ") : undefined,
        isHospital: isHospitalLike(tags),
      };
    })
    .filter((f): f is NearbyFacility & { isHospital: boolean } => f !== null);

  const prioritizeHospitals = tier === "critical" || tier === "severe";
  facilities.sort((a, b) => {
    if (prioritizeHospitals && a.isHospital !== b.isHospital) return a.isHospital ? -1 : 1;
    return (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
  });

  return facilities.slice(0, 8).map(({ isHospital, ...f }) => f);
}

/** Google Places Nearby Search — requires a Google key. */
export async function nearbyWithGooglePlaces(
  origin: Coords,
  tier: SeverityTier
): Promise<NearbyFacility[]> {
  const apiKey = await getApiKey("google");
  if (!apiKey) throw new NearbyError("No Google API key set. Add one in Settings.");

  const includedTypes =
    tier === "critical" || tier === "severe" ? ["hospital"] : ["hospital", "doctor"];

  const resp = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.formattedAddress",
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: { latitude: origin.lat, longitude: origin.lng },
          radius: SEARCH_RADIUS_METERS,
        },
      },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new NearbyError(`Google Places request failed (${resp.status}): ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  const places: unknown[] = Array.isArray(data?.places) ? data.places : [];

  return places
    .map((p): NearbyFacility | null => {
      const pl = p as Record<string, any>;
      const lat = pl.location?.latitude;
      const lng = pl.location?.longitude;
      if (lat == null || lng == null) return null;
      return {
        id: pl.id ?? `${lat},${lng}`,
        name: pl.displayName?.text ?? "Unnamed facility",
        lat,
        lng,
        distanceMeters: haversineMeters(origin, { lat, lng }),
        address: pl.formattedAddress,
      };
    })
    .filter((f): f is NearbyFacility => f !== null)
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
}

export async function nearbyFacilities(
  provider: "overpass" | "google",
  origin: Coords,
  tier: SeverityTier
): Promise<NearbyFacility[]> {
  return provider === "google"
    ? nearbyWithGooglePlaces(origin, tier)
    : nearbyWithOverpass(origin, tier);
}
