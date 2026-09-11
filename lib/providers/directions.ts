import { getApiKey } from "../store/settings";
import type { Coords, RouteResult } from "../types";

export class DirectionsError extends Error {}

/** Mapbox Directions API — requires a Mapbox token. */
export async function routeWithMapbox(origin: Coords, dest: Coords): Promise<RouteResult> {
  const token = await getApiKey("mapbox");
  if (!token) throw new DirectionsError("No Mapbox token set. Add one in Settings.");

  const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=false&access_token=${token}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new DirectionsError(`Mapbox request failed (${resp.status}).`);
  const data = await resp.json();
  const route = data?.routes?.[0];
  if (!route) throw new DirectionsError("Mapbox returned no route.");
  return { durationSeconds: route.duration, distanceMeters: route.distance };
}

/** Google Routes API — requires a Google key. */
export async function routeWithGoogle(origin: Coords, dest: Coords): Promise<RouteResult> {
  const apiKey = await getApiKey("google");
  if (!apiKey) throw new DirectionsError("No Google API key set. Add one in Settings.");

  const resp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
      travelMode: "DRIVE",
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new DirectionsError(`Google Routes request failed (${resp.status}): ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  const route = data?.routes?.[0];
  if (!route) throw new DirectionsError("Google returned no route.");
  const durationSeconds = parseFloat(String(route.duration).replace("s", ""));
  return { durationSeconds, distanceMeters: route.distanceMeters };
}

export async function route(
  provider: "mapbox" | "google",
  origin: Coords,
  dest: Coords
): Promise<RouteResult> {
  return provider === "google" ? routeWithGoogle(origin, dest) : routeWithMapbox(origin, dest);
}

export function directionsUrl(dest: Coords, label: string): string {
  const query = encodeURIComponent(`${label}@${dest.lat},${dest.lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&destination_place_id=&q=${query}`;
}
