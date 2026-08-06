import assert from "node:assert/strict";
import test from "node:test";
import { getNurseWorkspaceTitle, NURSE_WORKSPACE_TABS } from "../src/nurseNavigation";

test("nurse workspace uses five stable role-specific destinations", () => {
  assert.deepEqual(
    NURSE_WORKSPACE_TABS.map((tab) => tab.key),
    ["home", "find", "schedule", "inbox", "account"]
  );
  assert.equal(new Set(NURSE_WORKSPACE_TABS.map((tab) => tab.key)).size, 5);
});
test("nurse workspace gives each destination a task-oriented title", () => {
  assert.equal(getNurseWorkspaceTitle("home"), "Your workday");
  assert.equal(getNurseWorkspaceTitle("find"), "Find care work");
  assert.equal(getNurseWorkspaceTitle("schedule"), "Your schedule");
  assert.equal(getNurseWorkspaceTitle("inbox"), "Inbox");
  assert.equal(getNurseWorkspaceTitle("account"), "Professional profile");
});
