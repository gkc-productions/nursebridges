import assert from "node:assert/strict";
import test from "node:test";
import { canUsePatientProduct, patientProductAccessMessage, patientProduct } from "../src/product";

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
