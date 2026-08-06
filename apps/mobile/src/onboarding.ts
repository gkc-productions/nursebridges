export type PatientAccessRequesterType = "patient" | "family";

export type PatientAccessForm = {
  fullName: string;
  email: string;
  phone: string;
  serviceArea: string;
  requesterType: PatientAccessRequesterType;
  contactConsent: boolean;
};

export const emptyPatientAccessForm: PatientAccessForm = {
  fullName: "",
  email: "",
  phone: "",
  serviceArea: "",
  requesterType: "patient",
  contactConsent: false
};

export type PatientAccessRequestPayload = {
  full_name: string;
  email: string;
  phone?: string;
  service_area: string;
  requester_type: PatientAccessRequesterType;
  contact_consent: true;
  website: string;
};

export function buildPatientAccessRequestPayload(
  form: PatientAccessForm
): { ok: true; value: PatientAccessRequestPayload } | { ok: false; error: string } {
  const fullName = form.fullName.trim();
  const email = form.email.trim().toLowerCase();
  const phone = form.phone.trim();
  const serviceArea = form.serviceArea.trim();

  if (fullName.length < 2) return { ok: false, error: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (phone && phone.length < 7) return { ok: false, error: "Enter a valid phone number or leave it blank." };
  if (serviceArea.length < 2) return { ok: false, error: "Enter your city or ZIP code." };
  if (!form.contactConsent) return { ok: false, error: "Confirm that NurseBridges may contact you." };

  return {
    ok: true,
    value: {
      full_name: fullName,
      email,
      ...(phone ? { phone } : {}),
      service_area: serviceArea,
      requester_type: form.requesterType,
      contact_consent: true,
      website: ""
    }
  };
}
