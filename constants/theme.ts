// Swiss-minimalist design tokens: quiet ground, soft pastel accents, one
// muted action colour, thin hairline borders, restrained shadows. Urgency is
// carried by type weight and size rather than louder colour.
//
// Two palettes, same token names. Components never import a palette directly
// — they take one as an argument (see `useThemedStyles` in lib/store/theme),
// so a theme change restyles the app without any screen knowing which theme
// it is on.

export const lightColors = {
  bg: "#FAFAF8", // off-white — not stark white, not cream
  surface: "#FFFFFF",
  border: "#E4E1D9",
  text: "#1B1C1E",
  textMuted: "#6B6D72",

  // Soft pastel accents. Names are kept generic so screens can pick a tint
  // without knowing the palette's provenance.
  yellow: "#F3EAD0",
  lime: "#DDE8D8",
  cyan: "#DCE7EE",
  pink: "#F2E2E4",
  orange: "#F4E2D4",

  // One muted accent carries every primary action.
  accent: "#3E5C76",
  accentText: "#FFFFFF",

  // Severity tiers: desaturated throughout, so "critical" still belongs to
  // the same palette. The badge grows and thickens at severe/critical
  // (see SeverityBadge) — weight does the shouting, not saturation.
  minor: { bg: "#DCEBDA", fg: "#2C4A2A", border: "#BFD5BC" },
  moderate: { bg: "#F2E6C9", fg: "#5B4A17", border: "#E1CE9A" },
  severe: { bg: "#F3D9CB", fg: "#6B3218", border: "#E2BCA3" },
  critical: { bg: "#EFCBC9", fg: "#6B1E1B", border: "#DFA9A5" },

  danger: "#8C2F27",
  dangerText: "#FFFFFF",
};

/**
 * The same design, at low luminance.
 *
 * Not an inversion: the pastels become deep tints of the same hues rather
 * than flipping to their complements, so a section that reads "calm green"
 * in daylight still reads calm at night. Text sits at #F2F1EE rather than
 * pure white — full-white on near-black glares, especially on the phone
 * screen someone actually reaches for in the dark, which is the whole point
 * of this mode existing in an injury app.
 */
export const darkColors: typeof lightColors = {
  bg: "#121316",
  surface: "#1B1D21",
  border: "#2F323A",
  text: "#F2F1EE",
  textMuted: "#9A9DA4",

  yellow: "#332D1E",
  lime: "#25301F",
  cyan: "#1E2C34",
  pink: "#33232A",
  orange: "#352719",

  // Accent and its text swap roles: a pale slate on dark, with dark type on
  // top, keeps primary buttons the brightest thing on the screen.
  accent: "#7FA6CC",
  accentText: "#0E1318",

  minor: { bg: "#1F2E1D", fg: "#B9D9B4", border: "#32492E" },
  moderate: { bg: "#332C18", fg: "#E8D08C", border: "#4E432A" },
  severe: { bg: "#3A2418", fg: "#F0BA9B", border: "#56392A" },
  critical: { bg: "#3A1C1B", fg: "#F3A9A4", border: "#57302E" },

  // White on red, as in light mode: the emergency CTA is the one element that
  // must never be the marginal-contrast thing on the screen, and dark type on
  // this red came out just under AA.
  danger: "#B0443A",
  dangerText: "#FFFFFF",
};

export type Colors = typeof lightColors;

/**
 * The light palette, for the few places that need a colour outside a themed
 * component — module-scope defaults and the Static Maps marker URLs.
 * Anything rendered should use `useTheme()` instead.
 */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

/**
 * Max width of the content column. On a phone the screen is narrower than
 * this so it simply fills the width; on a desktop browser it stops the
 * layout stretching across the whole monitor.
 */
export const CONTENT_MAX_WIDTH = 640;

// Hairlines. `thick` is still only 2px — it marks the one element that has
// to dominate (the emergency CTA), without turning into a frame.
export const border = {
  width: 1,
  thick: 2,
} as const;

/**
 * Soft, low-contrast elevation — barely there, and only where depth is
 * functional. `boxShadow` works on both native (RN 0.76+) and web.
 *
 * Deliberately shared between themes: on the dark palette these all but
 * disappear, which is correct. Depth on a dark ground comes from the
 * surface/background lightness step, not from a drop shadow.
 */
export const shadow = {
  sm: { boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.06)" },
  md: { boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.08)" },
  lg: { boxShadow: "0px 4px 14px rgba(0, 0, 0, 0.14)" },
  none: { boxShadow: "0px 0px 0px rgba(0, 0, 0, 0)" },
} as const;

export const type = {
  display: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.2 },
  subtitle: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  label: {
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
};

export type SeverityTier = "minor" | "moderate" | "severe" | "critical";

export const severityLabel: Record<SeverityTier, string> = {
  minor: "Minor",
  moderate: "Moderate",
  severe: "Severe",
  critical: "Critical",
};

export const severityAction: Record<SeverityTier, string> = {
  minor: "Self-care at home should be enough",
  moderate: "Seeking urgent care is recommended",
  severe: "Seeking emergency room care is recommended",
  critical: "Calling an ambulance is recommended",
};
