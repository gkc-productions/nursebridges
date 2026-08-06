import type { UserRole } from "./types";

export type MobileProductId = "patient" | "nurse";

export const patientProduct = {
  id: "patient",
  name: "NurseBridges",
  audience: "Patients and families",
  companionName: "NurseBridges Care",
  allowedRoles: ["patient"] as const
};

export const nurseProduct = {
  id: "nurse",
  name: "NurseBridges Care",
  audience: "Nurses and caregivers",
  companionName: "NurseBridges",
  allowedRoles: ["nurse"] as const
};

export function canUseMobileProduct(product: MobileProductId, role: UserRole | null) {
  return product === "nurse" ? role === "nurse" : role === "patient";
}

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

export function nurseProductAccessMessage(role: UserRole | null) {
  if (role === "patient") {
    return "This patient or family account belongs in NurseBridges, the separate app for requesting care.";
  }

  if (role === "admin") {
    return "Administrator accounts use the protected NurseBridges web console.";
  }

  return "This app is for invited NurseBridges nurses and caregivers.";
}
