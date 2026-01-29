import { z } from "zod";

export const createJobSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(0).max(4000).optional().default(""),
  location: z.string().min(0).max(255).optional().default(""),
  scheduled_at: z.string().datetime().optional(), // ISO string
});

export const applyJobSchema = z.object({
  note: z.string().min(0).max(2000).optional().default(""),
});

export const decideApplicationSchema = z.object({
  decision: z.enum(["accept", "reject"]),
});
