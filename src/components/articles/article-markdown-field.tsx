"use client";

import { ImageIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { resizeArticleImage } from "@/lib/utils/resize-image";
import { cn } from "@/lib/utils";

const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;

function pendingSnippet(id: string) {
  return `![アップロード中...](__pending__:${id})`;
}

function pendingRegex(id: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`!\\[アップロード中\\.\\.\\.\\]\\(__pending__:${escaped}\\)`, "g");
}

export type ArticleMarkdownFieldProps = {
  id: string;
  label: string;
  body: string;
  setBody: React.Dispatch<React.SetStateAction<string>>;
  maxLength: number;
  rows: number;
  isCertifiedPro: boolean;
  textareaClassName?: string;
};

export function ArticleMarkdownField({
  id,
  label,
  body,
  setBody,
  maxLength,
  rows,
  isCertifiedPro,
  textareaClassName,
}: ArticleMarkdownFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionRestoreRef = useRef<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    const pos = selectionRestoreRef.current;
    if (el && pos != null) {
      el.setSelectionRange(pos, pos);
      selectionRestoreRef.current = null;
    }
  }, [body]);

  function insertAtCursor(insert: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((prev) => prev + insert);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    selectionRestoreRef.current = start + insert.length;
    setBody((prev) => prev.slice(0, start) + insert + prev.slice(end));
  }

  function removePending(id: string) {
    setBody((prev) => prev.replace(pendingRegex(id), ""));
  }

  async function uploadResizedWebp(blob: Blob, pendingId: string) {
    const fd = new FormData();
    fd.append("file", blob, "article.webp");
    const res = await fetch("/api/articles/images", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    const j = (await res.json()) as { url?: string; message?: string };
    if (!res.ok) {
      removePending(pendingId);
      setUploadError(j.message ?? "アップロードに失敗しました");
      return;
    }
    if (!j.url) {
      removePending(pendingId);
      setUploadError("アップロードに失敗しました");
      return;
    }
    setBody((prev) => prev.replace(pendingRegex(pendingId), `![画像](${j.url})`));
    setUploadError(null);
  }

  async function handleImageFile(file: File) {
    if (!isCertifiedPro) return;
    setUploadError(null);

    if (!file.type.startsWith("image/")) {
      setUploadError("画像ファイルを選んでください");
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      setUploadError("ファイルサイズは 5MB 以下にしてください");
      return;
    }

    const pendingId = crypto.randomUUID();
    insertAtCursor(pendingSnippet(pendingId));
    setUploading(true);
    try {
      const blob = await resizeArticleImage(file);
      if (blob.size > MAX_ORIGINAL_BYTES) {
        removePending(pendingId);
        setUploadError("変換後の画像が大きすぎます。別の画像をお試しください");
        return;
      }
      await uploadResizedWebp(blob, pendingId);
    } catch {
      removePending(pendingId);
      setUploadError("画像の処理に失敗しました");
    } finally {
      setUploading(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void handleImageFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!isCertifiedPro || uploading) return;
    const f = e.dataTransfer.files?.[0];
    if (f) void handleImageFile(f);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {isCertifiedPro ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={onPickFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-4 w-4" aria-hidden />
            {uploading ? "アップロード中…" : "📷 画像を挿入"}
          </Button>
        </div>
      ) : null}
      {uploadError ? <p className="text-destructive text-xs">{uploadError}</p> : null}
      <textarea
        ref={textareaRef}
        id={id}
        maxLength={maxLength}
        rows={rows}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
        className={cn(
          "border-input bg-background font-mono text-sm leading-relaxed",
          "min-h-[280px] w-full rounded-md border px-3 py-2",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          textareaClassName,
        )}
      />
      <p className="text-muted-foreground text-xs">
        {body.length} / {maxLength}文字
      </p>
    </div>
  );
}
