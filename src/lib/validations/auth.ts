import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z
      .string()
      .min(8, "パスワードは8文字以上にしてください")
      .max(72, "パスワードが長すぎます"),
    nickname: z
      .string()
      .min(2, "ニックネームは2文字以上にしてください")
      .max(20, "ニックネームは20文字以内にしてください"),
    role: z.enum(["consulter", "advisor", "both"]),
    experiencePhases: z.array(z.string()).optional(),
    agreeTerms: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!data.agreeTerms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "利用規約に同意してください",
        path: ["agreeTerms"],
      });
    }
    if (data.role === "advisor" || data.role === "both") {
      const phases = data.experiencePhases ?? [];
      if (phases.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "経験したフェーズを1つ以上選んでください",
          path: ["experiencePhases"],
        });
      }
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "パスワードは8文字以上にしてください")
    .max(72, "パスワードが長すぎます"),
});
