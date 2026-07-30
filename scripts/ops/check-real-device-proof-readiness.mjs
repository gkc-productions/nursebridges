#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const proofDocs = [
  "docs/release/iphone-create-job-capture-packet.md",
  "docs/release/android-create-job-capture-packet.md",
  "docs/ops/mobile-beta-build-readiness.md",
  "docs/release/closed-beta-operator-runbook.md"
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

for (const doc of proofDocs) {
  const text = read(doc);
  for (const snippet of [
    "real-device",
    "patient create",
    "https://api.nursebridges.com"
  ]) {
    if (!text.toLowerCase().includes(snippet.toLowerCase())) {
      fail(`${doc} is missing installed-device proof language: ${snippet}`);
    }
  }
}

for (const doc of [
  "docs/release/iphone-create-job-capture-packet.md",
  "docs/release/android-create-job-capture-packet.md"
]) {
  const text = read(doc);
  for (const snippet of [
    "Support snapshot",
    "Copied `Support snapshot` text from the app.",
    "Support snapshot:",
    "Do not send:",
    "Passwords.",
    "Bearer tokens.",
    "Private medical details."
  ]) {
    if (!text.includes(snippet)) {
      fail(`${doc} is missing real-device evidence safety snippet: ${snippet}`);
    }
  }
}

const iphonePacket = read("docs/release/iphone-create-job-capture-packet.md");
if (!iphonePacket.includes("internal iOS/TestFlight build")) {
  fail("iPhone packet must keep the installed-build path explicit");
}
if (iphonePacket.includes("Do not continue retrying this path") && !iphonePacket.includes("Expo Go/LAN")) {
  fail("iPhone packet should preserve the Expo Go/LAN abandonment context");
}

const androidPacket = read("docs/release/android-create-job-capture-packet.md");
if (!androidPacket.includes("previously could log in") || !androidPacket.includes("POST /jobs")) {
  fail("Android packet must preserve the original Android POST /jobs blocker context");
}

const readiness = read("docs/ops/mobile-beta-build-readiness.md");
if (!readiness.includes("Do not rebuild the product in pure Xcode/SwiftUI right now")) {
  fail("mobile build readiness must preserve the Expo/native architecture decision");
}

console.log("Real-device proof readiness verification passed.");
