"use client";
// Browser side of src/lib/pdf-core.ts. pdfjs is loaded on demand so it never touches the server bundle.
import { JPEG_QUALITY, readDocument, type ReadPdf } from "./pdf-core";

export type BrowserPdf = ReadPdf & { thumb: string };

export async function readPdfFile(file: File): Promise<BrowserPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const read = await readDocument(
      doc,
      (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }),
      (c) => (c as HTMLCanvasElement).toDataURL("image/jpeg", JPEG_QUALITY),
    );
    return { ...read, thumb: await shrink(read.pages[0], 360) };
  } finally {
    await doc.cleanup();
  }
}

/** Redraws an image URL as a JPEG data URL at most `width` pixels wide, on white. */
export async function shrink(src: string | undefined, width: number, quality = 0.7): Promise<string> {
  if (!src) return "";
  const img = new Image();
  img.src = src;
  await img.decode();
  const w = Math.min(width, img.naturalWidth);
  const c = Object.assign(document.createElement("canvas"), { width: w, height: Math.round((img.naturalHeight / img.naturalWidth) * w) });
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}
