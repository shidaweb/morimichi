import { z } from "zod";

export const replyCreateSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, "本文を入力してください")
      .max(10000, "本文は10,000文字以内にしてください"),
    parentReplyId: z.string().uuid().optional().nullable(),
    personalOpinionAck: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const isTopLevel = !data.parentReplyId;
    if (isTopLevel && data.personalOpinionAck !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "「個人的な経験・見解としてお伝えします」にチェックを入れてください",
        path: ["personalOpinionAck"],
      });
    }
  });

export type ReplyCreateInput = z.infer<typeof replyCreateSchema>;
