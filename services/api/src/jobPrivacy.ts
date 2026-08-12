export type PrivateLogisticsJob = {
  patient_user_id: string | null;
};

export function canReceivePrivateLogistics(
  role: string,
  userId: string,
  job: PrivateLogisticsJob,
  assignedNurseId: string | null
) {
  if (role === "admin") return true;
  if (role === "patient") return job.patient_user_id === userId;
  return role === "nurse" && assignedNurseId === userId;
}

export function privateAddressForViewer(
  address: string | null,
  role: string,
  userId: string,
  job: PrivateLogisticsJob,
  assignedNurseId: string | null
) {
  return canReceivePrivateLogistics(role, userId, job, assignedNurseId) ? address : null;
}
