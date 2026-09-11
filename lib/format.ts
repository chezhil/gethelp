// Turning provider numbers into the words shown on a card.
//
// Shared rather than per-screen: the facility list and the history list quote
// the same ETA for the same trip, and two copies of the rounding drifted apart
// once already (one showed "75 min" where the other showed "1 h 15 min").

/**
 * A driving time, as someone would say it out loud.
 * Returns null when there is no ETA — the caller decides what to show instead,
 * since a list row and a card want different placeholders.
 */
export function formatEta(seconds?: number): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Straight-line distance, in the unit that reads naturally at that scale. */
export function formatDistance(meters?: number): string {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return "";
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/**
 * A Google Maps directions link to one facility.
 *
 * Coordinates, not the name, as the destination: hospital names repeat across
 * a city, and sending someone to the wrong branch is the one failure this
 * link cannot afford. `travelmode=driving` matches the ETA on the card it
 * sits under.
 *
 * The previous form sent an empty `destination_place_id` and a `q` parameter
 * borrowed from the /maps/search endpoint — `dir` defines neither, and an
 * empty place id is not a valid value for the one parameter it does define.
 *
 * Lives here rather than in providers/directions.ts so it is reachable from
 * the test runner: that module imports the settings store, and so react-native.
 */
export function directionsUrl(dest: { lat: number; lng: number }): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${dest.lat},${dest.lng}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
