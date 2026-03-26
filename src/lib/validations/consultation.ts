import { z } from "zod";

export const consultationCreateSchema = z.object({
  phaseId: z.string().uuid("フェーズが不正です"),
  concernIds: z
    .array(z.string().uuid())
    .min(1, "困りごとを1つ以上選んでください")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "同じ困りごとは重複できません",
    }),
  title: z
    .string()
    .trim()
    .min(1, "タイトルを入力してください")
    .max(100, "タイトルは100文字以内にしてください"),
  body: z
    .string()
    .trim()
    .min(1, "本文を入力してください")
    .max(10000, "本文は10,000文字以内にしてください"),
});

export type ConsultationCreateInput = z.infer<typeof consultationCreateSchema>;
