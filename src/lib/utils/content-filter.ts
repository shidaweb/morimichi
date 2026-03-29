const CONTACT_PATTERNS: RegExp[] = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /0\d{1,4}-?\d{1,4}-?\d{3,4}/g,
  /\+81\d{9,10}/g,
  /LINE\s*(?:ID|id|Id)\s*[:：]?\s*\S+/gi,
  /(?:ライン|らいん)\s*(?:ID|id|Id)\s*[:：]?\s*\S+/gi,
  /(?:twitter|instagram|facebook|tiktok)\.com\/\S+/gi,
  /@[a-zA-Z0-9_]{3,}(?=\s|$|[\u3000-\u303f\uff00-\uffef])/g,
];

/**
 * 投稿内の連絡先っぽい文字列を検出（ヒューリスティック）。
 * 文脈までは判定しないため、誤検知の可能性あり。
 */
export function detectContactInfo(text: string): {
  hasContactInfo: boolean;
  matches: string[];
} {
  const matches: string[] = [];
  const seen = new Set<string>();
  for (const re of CONTACT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m[0].trim();
      if (s.length > 0 && !seen.has(s)) {
        seen.add(s);
        matches.push(s);
      }
    }
  }
  return { hasContactInfo: matches.length > 0, matches };
}
