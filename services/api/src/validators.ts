import { z } from "zod";

export const createJobSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(0).max(4000).optional().default(""),
  address: z.string().min(0).max(255).optional().default(""),
  start_time: z.string().datetime().optional(),
  hourly_rate: z.number().nonnegative().optional()
});

export const applyJobSchema = z.object({
  note: z.string().min(0).max(2000).optional().default("")
});

export const updateJobSchema = z.object({
  status: z.enum(["open", "assigned", "closed"]).optional(),
  description: z.string().min(0).max(4000).optional(),
  address: z.string().min(0).max(255).optional(),
  start_time: z.string().datetime().optional(),
  hourly_rate: z.number().nonnegative().optional()
});

export const decideApplicationSchema = z.object({
  decision: z.enum(["accept", "reject"])
});
