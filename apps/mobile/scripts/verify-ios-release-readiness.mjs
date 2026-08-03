import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function file(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(file(relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(file(relativePath));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, expected, fileName) {
  assert(text.includes(expected), `${fileName} is missing: ${expected}`);
}

const packageJson = JSON.parse(read("package.json"));
const easJson = JSON.parse(read("eas.json"));
const appConfig = read("app.config.ts");
const infoPlist = read("ios/NurseBridge/Info.plist");
const project = read("ios/NurseBridge.xcodeproj/project.pbxproj");

assert(packageJson.version === "0.1.0", "package.json version must match beta app version 0.1.0");
assert(packageJson.scripts["ios:repair"], "package.json must expose ios:repair");
assert(packageJson.scripts["ios:release-check"], "package.json must expose ios:release-check");
assert(packageJson.scripts["ios:install-preflight"], "package.json must expose ios:install-preflight");

for (const relativePath of [
  "assets/icon.png",
  "assets/splash.png",
  "ios/NurseBridge.xcworkspace",
  "ios/NurseBridge.xcodeproj",
  "ios/Podfile",
  "ios/Podfile.lock",
  "ios/ExportOptions.development.plist",
  "ios/ExportOptions.testflight.plist",
  "ios/NurseBridge/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
]) {
  assert(exists(relativePath), `${relativePath} is required for iOS release readiness`);
}

assertIncludes(appConfig, 'version: "0.1.0"', "app.config.ts");
assertIncludes(appConfig, 'slug: "nursebridges"', "app.config.ts");
assertIncludes(appConfig, 'scheme: "nursebridges"', "app.config.ts");
assertIncludes(appConfig, 'bundleIdentifier: "com.nursebridges.mobile"', "app.config.ts");
assertIncludes(appConfig, 'package: "com.nursebridges.mobile"', "app.config.ts");
assertIncludes(appConfig, 'buildNumber: "1"', "app.config.ts");
assertIncludes(appConfig, 'icon: "./assets/icon.png"', "app.config.ts");
assertIncludes(appConfig, 'image: "./assets/splash.png"', "app.config.ts");
assertIncludes(appConfig, "ITSAppUsesNonExemptEncryption: false", "app.config.ts");

assert(easJson.build["ios-internal"]?.distribution === "internal", "eas.json must define ios-internal internal distribution");
assert(easJson.build["ios-internal"]?.ios?.simulator === false, "ios-internal must target physical devices");
assert(easJson.build["ios-testflight"]?.distribution === "store", "eas.json must define ios-testflight store distribution");
assert(easJson.build["ios-testflight"]?.ios?.simulator === false, "ios-testflight must target physical devices");

assertIncludes(infoPlist, "<string>0.1.0</string>", "Info.plist");
assertIncludes(infoPlist, "<string>1</string>", "Info.plist");
assertIncludes(infoPlist, "<string>nursebridges</string>", "Info.plist");
assertIncludes(infoPlist, "<string>com.nursebridges.mobile</string>", "Info.plist");
assertIncludes(infoPlist, "ITSAppUsesNonExemptEncryption", "Info.plist");
assertIncludes(infoPlist, "NurseBridges uses Face ID only", "Info.plist");

assertIncludes(project, "MARKETING_VERSION = 0.1.0;", "project.pbxproj");
assertIncludes(project, "CURRENT_PROJECT_VERSION = 1;", "project.pbxproj");
assertIncludes(project, "REACT_NATIVE_XCODE_SCRIPT", "project.pbxproj");
assertIncludes(project, 'BUNDLE_COMMAND=\\"export:embed\\"', "project.pbxproj");
assert(!project.includes("export SKIP_BUNDLING=1"), "physical iPhone Debug builds must not force SKIP_BUNDLING=1");

const sourceFiles = fs
  .readdirSync(file("src"), { recursive: true })
  .filter((entry) => typeof entry === "string" && /\.(ts|tsx)$/.test(entry))
  .map((entry) => read(path.join("src", entry)));
const combinedSource = sourceFiles.join("\n");
for (const forbidden of ["service_role", "SERVICE_ROLE", "database_password", "SUPABASE_SERVICE"]) {
  assert(!combinedSource.includes(forbidden), `mobile source appears to reference server-only secret marker: ${forbidden}`);
}

console.log("iOS release readiness checks passed.");
