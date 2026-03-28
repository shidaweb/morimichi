"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { resizeImageToWebp } from "@/lib/utils/resize-image";

type Props = {
  currentAvatarUrl: string | null;
  nickname: string;
  onUploadSuccess: (newUrl: string) => void;
  onDeleteSuccess: () => void;
};

const MAX_FILE_SIZE = 1 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUpload({
  currentAvatarUrl,
  nickname,
  onUploadSuccess,
  onDeleteSuccess,
}: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("JPEG、PNG、WebP 形式の画像を選択してください");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("画像サイズは 1MB 以下にしてください");
        return;
      }

      setIsUploading(true);
      try {
        const blob = await resizeImageToWebp(file, 200, 0.85);
        if (blob.size > MAX_FILE_SIZE) {
          setError("変換後も 1MB を超えました。別の画像をお試しください");
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        const resizedFile = new File([blob], "avatar.webp", { type: "image/webp" });
        const formData = new FormData();
        formData.append("file", resizedFile);

        const res = await fetch("/api/users/me/avatar", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; avatar_url?: string };
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "アップロードに失敗しました");
        }
        if (typeof data.avatar_url === "string") {
          onUploadSuccess(data.avatar_url);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "アップロードに失敗しました");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onUploadSuccess],
  );

  const handleDelete = useCallback(async () => {
    if (!currentAvatarUrl) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/avatar", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("削除に失敗しました");
      onDeleteSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  }, [currentAvatarUrl, onDeleteSuccess]);

  const busy = isUploading || isDeleting;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="group relative">
        <UserAvatar avatarUrl={currentAvatarUrl} nickname={nickname} size="xl" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100 disabled:cursor-not-allowed"
          aria-label="画像を変更"
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(ev) => void handleFileSelect(ev)}
        className="hidden"
        aria-label="プロフィール画像を選択"
      />

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              アップロード中
            </>
          ) : (
            "画像を変更"
          )}
        </Button>
        {currentAvatarUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={busy}
            aria-label="画像を削除"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-muted-foreground text-center text-xs">JPEG / PNG / WebP、1MB以下（自動で 200px・WebP に変換）</p>
    </div>
  );
}
