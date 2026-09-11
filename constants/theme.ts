// Swiss minimalist + pastel design tokens. One place to tune the whole app's look.

export const colors = {
  bg: "#FAFAF8",
  surface: "#FFFFFF",
  border: "#E4E1D9",
  text: "#1B1C1E",
  textMuted: "#6B6D72",

  // pastel accents
  sage: "#D7E4D3",
  sageText: "#33422F",
  powder: "#D6E4EE",
  powderText: "#243B47",
  blush: "#F3DFE1",
  blushText: "#4A2A2E",

  // primary action — one muted accent
  accent: "#3E5C76",
  accentText: "#FFFFFF",

  // severity tiers: desaturated, weight carries urgency (not saturation)
  minor: { bg: "#DCEBDA", fg: "#2C4A2A", border: "#B9D3B6" },
  moderate: { bg: "#F2E6C9", fg: "#5B4A17", border: "#E0CB93" },
  severe: { bg: "#F3D9CB", fg: "#6B3218", border: "#E3B79C" },
  critical: { bg: "#EFCBC9", fg: "#6B1E1B", border: "#DC9E9A" },

  danger: "#8C2F27",
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

export const type = {
  display: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.2 },
  subtitle: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.4 },
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
