import { getApiKey } from "../store/settings";
import type { Coords, NearbyFacility, SeverityTier } from "../types";
import { describeHttpError, fetchWithRetry } from "./http";

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

/** Google Places Nearby Search — requires a Google key. */
export async function nearbyWithGooglePlaces(
  origin: Coords,
  tier: SeverityTier
): Promise<NearbyFacility[]> {
  const apiKey = await getApiKey("google");
  if (!apiKey) {
    throw new NearbyError(
      "Finding nearby hospitals needs a Google API key. Add one under Nearby Search in Settings."
    );
  }

  const includedTypes =
    tier === "critical" || tier === "severe" ? ["hospital"] : ["hospital", "doctor"];

  const resp = await fetchWithRetry("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.formattedAddress,places.nationalPhoneNumber",
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
  }, { service: "Google Places" });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new NearbyError(describeHttpError("Google Places", resp.status, body, "Google API key"));
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
        phone: pl.nationalPhoneNumber,
      };
    })
    .filter((f): f is NearbyFacility => f !== null)
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
}

export async function nearbyFacilities(
  provider: "google",
  origin: Coords,
  tier: SeverityTier
): Promise<NearbyFacility[]> {
  return nearbyWithGooglePlaces(origin, tier);
}
