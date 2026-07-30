import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const packageName = "com.nursebridges.mobile";

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

function findAdb() {
  const pathAdb = run("zsh", ["-lc", "command -v adb"]).trim();
  if (pathAdb) return pathAdb;

  const candidates = [
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, "platform-tools", "adb"),
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb"),
    path.join(os.homedir(), "Library", "Android", "sdk", "platform-tools", "adb"),
    "/opt/homebrew/bin/adb",
    "/usr/local/bin/adb"
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "";
}

section("NurseBridges Android Installed-Build Preflight");
console.log(`Android package: ${packageName}`);
console.log("Mode: read-only; no build, install, credential, or device mutation is performed.");

section("Source");
requireCheck(exists("app.config.ts"), "Expo app config exists");
requireCheck(exists("App.tsx"), "Mobile app entrypoint exists");

const appConfig = exists("app.config.ts") ? fs.readFileSync("app.config.ts", "utf8") : "";
requireCheck(appConfig.includes('slug: "nursebridges"'), "Expo slug is nursebridges");
requireCheck(appConfig.includes('scheme: "nursebridges"'), "Expo scheme is nursebridges");
requireCheck(appConfig.includes(`package: "${packageName}"`), `Android package is ${packageName}`);
requireCheck(appConfig.includes(`bundleIdentifier: "${packageName}"`), `iOS bundle identifier is ${packageName}`);

section("Android Tools");
const adbPath = findAdb();
requireCheck(Boolean(adbPath), "adb is available");
if (adbPath) {
  console.log(`  ${adbPath}`);
  const version = run(adbPath, ["version"]).trim();
  if (version) {
    pass(`adb version is readable: ${version.split("\n")[0]}`);
  } else {
    warn("adb did not return readable version output");
  }

  section("Connected Device");
  const devicesOutput = run(adbPath, ["devices", "-l"]);
  const deviceLines = devicesOutput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices attached"));
  const authorizedDevices = deviceLines.filter((line) => /\sdevice\s/.test(line));
  const unauthorizedDevices = deviceLines.filter((line) => /\sunauthorized\s/.test(line));
  const offlineDevices = deviceLines.filter((line) => /\soffline\s/.test(line));

  requireCheck(authorizedDevices.length > 0, "At least one authorized Android device is visible to adb");
  for (const line of deviceLines) {
    console.log(`  ${line}`);
  }
  if (deviceLines.length === 0) {
    warn("No Android device is visible to adb. Unlock the phone, enable Developer Options, enable USB debugging, use a data-capable cable, and accept the USB debugging prompt.");
  }
  if (unauthorizedDevices.length > 0) {
    warn("At least one Android device is unauthorized; unlock the phone and accept the USB debugging prompt.");
  }
  if (offlineDevices.length > 0) {
    warn("At least one Android device is offline; reconnect the cable or toggle USB debugging.");
  }
} else {
  warn("Install Android platform-tools or set ANDROID_HOME/ANDROID_SDK_ROOT before attempting Android installed-device proof.");
}

section("Result");
if (failures > 0) {
  console.log(`Android installed-build preflight failed with ${failures} blocking item(s).`);
  process.exit(1);
}

console.log("Android installed-build preflight passed. Owner approval is still required before any install or mutating workflow proof.");
