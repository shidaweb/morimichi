/**
 * クライアント側で正方形クロップ＋ WebP 化（CF Workers で sharp が使えないため）
 */
export async function resizeImageToWebp(
  file: File,
  maxSize: number = 200,
  quality = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas を初期化できませんでした"));
        return;
      }

      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;

      canvas.width = maxSize;
      canvas.height = maxSize;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("画像の変換に失敗しました"));
        },
        "image/webp",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像の読み込みに失敗しました"));
    };

    img.src = url;
  });
}

/** コラム本文用: 最大幅を抑えつつアスペクト比維持で WebP 化 */
export async function resizeArticleImage(
  file: File,
  maxWidth = 800,
  quality = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas を初期化できませんでした"));
        return;
      }

      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("画像の変換に失敗しました"));
        },
        "image/webp",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("画像の読み込みに失敗しました"));
    };

    img.src = objectUrl;
  });
}
