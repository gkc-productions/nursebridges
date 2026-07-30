#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredDocs = {
  "docs/ops/mobile-beta-build-readiness.md": [
    "Mobile app does not contain service-role keys, database passwords, runtime server secrets, or private storage credentials.",
    "No mobile source references service-role keys or database passwords."
  ],
  "docs/release/mobile-build.md": [
    "Never put service role keys, database URLs, JWT secrets, passwords, or private tokens in mobile env files."
  ],
  "docs/release/closed-beta-go-no-go.md": [
    "Mobile app requires service-role keys, database passwords, or server-only secrets."
  ]
};

const mobileRoots = [
  "apps/mobile/App.tsx",
  "apps/mobile/app.config.ts",
  "apps/mobile/runtime.json",
  "apps/mobile/src"
];

const ignoredParts = new Set(["node_modules", "Pods", "build"]);

const forbiddenMobilePatterns = [
  /\bSUPABASE_SERVICE_ROLE_KEY\b/,
  /\bSERVICE_ROLE\b/,
  /\bservice_role\b/,
  /\bDATABASE_URL\b/,
  /\bDB_PASSWORD\b/,
  /\bdatabase_password\b/i,
  /\bJWT_SECRET\b/,
  /\bPRIVATE_KEY\b/,
  /\bSECRET_ACCESS_KEY\b/,
  /\bS3_SECRET\b/,
  /\bSTORAGE_SECRET\b/,
  /\bAuthorization:\s*`?Bearer\s+\$\{(?!session\.access_token)/,
  /Clipboard\.setStringAsync\((accessToken|session\.access_token|token)\)/,
  /Copy Token/i,
  /Access Token/i
];

const allowedPublicEnvNames = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_ENV_LOCAL_LABEL",
  "EXPO_PUBLIC_ENV_TUNNEL_LABEL",
  "EXPO_PUBLIC_ENV_LOCAL_BASE",
  "EXPO_PUBLIC_ENV_TUNNEL_BASE",
  "EXPO_PUBLIC_EAS_PROJECT_ID"
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function shouldIgnore(relativePath) {
  return relativePath.split(path.sep).some((part) => ignoredParts.has(part));
}

function isTextFile(relativePath) {
  return /\.(json|ts|tsx)$/.test(relativePath);
}

function collectFiles(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return [];

  const stat = fs.statSync(absolute);
  if (stat.isFile()) return isTextFile(relativePath) && !shouldIgnore(relativePath) ? [relativePath] : [];

  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(relativePath, entry.name);
    if (shouldIgnore(child)) continue;
    if (entry.isDirectory()) {
      files.push(...collectFiles(child));
    } else if (isTextFile(child)) {
      files.push(child);
    }
  }
  return files;
}

for (const [doc, snippets] of Object.entries(requiredDocs)) {
  const text = read(doc);
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      fail(`${doc} is missing mobile secret-hygiene guidance: ${snippet}`);
    }
  }
}

const findings = [];
for (const file of mobileRoots.flatMap(collectFiles)) {
  const text = read(file);

  for (const pattern of forbiddenMobilePatterns) {
    if (pattern.test(text)) {
      findings.push(`${file}: matches forbidden mobile secret pattern ${pattern}`);
    }
  }

  const publicEnvMatches = text.match(/\bEXPO_PUBLIC_[A-Z0-9_]+\b/g) ?? [];
  for (const envName of publicEnvMatches) {
    if (!allowedPublicEnvNames.includes(envName)) {
      findings.push(`${file}: uses unapproved public mobile env var ${envName}`);
    }
  }
}

const appConfig = read("apps/mobile/app.config.ts");
if (!appConfig.includes("supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY")) {
  findings.push("apps/mobile/app.config.ts: mobile must use the public Supabase anon key env, not server credentials");
}

const tokenScreen = read("apps/mobile/src/screens/TokenScreen.tsx");
if (!tokenScreen.includes("Session credentials are intentionally hidden")) {
  findings.push("apps/mobile/src/screens/TokenScreen.tsx: token screen must state that access tokens are hidden");
}

if (findings.length > 0) {
  fail(["Mobile secret hygiene verification failed.", ...findings].join("\n"));
}

console.log("Mobile secret hygiene verification passed.");
