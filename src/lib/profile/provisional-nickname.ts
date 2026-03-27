/** 登録時にだけ DB 整合用に付けた UUID 風の仮ニックネーム（ユーザーには表示名として見せない） */
export function isProvisionalSystemNickname(nickname: string): boolean {
  const t = nickname.trim();
  return /^user_[0-9a-f]{12}$/i.test(t);
}
