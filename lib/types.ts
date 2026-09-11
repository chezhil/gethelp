// Normalized shapes every provider adapter must return, regardless of which
// backend served the request. Downstream UI code only ever sees these.

export type SeverityTier = "minor" | "moderate" | "severe" | "critical";

export interface SeverityResult {
  severityTier: SeverityTier;
  likelyNature: string;
  recommendedAction: string;
  redFlags: string[];
  needsMoreInfo: boolean;
  clarifyingQuestion?: string; // present only if needsMoreInfo is true
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export interface NearbyFacility {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  address?: string;
  etaSeconds?: number;
  etaMeters?: number;
}

export interface RouteResult {
  durationSeconds: number;
  distanceMeters: number;
}

export interface Coords {
  lat: number;
  lng: number;
}
