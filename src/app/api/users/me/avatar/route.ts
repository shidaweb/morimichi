import { NextResponse } from "next/server";

import { ensureProfileForUser } from "@/lib/profile/bootstrap-from-auth-metadata";
import { validateWebpMagicBytes } from "@/lib/profile/validate-image-magic-bytes";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_BYTES = 1 * 1024 * 1024;
const STORAGE_PATH_SUFFIX = "avatar.webp";

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "multipart が必要です" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "ファイルサイズは 1MB 以下にしてください" },
      { status: 400 },
    );
  }

  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  if (!validateWebpMagicBytes(bytes)) {
    return NextResponse.json(
      { error: "画像はブラウザで WebP に変換されたファイルを送信してください" },
      { status: 400 },
    );
  }

  const filePath = `${user.id}/${STORAGE_PATH_SUFFIX}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, bytes, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "3600",
  });

  if (uploadError) {
    console.error(uploadError);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
  const baseUrl = pub.publicUrl;

  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: bootErr } = await ensureProfileForUser(supabase, user);
    if (bootErr) {
      return NextResponse.json({ error: "プロフィールを作成できませんでした" }, { status: 500 });
    }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: baseUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json({ error: "プロフィールの更新に失敗しました" }, { status: 500 });
  }

  const avatar_url = `${baseUrl}?t=${Date.now()}`;
  return NextResponse.json({ avatar_url });
}

export async function DELETE() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const filePath = `${user.id}/${STORAGE_PATH_SUFFIX}`;
  await supabase.storage.from("avatars").remove([filePath]);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json({ error: "プロフィールの更新に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ message: "Avatar deleted" });
}
