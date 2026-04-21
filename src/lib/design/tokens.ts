// Canonical design tokens for the Editorial / Cinematic theme system.
//
// Every UI surface (server + client) reads from this module instead of
// hardcoding hexes. Runtime styling reads the CSS variables defined in
// globals.css; these constants are for TS-level math (shadows, gradient
// stops, animation targets) and for documenting the contract.
//
// Brand invariant: Editorial uses the original four brand hexes
// (#101d51, #f3f3f3, #EA0C67, #007efa). Cinematic's brightened variants
// (#ff4a8d, #4da0ff) exist only for dark-mode contrast — they don't
// replace the brand, they shift it for legibility on navy ground.

export type ThemeMode = "editorial" | "cinematic";

export const THEME_MODES = ["editorial", "cinematic"] as const;

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === "editorial" || v === "cinematic";
}

export const DEFAULT_THEME_MODE: ThemeMode = "editorial";

// Density is a learner-controlled information-architecture preference on
// the dashboard only. Stored in localStorage (UI state, not a profile
// field) so it can flip instantly without a round-trip.
export type DensityMode = "focus" | "overview";
export const DEFAULT_DENSITY: DensityMode = "overview";

// Raw token values — kept here so any server component that needs to
// embed a gradient or a box-shadow can reach them without reading the
// runtime CSS. Keep in lockstep with the [data-theme] blocks in
// globals.css.
export const editorial = {
  bg: "#f3f0e8",
  paper: "#faf7ee",
  ink: "#101d51",
  inkSoft: "rgba(16,29,81,.65)",
  inkFaint: "rgba(16,29,81,.4)",
  rule: "rgba(16,29,81,.14)",
  accent: "#EA0C67",
  accentSoft: "rgba(234,12,103,.12)",
  blue: "#007efa",
} as const;

export const cinematic = {
  bg: "#070a1c",
  paper: "rgba(255,255,255,.04)",
  ink: "rgba(255,255,255,.95)",
  inkSoft: "rgba(255,255,255,.65)",
  inkFaint: "rgba(255,255,255,.4)",
  rule: "rgba(255,255,255,.08)",
  accent: "#ff4a8d",
  accentSoft: "rgba(234,12,103,.2)",
  blue: "#4da0ff",
} as const;

export const tokens = { editorial, cinematic } as const;
