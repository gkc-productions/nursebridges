export function patientRatingSignal(rating: number) {
  return {
    signalType: "patient_rating" as const,
    severity: rating <= 2 ? "critical" as const : rating === 3 ? "attention" as const : "info" as const,
    needsServiceRecovery: rating <= 2
  };
}

export function reportTimelinessSignal(submittedAt: string, visitCompletedAt: string) {
  const minutes = Math.max(0, Math.round((new Date(submittedAt).getTime() - new Date(visitCompletedAt).getTime()) / 60_000));
  return { minutes, severity: minutes > 24 * 60 ? "attention" as const : "info" as const };
}
