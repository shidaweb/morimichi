/** 相談投稿ウィザードのステップ（プレビュー含め全5画面） */
export type ConsultationFormStep = 1 | 2 | 3 | 4 | "preview";

export const CONSULTATION_FORM_STEP_TOTAL = 5;

export function consultationFormStepIndex(step: ConsultationFormStep): number {
  return step === "preview" ? 5 : step;
}

export const CONSULTATION_FORM_STEP_TITLE: Record<ConsultationFormStep, string> = {
  1: "いちばん近いフェーズを選ぶ",
  2: "困りごと（複数選択）",
  3: "タイトル（100文字以内）",
  4: "本文（10,000文字以内）",
  preview: "内容の確認・投稿",
};

/**
 * 「次へ」を押したあとに進む画面で行うこと。
 * 各入力画面で「どこまで進むか」の目安として表示する。
 */
export const CONSULTATION_FORM_NEXT_HINT: Record<ConsultationFormStep, string> = {
  1: "困りごとを選びます（複数選択可）。",
  2: "相談のタイトルを入力します（100文字以内）。",
  3: "本文を入力します（10,000文字以内）。",
  4: "入力内容をプレビューで確認してから投稿します。",
  preview: "問題なければ「この内容で投稿する」で公開されます。",
};
