/**
 * 本文が `\n` のリテラル（バックスラッシュ+n）で保存されている場合に、表示用に実改行へ戻す。
 */
export function normalizeConsultationBodyForDisplay(text: string): string {
  if (!text) return text;
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n");
}
