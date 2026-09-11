// Normalized shapes every provider adapter must return, regardless of which
// backend served the request. Downstream UI code only ever sees these.

export type SeverityTier = "minor" | "moderate" | "severe" | "critical";

export interface SeverityResult {
  severityTier: SeverityTier;
  likelyNature: string;
  /** 2-3 plain-language sentences on what might be going on and why — urgency/routing framing, never a diagnosis. */
  summary: string;
  recommendedAction: string;
  redFlags: string[];
  /**
   * A place the user named in their own words ("at Indiranagar", "near MG
   * Road"), if any. Takes precedence over GPS — if someone says where they
   * are, believe them.
   */
  locationMentioned?: string;
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
