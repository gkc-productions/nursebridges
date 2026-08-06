import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { lightColors } from "../src/theme";

test("the product UI uses one polished light palette", () => {
  assert.equal(lightColors.background, "#F3F6F5");
  assert.equal(lightColors.surface, "#FFFFFF");
  assert.ok(lightColors.heroText);
});

test("the Patient app does not expose an in-app appearance switch", () => {
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../App.tsx"), "utf8");
  assert.doesNotMatch(source, /toggleTheme|useColorScheme|Use dark appearance|Use light appearance/);
  assert.match(source, /automaticallyAdjustKeyboardInsets/);
});
