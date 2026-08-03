import assert from "node:assert/strict";
import test from "node:test";
import { darkColors, lightColors, resolveThemeMode, toggledThemeMode } from "../src/theme";

test("theme follows the system on first launch", () => {
  assert.equal(resolveThemeMode("dark"), "dark");
  assert.equal(resolveThemeMode("light"), "light");
  assert.equal(resolveThemeMode(null), "light");
});

test("theme toggle switches between complete palettes", () => {
  assert.equal(toggledThemeMode("light"), "dark");
  assert.equal(toggledThemeMode("dark"), "light");
  assert.notEqual(lightColors.background, darkColors.background);
  assert.notEqual(lightColors.surface, darkColors.surface);
  assert.ok(lightColors.heroText);
  assert.ok(darkColors.heroText);
});
