import type { UserRole } from "./types";

export const patientProduct = {
  id: "patient",
  name: "NurseBridges",
  audience: "Patients and families",
  companionName: "NurseBridges Care",
  allowedRoles: ["patient"] as const
};

export function canUsePatientProduct(role: UserRole | null): role is "patient" {
  return role === "patient";
}

export function patientProductAccessMessage(role: UserRole | null) {
  if (role === "nurse") {
    return "This nurse account belongs in NurseBridges Care, the separate app for nurses and caregivers.";
  }

  if (role === "admin") {
    return "Administrator accounts use the protected NurseBridges web console.";
  }

  return "This app is for invited NurseBridges patients and family members.";
}
