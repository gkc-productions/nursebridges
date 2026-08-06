import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseMobileProduct,
  canUsePatientProduct,
  nurseProduct,
  nurseProductAccessMessage,
  patientProductAccessMessage,
  patientProduct
} from "../src/product";

test("patient product accepts only patient profiles", () => {
  assert.equal(canUsePatientProduct("patient"), true);
  assert.equal(canUsePatientProduct("nurse"), false);
  assert.equal(canUsePatientProduct("admin"), false);
  assert.equal(canUsePatientProduct(null), false);
});

test("patient product keeps the companion nurse app distinct", () => {
  assert.equal(patientProduct.name, "NurseBridges");
  assert.equal(patientProduct.companionName, "NurseBridges Care");
  assert.match(patientProductAccessMessage("nurse"), /NurseBridges Care/);
  assert.match(patientProductAccessMessage("admin"), /web console/);
});

test("nurse product has a separate identity and role boundary", () => {
  assert.equal(nurseProduct.name, "NurseBridges Care");
  assert.equal(canUseMobileProduct("nurse", "nurse"), true);
  assert.equal(canUseMobileProduct("nurse", "patient"), false);
  assert.equal(canUseMobileProduct("patient", "patient"), true);
  assert.match(nurseProductAccessMessage("patient"), /separate app for requesting care/);
});
