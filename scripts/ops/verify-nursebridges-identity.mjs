import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "apps/mobile/app.config.ts",
  "docs/architecture/production-architecture.md",
  "docs/architecture/adrs/0001-product-architecture-decisions.md",
  "docs/release/production-build-plan.md",
  "docs/release/current-build-status.md",
  "docs/ops/mobile-beta-build-readiness.md"
];

const optionalNativeFiles = [
  "apps/mobile/ios/NurseBridge/Info.plist",
  "apps/mobile/ios/NurseBridge.xcodeproj/project.pbxproj"
];

const forbiddenExact = [
  "com.nursebridge.mobile",
  "production-roadmap.md"
];

const forbiddenPaths = [
  "docs/release/" + "production-roadmap.md"
];

const requiredText = new Map([
  ["apps/mobile/app.config.ts", ['slug: "nursebridges"', 'scheme: "nursebridges"', 'bundleIdentifier: "com.nursebridges.mobile"', 'package: "com.nursebridges.mobile"']],
  ["docs/architecture/production-architecture.md", ["Owner-provided app identity: nursebridges", "iOS bundle identifier: com.nursebridges.mobile"]],
  ["docs/architecture/adrs/0001-product-architecture-decisions.md", ["Decision 9: Canonical App Identity Is NurseBridges", "com.nursebridges.mobile"]],
  ["docs/release/production-build-plan.md", ["30/60/90 Production Track", "Active Risk Register", "com.nursebridges.mobile"]],
  ["docs/ops/mobile-beta-build-readiness.md", ["Expo slug and URL scheme are final for beta: `nursebridges`", "com.nursebridges.mobile"]]
]);

const optionalNativeText = new Map([
  ["apps/mobile/ios/NurseBridge/Info.plist", ["<string>nursebridges</string>", "<string>com.nursebridges.mobile</string>"]],
  ["apps/mobile/ios/NurseBridge.xcodeproj/project.pbxproj", ["PRODUCT_BUNDLE_IDENTIFIER = com.nursebridges.mobile;"]]
]);

const ignoredParts = new Set(["node_modules", ".next", "Pods", ".git", ".expo"]);
const scanRoots = ["apps/mobile", "apps/admin", "docs", "scripts"];
const selfPath = path.relative(root, process.argv[1] ?? "");

function fail(message) {
  throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function shouldIgnore(filePath) {
  return filePath.split(path.sep).some((part) => ignoredParts.has(part));
}

function collectTextFiles(dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];

  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const next = path.join(absolute, entry.name);
    if (shouldIgnore(path.relative(root, next))) continue;
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(path.relative(root, next)));
      continue;
    }
    if (/\.(css|json|md|mjs|plist|ts|tsx|yaml|yml)$/.test(entry.name) || entry.name === "project.pbxproj") {
      files.push(path.relative(root, next));
    }
  }
  return files;
}

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`${relativePath} is required for NurseBridges identity verification`);
  }
}

for (const relativePath of forbiddenPaths) {
  if (fs.existsSync(path.join(root, relativePath))) {
    fail(`${relativePath} has been replaced by docs/release/production-build-plan.md`);
  }
}

for (const [relativePath, expectedValues] of requiredText) {
  const text = read(relativePath);
  for (const expected of expectedValues) {
    if (!text.includes(expected)) {
      fail(`${relativePath} is missing expected NurseBridges identity text: ${expected}`);
    }
  }
}

for (const [relativePath, expectedValues] of optionalNativeText) {
  if (!fs.existsSync(path.join(root, relativePath))) continue;
  const text = read(relativePath);
  for (const expected of expectedValues) {
    if (!text.includes(expected)) {
      fail(`${relativePath} is missing expected NurseBridges native identity text: ${expected}`);
    }
  }
}

const presentNativeFiles = optionalNativeFiles.filter((relativePath) => fs.existsSync(path.join(root, relativePath)));

const scannedFiles = scanRoots.flatMap(collectTextFiles);
for (const relativePath of scannedFiles) {
  if (relativePath === selfPath) continue;
  const text = read(relativePath);
  for (const forbidden of forbiddenExact) {
    if (text.includes(forbidden)) {
      fail(`${relativePath} contains forbidden stale text: ${forbidden}`);
    }
  }
}

const nativeSummary =
  presentNativeFiles.length === optionalNativeFiles.length
    ? "native iOS identity checked"
    : "native iOS project not present in this checkout";

console.log(`NurseBridges identity verification passed across ${scannedFiles.length} files (${nativeSummary}).`);
