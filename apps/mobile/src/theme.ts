export const lightColors = {
  background: "#F3F6F5", surface: "#FFFFFF", surfaceMuted: "#EAF0EE", border: "#DCE5E1",
  borderStrong: "#AABAB4", ink: "#101715", inkSoft: "#26332F", muted: "#65736E",
  mutedSoft: "#899691", accent: "#087E73", accentDark: "#055F58", accentMuted: "#D9F3EE",
  blue: "#315DB4", blueMuted: "#E4EBFA", warning: "#9A5800", warningMuted: "#FFF1D8",
  danger: "#A83226", dangerMuted: "#FBE4E1", success: "#116A43", successMuted: "#DEF2E8",
  hero: "#0C1B23", heroSurface: "#172A34", heroBorder: "#304752", heroText: "#FFFFFF",
  heroMuted: "#B9C8CE", onAccent: "#FFFFFF"
} as const;

export const darkColors = {
  background: "#090F0D", surface: "#131B18", surfaceMuted: "#1B2521", border: "#293731",
  borderStrong: "#43564F", ink: "#F5F9F7", inkSoft: "#D5DFDB", muted: "#9DAAA5",
  mutedSoft: "#74817C", accent: "#42C9B8", accentDark: "#B7FFF4", accentMuted: "#173D38",
  blue: "#8EACF3", blueMuted: "#1C2C50", warning: "#F5B65C", warningMuted: "#3D2C13",
  danger: "#FF9A88", dangerMuted: "#451F1A", success: "#72D9A8", successMuted: "#163A29",
  hero: "#0D1513", heroSurface: "#18241F", heroBorder: "#31433C", heroText: "#F7FBF9",
  heroMuted: "#AEBDB7", onAccent: "#071512"
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };
export type ThemeMode = "light" | "dark";
export const colors = lightColors;

export function resolveThemeMode(systemScheme: "light" | "dark" | null | undefined): ThemeMode {
  return systemScheme === "dark" ? "dark" : "light";
}

export function toggledThemeMode(mode: ThemeMode): ThemeMode {
  return mode === "dark" ? "light" : "dark";
}
