#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const selfPath = path.relative(root, process.argv[1] ?? "");

const scanRoots = [
  "apps",
  "docs",
  "packages",
  "scripts",
  "services",
  "package.json",
  "pnpm-workspace.yaml"
];

const ignoredParts = new Set([".git", ".next", ".expo", "node_modules", "Pods", "build", "remote-edit"]);

const requiredNurseBridgeSnippets = {
  "apps/mobile/app.config.ts": [
    'bundleIdentifier: "com.nursebridges.mobile"',
    'package: "com.nursebridges.mobile"',
    'envTunnelBase: process.env.EXPO_PUBLIC_ENV_TUNNEL_BASE ?? "https://api.nursebridges.com"'
  ],
  "apps/mobile/runtime.json": [
    '"apiBaseUrl": "https://api.nursebridges.com"',
    '"adminBaseUrl": "https://admin.nursebridges.com"'
  ],
  "docs/ops/deployment-runbook.md": [
    "/home/nurseapp/nursebridge",
    "systemd nursebridge-api.service",
    "systemd nursebridge-admin.service",
    "https://api.nursebridges.com",
    "https://admin.nursebridges.com",
    "Do not touch Pathfinder paths, services, env files, or tunnels."
  ],
  "docs/release/production-build-plan.md": [
    "API base: https://api.nursebridges.com",
    "Pathfinder contamination"
  ],
  "docs/architecture/lead-engineering-blueprint.md": [
    "Keep NurseBridge isolated from Pathfinder paths, env files, services, domains, and deployment actions."
  ]
};

const forbiddenPatterns = [
  /\bhttps?:\/\/[^"'\s)]*pathfinder[^"'\s)]*/i,
  /\bapi\.pathfinder[\w.-]*/i,
  /\badmin\.pathfinder[\w.-]*/i,
  /\/etc\/pathfinder\b/i,
  /\/home\/[^/\s]*pathfinder[^/\s]*/i,
  /\bpathfinder-(api|admin|web|vm|server|service|worker)\b/i,
  /\b(pathfinder-api|pathfinder-admin)\.service\b/i,
  /\bEXPO_PUBLIC_[A-Z0-9_]*PATHFINDER[A-Z0-9_]*\b/,
  /\bPATHFINDER_[A-Z0-9_]*\b/
];

const allowedPathfinderContexts = [
  "not pathfinder",
  "do not touch pathfinder",
  "pathfinder contamination",
  "isolated from pathfinder",
  "separate from pathfinder",
  "pathfinder infrastructure",
  "points at pathfinder",
  "no local, staging, pathfinder",
  "do not use a local, pathfinder",
  "keep nursebridge isolated from pathfinder",
  "remain isolated from pathfinder"
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
  return (
    /\.(css|json|md|mjs|plist|sh|ts|tsx|yaml|yml)$/.test(relativePath) ||
    relativePath.endsWith("package.json") ||
    relativePath.endsWith("project.pbxproj")
  );
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

for (const [file, snippets] of Object.entries(requiredNurseBridgeSnippets)) {
  const text = read(file);
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      fail(`${file} is missing required NurseBridge isolation snippet: ${snippet}`);
    }
  }
}

const findings = [];
for (const file of scanRoots.flatMap(collectFiles)) {
  if (file === selfPath || file === "scripts/ops/test/check-nursebridge-isolation.test.mjs") continue;

  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    const normalized = line.toLowerCase();
    const allowedPolicyReference = allowedPathfinderContexts.some((context) => normalized.includes(context));
    const forbidden = forbiddenPatterns.some((pattern) => pattern.test(line));

    if (forbidden || (normalized.includes("pathfinder") && !allowedPolicyReference)) {
      findings.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (findings.length > 0) {
  fail(
    [
      "Potential Pathfinder contamination found.",
      "Only explicit isolation/avoidance policy language may mention Pathfinder in NurseBridge surfaces.",
      ...findings
    ].join("\n")
  );
}

console.log("NurseBridge isolation verification passed.");
