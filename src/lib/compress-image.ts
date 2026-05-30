/*
 * Client-side image compression before server upload. Modern phone cameras
 * shoot 4–5 MB JPEGs (or 12 MB ProRAW on iPhone Pro) that blow past
 * Vercel's server-action body limit AND our 5 MB MAX_BYTES check even
 * after sharp's EXIF strip. Compressing client-side keeps the request
 * small + the server-side sharp pipeline fast.
 *
 * Returns the original File unchanged when:
 *   - the file is already small enough to skip compression
 *   - the browser doesn't expose canvas + bitmap APIs (server-render path)
 *   - any step fails — we'd rather upload the original than throw
 */

const SKIP_THRESHOLD_BYTES = 800 * 1024; // 800 KB — under the old 1 MB limit
const MAX_EDGE_PX = 2000; // Plenty for OCR + proof legibility
const JPEG_QUALITY = 0.85;

export async function compressImage(file: File): Promise<File> {
  if (file.size <= SKIP_THRESHOLD_BYTES) return file;
  if (typeof document === "undefined") return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const stem = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${stem}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
