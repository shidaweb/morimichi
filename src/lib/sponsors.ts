/**
 * もりみちスポンサー企業（ご芳名掲載用）。
 * 名前・任意で公式サイト URL を追加してください。
 */
export type MorimichiSponsor = {
  name: string;
  /** 省略時はテキストのみ表示 */
  url?: string;
};

export const MORIMICHI_SPONSORS: MorimichiSponsor[] = [
  // 例: { name: "株式会社サンプル", url: "https://example.com" },
];
