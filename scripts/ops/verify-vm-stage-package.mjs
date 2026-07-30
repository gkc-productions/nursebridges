import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const stagedFiles = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/ops/verify-nursebridges-identity.mjs",
  "scripts/ops/verify-vm-stage-package.mjs",
  "scripts/ops/show-build-status.mjs",
  "scripts/ops/check-admin-api-boundary-readiness.mjs",
  "scripts/ops/check-api-log-hygiene.mjs",
  "scripts/ops/check-assignment-rpc-contract.mjs",
  "scripts/ops/check-canonical-assignment-readiness.mjs",
  "scripts/ops/check-terminal-job-rpc-contract.mjs",
  "scripts/ops/check-access-and-secrets-readiness.mjs",
  "scripts/ops/check-beta-gates.mjs",
  "scripts/ops/check-beta-ops-readiness.mjs",
  "scripts/ops/check-release-doc-links.mjs",
  "scripts/ops/check-in-app-consent-readiness.mjs",
  "scripts/ops/check-mobile-secret-hygiene.mjs",
  "scripts/ops/check-legal-consent-readiness.mjs",
  "scripts/ops/check-mobile-support-snapshot.mjs",
  "scripts/ops/check-nursebridge-isolation.mjs",
  "scripts/ops/check-notification-audit-privacy.mjs",
  "scripts/ops/check-private-document-path-hygiene.mjs",
  "scripts/ops/check-production-sequence-readiness.mjs",
  "scripts/ops/check-real-device-proof-readiness.mjs",
  "scripts/ops/check-restore-drill-readiness.mjs",
  "scripts/ops/check-rpc-sql-safety.mjs",
  "scripts/ops/check-trust-language.mjs",
  "scripts/ops/check-workflow-atomicity-readiness.mjs",
  "scripts/ops/check-workflow-smoke-readiness.mjs",
  "scripts/ops/smoke-beta-workflow.sh",
  "scripts/ops/test/check-admin-api-boundary-readiness.test.mjs",
  "scripts/ops/test/check-api-log-hygiene.test.mjs",
  "scripts/ops/test/check-assignment-rpc-contract.test.mjs",
  "scripts/ops/test/check-canonical-assignment-readiness.test.mjs",
  "scripts/ops/test/check-terminal-job-rpc-contract.test.mjs",
  "scripts/ops/test/check-access-and-secrets-readiness.test.mjs",
  "scripts/ops/test/check-beta-gates.test.mjs",
  "scripts/ops/test/check-beta-ops-readiness.test.mjs",
  "scripts/ops/test/check-release-doc-links.test.mjs",
  "scripts/ops/test/check-in-app-consent-readiness.test.mjs",
  "scripts/ops/test/check-mobile-secret-hygiene.test.mjs",
  "scripts/ops/test/check-legal-consent-readiness.test.mjs",
  "scripts/ops/test/check-mobile-support-snapshot.test.mjs",
  "scripts/ops/test/check-nursebridge-isolation.test.mjs",
  "scripts/ops/test/check-notification-audit-privacy.test.mjs",
  "scripts/ops/test/check-private-document-path-hygiene.test.mjs",
  "scripts/ops/test/check-production-sequence-readiness.test.mjs",
  "scripts/ops/test/check-real-device-proof-readiness.test.mjs",
  "scripts/ops/test/check-restore-drill-readiness.test.mjs",
  "scripts/ops/test/check-rpc-sql-safety.test.mjs",
  "scripts/ops/test/check-trust-language.test.mjs",
  "scripts/ops/test/check-workflow-atomicity-readiness.test.mjs",
  "scripts/ops/test/check-workflow-smoke-readiness.test.mjs",
  "scripts/ops/test/show-build-status.test.mjs",
  "scripts/ops/test/smoke-beta-workflow.test.mjs",
  "packages/shared/package.json",
  "packages/shared/tsconfig.json",
  "packages/shared/src/types.ts",
  "packages/shared/src/index.ts",
  "packages/shared/src/workflow.ts",
  "packages/shared/test/workflow.test.ts",
  "services/api/package.json",
  "services/api/src/audit.ts",
  "services/api/src/jobAssignmentCommand.ts",
  "services/api/src/jobTerminalCommand.ts",
  "services/api/src/jobStatusCore.ts",
  "services/api/src/jobWorkflow.ts",
  "services/api/src/routes/adminAssignmentRoute.ts",
  "services/api/src/routes/applications.ts",
  "services/api/src/routes/applicationDecisionRoute.ts",
  "services/api/src/routes/jobTerminalRoute.ts",
  "services/api/test/jobAssignment.test.ts",
  "services/api/test/adminAssignmentRoute.test.ts",
  "services/api/test/applicationDecisionRoute.test.ts",
  "services/api/test/jobStatusCore.test.ts",
  "services/api/test/jobTerminalCommand.test.ts",
  "services/api/test/jobTerminalRoute.test.ts",
  "apps/mobile/package.json",
  "apps/mobile/App.tsx",
  "apps/mobile/app.config.ts",
  "apps/mobile/assets/icon.png",
  "apps/mobile/assets/splash.png",
  "apps/mobile/scripts/verify-ios-release-readiness.mjs",
  "apps/mobile/scripts/verify-ios-install-preflight.mjs",
  "apps/mobile/scripts/verify-android-install-preflight.mjs",
  "apps/mobile/src/theme.ts",
  "apps/mobile/src/types.ts",
  "apps/mobile/src/screens/ApiTestScreen.tsx",
  "apps/mobile/src/screens/TokenScreen.tsx",
  "apps/mobile/src/workflow.ts",
  "apps/mobile/test/workflow.test.ts",
  "apps/admin/package.json",
  "apps/admin/lib/jobAssignmentActionsCore.ts",
  "apps/admin/lib/workflowRules.ts",
  "apps/admin/test/jobAssignmentActionsCore.test.ts",
  "apps/admin/test/workflowRules.test.ts",
  "docs/architecture/job-lifecycle.md",
  "docs/architecture/production-architecture.md",
  "docs/architecture/lead-engineering-blueprint.md",
  "docs/architecture/workflow-source-of-truth.md",
  "docs/architecture/sql/assignment-finalize-rpc.draft.sql",
  "docs/architecture/sql/terminal-job-finalize-rpc.draft.sql",
  "docs/architecture/data-contract.md",
  "docs/architecture/adrs/0001-product-architecture-decisions.md",
  "docs/legal/beta-legal-consent-checklist.md",
  "docs/ops/closed-beta-ops-playbook.md",
  "docs/ops/deployment-runbook.md",
  "docs/ops/observability.md",
  "docs/ops/supabase-data-contract-verification.md",
  "docs/ops/assignment-rpc-rollout-plan.md",
  "docs/ops/terminal-job-rpc-rollout-plan.md",
  "docs/ops/mobile-beta-build-readiness.md",
  "docs/product/experience-spec.md",
  "docs/product/ui-implementation-brief.md",
  "docs/release/start-here.md",
  "docs/release/ios-internal-build-readiness-review-2026-07-17.md",
  "docs/release/iphone-create-job-capture-packet.md",
  "docs/release/android-create-job-capture-packet.md",
  "docs/release/current-build-status.md",
  "docs/release/beta-readiness.md",
  "docs/release/beta-verification-matrix.md",
  "docs/release/beta-evidence-templates.md",
  "docs/release/closed-beta-go-no-go.md",
  "docs/release/beta-evidence-log.md",
  "docs/release/closed-beta-operator-runbook.md",
  "docs/release/mobile-build.md",
  "docs/release/vm-sync-handoff.md",
  "docs/release/engineering-state-snapshot.md",
  "docs/release/pending-vm-verification.md",
  "docs/release/production-build-plan.md",
  "docs/release/implementation-backlog.md"
];

const syncDocs = [
  "docs/release/vm-sync-handoff.md",
  "docs/release/engineering-state-snapshot.md"
];

function fail(message) {
  throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

for (const file of stagedFiles) {
  if (!exists(file)) {
    fail(`${file} is listed for VM sync but does not exist`);
  }
}

for (const doc of syncDocs) {
  const text = read(doc);

  for (const file of stagedFiles) {
    if (!text.includes(file)) {
      fail(`${doc} does not include staged file ${file}`);
    }
  }

  if (!text.includes("node scripts/ops/verify-nursebridges-identity.mjs")) {
    fail(`${doc} does not run the NurseBridges identity guard`);
  }

  if (!text.includes("node scripts/ops/verify-vm-stage-package.mjs")) {
    fail(`${doc} does not run the VM staged-package guard`);
  }

  if (!text.includes("pnpm run typecheck") || !text.includes("pnpm test")) {
    fail(`${doc} does not verify the synced mobile helper/test slice`);
  }

  if (!text.includes("Do not") || !text.includes("services/api")) {
    fail(`${doc} is missing the partial API snapshot warning`);
  }

  const forbiddenSyncPatterns = [
    "scp 'vm-stage/services/api",
    "rsync 'vm-stage/services/api",
    "rsync -",
    "cp -R services/api",
    "cp -r services/api"
  ];

  for (const pattern of forbiddenSyncPatterns) {
    if (text.includes(pattern)) {
      fail(`${doc} contains unsafe partial API sync pattern: ${pattern}`);
    }
  }
}

const remoteStatus = "remote-edit/docs/release/current-build-status.md";
if (exists(remoteStatus)) {
  const staleRoadmap = "production-" + "roadmap.md";
  if (read(remoteStatus).includes(staleRoadmap)) {
    fail(`${remoteStatus} still references ${staleRoadmap}`);
  }
}

const partialApiFiles = [
  "services/api/src/routes/jobs.ts",
  "services/api/src/routes/jobUpdateRoute.ts",
  "services/api/test/jobUpdateRoute.test.ts"
];

for (const file of partialApiFiles) {
  if (!exists(file)) {
    fail(`expected partial API reference file is missing: ${file}`);
  }
}

console.log(`VM staged-package verification passed for ${stagedFiles.length} staged files.`);
