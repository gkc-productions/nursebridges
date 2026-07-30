import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const stagedFiles = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/ops/verify-nursebridges-identity.mjs",
  "scripts/ops/verify-vm-stage-package.mjs",
  "scripts/ops/check-assignment-rpc-contract.mjs",
  "scripts/ops/check-terminal-job-rpc-contract.mjs",
  "scripts/ops/smoke-beta-workflow.sh",
  "scripts/ops/test/check-assignment-rpc-contract.test.mjs",
  "scripts/ops/test/check-terminal-job-rpc-contract.test.mjs",
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
  "apps/mobile/src/theme.ts",
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
  "docs/release/beta-evidence-log.md",
  "docs/release/closed-beta-operator-runbook.md",
  "docs/release/mobile-build.md",
  "docs/release/vm-sync-handoff.md",
  "docs/release/engineering-state-snapshot.md",
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
