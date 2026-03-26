import { z } from "zod";

export const reportReasonSchema = z.enum([
  "defamation",
  "solicitation",
  "crisis",
  "personal_info",
  "illegal",
  "misinformation",
  "legal_advice",
  "advisor_solicitation",
  "spam",
  "other",
]);

export const reportCreateSchema = z.object({
  targetType: z.enum(["consultation", "reply"]),
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
  detail: z.string().trim().max(2000).optional().nullable(),
});

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
