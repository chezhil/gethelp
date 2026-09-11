// Swiss-minimalist design tokens: off-white ground, soft pastel accents, one
// muted action colour, thin hairline borders, restrained shadows. Urgency is
// carried by type weight and size rather than louder colour.

export const colors = {
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
} as const;

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
 */
export const shadow = {
  sm: { boxShadow: "0px 1px 2px rgba(27, 28, 30, 0.04)" },
  md: { boxShadow: "0px 2px 6px rgba(27, 28, 30, 0.06)" },
  lg: { boxShadow: "0px 4px 14px rgba(27, 28, 30, 0.10)" },
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
