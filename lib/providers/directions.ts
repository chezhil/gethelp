import { getApiKey } from "../store/settings";
import type { Coords, RouteResult } from "../types";

export class DirectionsError extends Error {}

/**
 * OSRM's public demo routing server — free, no key, no billing setup.
 * It's a shared demo instance (not for heavy production traffic), but it's
 * the right default for a hackathon build: zero setup between install and a
 * working ETA. Mapbox/Google remain available as BYOK alternates in Settings
 * for anyone who wants a production-grade routing backend.
 */
export async function routeWithOSRM(origin: Coords, dest: Coords): Promise<RouteResult> {
  const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;
  const resp = await fetch(url, { headers: { "User-Agent": "gethelp-app/1.0" } });
  if (!resp.ok) throw new DirectionsError(`OSRM request failed (${resp.status}).`);
  const data = await resp.json();
  const route = data?.routes?.[0];
  if (!route) throw new DirectionsError("OSRM returned no route.");
  return { durationSeconds: route.duration, distanceMeters: route.distance };
}

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
  provider: "osrm" | "mapbox" | "google",
  origin: Coords,
  dest: Coords
): Promise<RouteResult> {
  if (provider === "google") return routeWithGoogle(origin, dest);
  if (provider === "mapbox") return routeWithMapbox(origin, dest);
  return routeWithOSRM(origin, dest);
}

export function directionsUrl(dest: Coords, label: string): string {
  const query = encodeURIComponent(`${label}@${dest.lat},${dest.lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&destination_place_id=&q=${query}`;
}
