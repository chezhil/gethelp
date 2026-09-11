import { getApiKey } from "../store/settings";
import type { GeocodeResult } from "../types";
import { describeHttpError, fetchWithRetry } from "./http";

export class GeocodingError extends Error {}

/** OpenStreetMap Nominatim — free, no key required. */
export async function geocodeWithNominatim(query: string): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    query
  )}`;
  const resp = await fetchWithRetry(
    url,
    { headers: { "User-Agent": "gethelp-app/1.0" } },
    { service: "the address lookup" }
  );
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new GeocodingError(describeHttpError("The address lookup", resp.status, body));
  }
  const data = await resp.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new GeocodingError(
      `Couldn't find "${query}". Try a nearby landmark, area or postcode instead.`
    );
  }
  const hit = data[0];
  return {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    displayName: hit.display_name,
  };
}

/** Google Geocoding API — requires a Google key. */
export async function geocodeWithGoogle(query: string): Promise<GeocodeResult> {
  const apiKey = await getApiKey("google");
  if (!apiKey) throw new GeocodingError("No Google API key set. Add one in Settings.");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    query
  )}&key=${apiKey}`;
  const resp = await fetchWithRetry(url, {}, { service: "Google Geocoding" });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new GeocodingError(
      describeHttpError("Google Geocoding", resp.status, body, "Google API key")
    );
  }
  const data = await resp.json();
  const hit = data?.results?.[0];
  if (!hit) {
    throw new GeocodingError(
      `Couldn't find "${query}". Try a nearby landmark, area or postcode instead.`
    );
  }
  return {
    lat: hit.geometry.location.lat,
    lng: hit.geometry.location.lng,
    displayName: hit.formatted_address,
  };
}

export async function geocode(
  provider: "nominatim" | "google",
  query: string
): Promise<GeocodeResult> {
  return provider === "google" ? geocodeWithGoogle(query) : geocodeWithNominatim(query);
}
