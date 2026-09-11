// Which number the "Call emergency services" button actually dials.
//
// This was hardcoded to 112, which is right across India and the EU and
// wrong in most of the Americas and much of Asia — an app that exists to get
// an injured person to help faster cannot dial a dead number.
//
// Two deliberate safety properties, because region detection can be wrong
// (a traveller's phone, a VPN, a browser reporting the wrong locale):
//
//  1. The number is shown on the button, so it can be read before it is
//     tapped rather than discovered afterwards.
//  2. Anything not listed falls back to 112, which GSM networks route to
//     local emergency services almost everywhere, including in countries
//     with a different primary number.
//
// Numbers are the *medical/ambulance* line where a country separates it from
// police and fire — this app is only ever called about an injury.

/** Regions whose emergency number is not 112. */
const BY_REGION: Record<string, string> = {
  // Americas
  US: "911",
  CA: "911",
  MX: "911",
  BR: "192",
  AR: "107",
  CL: "131",
  CO: "123",

  // United Kingdom and Ireland (999 and 112 both work in both; 999 is the
  // one people know in the UK)
  GB: "999",

  // Asia-Pacific
  AU: "000",
  NZ: "111",
  JP: "119",
  KR: "119",
  TW: "119",
  CN: "120",
  HK: "999",
  SG: "995",
  MY: "999",
  TH: "1669",
  VN: "115",
  PH: "911",
  BD: "999",
  PK: "1122",
  LK: "1990",
  NP: "102",

  // Middle East and Africa
  IL: "101",
  AE: "998",
  SA: "997",
  EG: "123",
  ZA: "10177",
  KE: "999",
};

/**
 * 112 is both the EU standard and India's unified emergency number, and is
 * reachable from a GSM handset in most of the world — so it is the right
 * answer for an unrecognized region, not merely a safe-looking one.
 */
export const DEFAULT_EMERGENCY_NUMBER = "112";

/**
 * The country out of a bare region code or a full locale tag.
 *
 * In BCP-47 the first subtag is the language and the region comes later, so
 * "en-US" is US while a lone "US" is itself — reading position 0 in both
 * cases resolved "en-US" on "EN" and quietly handed back the default.
 * A region subtag is two letters or three digits; a script subtag ("Hans")
 * is four, and must not be mistaken for one.
 */
function regionOf(tag: string): string {
  const parts = tag.trim().toUpperCase().split(/[-_]/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const region = parts.slice(1).find((p) => /^([A-Z]{2}|\d{3})$/.test(p));
  if (region) return region;
  // No region subtag: "GB-SCT" is a country plus a variant, so fall back to
  // the leading subtag when it is shaped like a country.
  return /^[A-Z]{2}$/.test(parts[0]) ? parts[0] : "";
}

/** The emergency number for a region code ("US", "in") or locale ("en-US"). */
export function emergencyNumberFor(region?: string | null): string {
  if (!region) return DEFAULT_EMERGENCY_NUMBER;
  return BY_REGION[regionOf(region)] ?? DEFAULT_EMERGENCY_NUMBER;
}

/**
 * The device's region, or undefined when nothing reports one.
 *
 * Everything here is wrapped: a browser can throw on Intl construction with
 * an odd locale, and React Native has no `navigator.language` on every
 * platform. Failing to detect must degrade to 112, never to a crash on the
 * one screen someone is looking at while injured.
 */
export function detectRegion(): string | undefined {
  try {
    const locale = (Intl.DateTimeFormat().resolvedOptions() as { locale?: string }).locale;
    const region = locale ? regionOf(locale) : "";
    if (region) return region;
  } catch {
    // Intl unavailable or threw on an odd locale — fall through.
  }
  try {
    const lang = (globalThis as { navigator?: { language?: string } }).navigator?.language;
    const region = lang ? regionOf(lang) : "";
    if (region) return region;
  } catch {
    // No navigator (native, or a locked-down browser).
  }
  return undefined;
}

/** The number to dial on this device. */
export function localEmergencyNumber(): string {
  return emergencyNumberFor(detectRegion());
}
