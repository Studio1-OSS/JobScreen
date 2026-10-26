// Node side of src/lib/pdf-core.ts: pdfjs legacy build + @napi-rs/canvas.
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { JPEG_QUALITY, readDocument, type CanvasLike, type ReadPdf } from "../src/lib/pdf-core.ts";

export async function readPdf(bytes: Uint8Array, opts?: { maxPages?: number; width?: number }): Promise<ReadPdf> {
  const doc = (await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise) as unknown as PDFDocumentProxy;
  try {
    return await readDocument(
      doc,
      (w, h) => createCanvas(w, h) as unknown as CanvasLike,
      async (c) => `data:image/jpeg;base64,${(await (c as unknown as Canvas).encode("jpeg", Math.round(JPEG_QUALITY * 100))).toString("base64")}`,
      opts,
    );
  } finally {
    await doc.cleanup();
  }
}
