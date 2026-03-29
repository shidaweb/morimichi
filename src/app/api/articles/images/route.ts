import { NextResponse } from "next/server";

import { validateWebpMagicBytes } from "@/lib/profile/validate-image-magic-bytes";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ message: "サーバー設定エラーです" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "ログインが必要です" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_certified_pro")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_certified_pro) {
    return NextResponse.json({ message: "公認再生プロのみ画像をアップロードできます" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "multipart 形式で送信してください" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "ファイルが必要です" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: "ファイルサイズは 5MB 以下にしてください" }, { status: 400 });
  }

  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  if (!validateWebpMagicBytes(bytes)) {
    return NextResponse.json(
      { message: "画像はブラウザで WebP に変換されたファイルを送信してください" },
      { status: 400 },
    );
  }

  const objectName = `${crypto.randomUUID()}.webp`;
  const filePath = `${user.id}/${objectName}`;

  const { error: uploadError } = await supabase.storage.from("article-images").upload(filePath, bytes, {
    contentType: "image/webp",
    upsert: false,
    cacheControl: "86400",
  });

  if (uploadError) {
    console.error(uploadError);
    return NextResponse.json({ message: "アップロードに失敗しました" }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from("article-images").getPublicUrl(filePath);

  return NextResponse.json({ url: pub.publicUrl });
}
