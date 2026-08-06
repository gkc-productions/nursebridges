export const lightColors = {
  background: "#F3F6F5", surface: "#FFFFFF", surfaceMuted: "#EAF0EE", border: "#DCE5E1",
  borderStrong: "#AABAB4", ink: "#101715", inkSoft: "#26332F", muted: "#65736E",
  mutedSoft: "#899691", accent: "#087E73", accentDark: "#055F58", accentMuted: "#D9F3EE",
  blue: "#315DB4", blueMuted: "#E4EBFA", warning: "#9A5800", warningMuted: "#FFF1D8",
  danger: "#A83226", dangerMuted: "#FBE4E1", success: "#116A43", successMuted: "#DEF2E8",
  hero: "#0C1B23", heroSurface: "#172A34", heroBorder: "#304752", heroText: "#FFFFFF",
  heroMuted: "#B9C8CE", onAccent: "#FFFFFF"
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };
export const colors = lightColors;
