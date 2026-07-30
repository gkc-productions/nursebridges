#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireSnippet(doc, text, snippet) {
  if (!text.includes(snippet)) {
    fail(`${doc} is missing private-document-path hygiene snippet: ${snippet}`);
  }
}

function forbidSnippet(doc, text, snippet) {
  if (text.includes(snippet)) {
    fail(`${doc} exposes private document path detail: ${snippet}`);
  }
}

const mobileTypesDoc = "apps/mobile/src/types.ts";
const mobileAppDoc = "apps/mobile/App.tsx";
const adminDataDoc = "apps/admin/lib/adminDashboardData.ts";
const adminPageDoc = "apps/admin/app/page.tsx";
const legalDoc = "docs/legal/beta-legal-consent-checklist.md";
const inAppGuardDoc = "scripts/ops/check-in-app-consent-readiness.mjs";
const accessGuardDoc = "scripts/ops/check-access-and-secrets-readiness.mjs";

const mobileTypes = read(mobileTypesDoc);
const mobileApp = read(mobileAppDoc);
const adminData = read(adminDataDoc);
const adminPage = read(adminPageDoc);
const legal = read(legalDoc);
const inAppGuard = read(inAppGuardDoc);
const accessGuard = read(accessGuardDoc);

const verificationRowMatch = mobileTypes.match(/export type VerificationDocumentRow = \{[\s\S]*?\n\};/);
if (!verificationRowMatch) {
  fail(`${mobileTypesDoc} is missing VerificationDocumentRow`);
}

forbidSnippet(mobileTypesDoc, verificationRowMatch[0], "storage_path");

for (const snippet of [
  "export type VerificationDocumentUploadUrlResponse = {",
  "path: string;",
  "token: string;"
]) {
  requireSnippet(mobileTypesDoc, mobileTypes, snippet);
}

for (const snippet of [
  "const storagePath = buildVerificationStoragePath(session.user.id, file.name);",
  "body: JSON.stringify({\n            storage_path: storagePath",
  ".uploadToSignedUrl(uploadUrl.path, uploadUrl.token, fileBody",
  "body: JSON.stringify({\n            storage_bucket: VERIFICATION_BUCKET,\n            document_type: documentType,\n            storage_path: storagePath",
  "void supabase.storage.from(VERIFICATION_BUCKET).remove([storagePath]);",
  "<FieldRow label=\"Created\" value={formatDate(document.created_at)} />"
]) {
  requireSnippet(mobileAppDoc, mobileApp, snippet);
}

for (const forbidden of [
  "FieldRow label=\"Storage",
  "FieldRow label=\"Path",
  "document.storage_path",
  "uploadUrl.token}"
]) {
  forbidSnippet(mobileAppDoc, mobileApp, forbidden);
}

for (const snippet of [
  "export type AdminVerificationDocumentRow = {",
  "id: string;",
  "nurse_user_id: string;",
  "document_type: string | null;",
  "status: string;",
  "created_at: string | null;",
  ".select(\"id,nurse_user_id,document_type,status,created_at\")"
]) {
  requireSnippet(adminDataDoc, adminData, snippet);
}

for (const forbidden of [
  "storage_path",
  "signed_url",
  "public_url",
  "document_path"
]) {
  forbidSnippet(adminDataDoc, adminData, forbidden);
}

for (const snippet of [
  "Review submitted metadata without exposing private storage paths.",
  "documents.length",
  "latest.document_type"
]) {
  requireSnippet(adminPageDoc, adminPage, snippet);
}

for (const forbidden of [
  "storage_path",
  "signed_url",
  "public_url",
  "document_path"
]) {
  forbidSnippet(adminPageDoc, adminPage, forbidden);
}

for (const snippet of [
  "Who can review document metadata and files.",
  "That private storage is used.",
  "Do not expose private storage paths."
]) {
  requireSnippet(legalDoc, legal, snippet);
}

for (const snippet of [
  "Review submitted metadata without exposing private storage paths.",
  "Admin verification review screen."
]) {
  requireSnippet(inAppGuardDoc, inAppGuard, snippet);
}

for (const snippet of [
  "Service role key, token, private document path, or secret is exposed.",
  "No secrets copied into evidence: yes/no"
]) {
  requireSnippet(accessGuardDoc, accessGuard, snippet);
}

console.log("Private document path hygiene verification passed.");
