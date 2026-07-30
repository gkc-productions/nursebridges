import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const bundleId = "com.nursebridges.mobile";
const scheme = "NurseBridge";
const workspace = "ios/NurseBridge.xcworkspace";

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

function section(title) {
  console.log(`\n${title}`);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.log(`FAIL ${message}`);
}

function warn(message) {
  console.log(`WARN ${message}`);
}

let failures = 0;

function requireCheck(condition, message) {
  if (condition) {
    pass(message);
  } else {
    failures += 1;
    fail(message);
  }
}

section("NurseBridges iOS Installed-Build Preflight");
console.log(`Bundle identifier: ${bundleId}`);
console.log("Mode: read-only; no build, EAS, TestFlight, or credential mutation is performed.");

section("Source");
requireCheck(exists(workspace), `${workspace} exists`);
requireCheck(exists("ios/NurseBridge.xcodeproj/project.pbxproj"), "Xcode project exists");
requireCheck(exists("app.config.ts"), "Expo app config exists");

const appConfig = exists("app.config.ts") ? fs.readFileSync("app.config.ts", "utf8") : "";
const projectFile = exists("ios/NurseBridge.xcodeproj/project.pbxproj")
  ? fs.readFileSync("ios/NurseBridge.xcodeproj/project.pbxproj", "utf8")
  : "";
requireCheck(appConfig.includes('slug: "nursebridges"'), "Expo slug is nursebridges");
requireCheck(appConfig.includes('scheme: "nursebridges"'), "Expo scheme is nursebridges");
requireCheck(appConfig.includes(`bundleIdentifier: "${bundleId}"`), `iOS bundle identifier is ${bundleId}`);
requireCheck(appConfig.includes(`package: "${bundleId}"`), `Android package is ${bundleId}`);
requireCheck(projectFile.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`), `Xcode project file uses ${bundleId}`);
requireCheck(projectFile.includes("DEVELOPMENT_TEAM = R2N3CHKSBB;"), "Xcode project file uses DEVELOPMENT_TEAM = R2N3CHKSBB");

section("Xcode");
const xcodeVersion = run("xcodebuild", ["-version"]).trim();
if (xcodeVersion) {
  pass(`xcodebuild is available: ${xcodeVersion.split("\n").join(" / ")}`);
} else {
  failures += 1;
  fail("xcodebuild is not available");
}

if (exists(workspace)) {
  const settings = run("xcodebuild", [
    "-workspace",
    workspace,
    "-scheme",
    scheme,
    "-configuration",
    "Release",
    "-destination",
    "generic/platform=iOS",
    "-showBuildSettings"
  ]);

  if (settings.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${bundleId}`)) {
    pass(`Xcode build settings report ${bundleId}`);
  } else {
    warn("xcodebuild did not return readable build settings in this shell; project file identity checks above are authoritative for this preflight");
  }

  if (settings.includes("DEVELOPMENT_TEAM = R2N3CHKSBB")) {
    pass("Xcode build settings report DEVELOPMENT_TEAM = R2N3CHKSBB");
  } else {
    warn("xcodebuild did not report DEVELOPMENT_TEAM = R2N3CHKSBB in this shell");
  }
}

section("Connected Device");
const devices = run("xcrun", ["xctrace", "list", "devices"]);
const physicalDeviceLines = devices
  .split("\n")
  .filter((line) => /\([0-9A-F-]{25,}\)/i.test(line) && !line.includes("Simulator"));

requireCheck(physicalDeviceLines.length > 0, "At least one physical iPhone/iPad is visible to Xcode");
for (const line of physicalDeviceLines) {
  console.log(`  ${line.trim()}`);
}

section("Signing");
const identities = run("security", ["find-identity", "-v", "-p", "codesigning"]);
const validIdentityMatch = identities.match(/(\d+) valid identities found/);
const validIdentityCount = validIdentityMatch ? Number(validIdentityMatch[1]) : 0;
requireCheck(validIdentityCount > 0, "At least one valid code-signing identity is installed");

const profileDir = path.join(os.homedir(), "Library/MobileDevice/Provisioning Profiles");
const profileFiles = fs.existsSync(profileDir)
  ? fs.readdirSync(profileDir).filter((name) => name.endsWith(".mobileprovision"))
  : [];

let matchingProfiles = 0;
for (const profile of profileFiles) {
  const fullPath = path.join(profileDir, profile);
  const decoded = run("security", ["cms", "-D", "-i", fullPath]);
  if (decoded.includes(bundleId)) matchingProfiles += 1;
}

requireCheck(matchingProfiles > 0, `At least one provisioning profile references ${bundleId}`);

section("Result");
if (failures > 0) {
  console.log(
    `iOS installed-build preflight failed with ${failures} blocking item(s). Resolve signing/device/profile issues before attempting an installed build.`
  );
  process.exit(1);
}

console.log("iOS installed-build preflight passed. Owner approval is still required before any build, EAS, TestFlight, or credential-changing action.");
