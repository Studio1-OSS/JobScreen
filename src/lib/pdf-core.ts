// PDF → page images, text layer and hidden text. Shared by the browser (src/lib/pdf.ts) and Node
// (scripts/pdf-node.mts), so the app and the benchmark read PDFs exactly the same way.
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

export const MAX_PAGES = 4;
export const PAGE_WIDTH = 1100;
export const JPEG_QUALITY = 0.82;

/** A canvas the caller owns: a DOM canvas in the browser, an @napi-rs/canvas in Node. */
export type CanvasLike = { width: number; height: number; getContext(type: "2d"): unknown };

export type ReadPdf = {
  pages: string[];
  /** Every word in the PDF's text layer, in order. */
  textLayer: string;
  /** Text-layer passages that paint nothing visible on the rendered page. */
  hiddenText: string[];
  numPages: number;
};

type TextItem = { str: string; hasEOL?: boolean; transform: number[]; width: number };
type Viewport = ReturnType<PDFPageProxy["getViewport"]>;

export async function readDocument(
  doc: PDFDocumentProxy,
  makeCanvas: (w: number, h: number) => CanvasLike,
  toJpeg: (canvas: CanvasLike) => string | Promise<string>,
  { maxPages = MAX_PAGES, width = PAGE_WIDTH } = {},
): Promise<ReadPdf> {
  const pages: string[] = [];
  const text: string[] = [];
  const hidden: string[] = [];
  const visible: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
    const canvas = makeCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas: canvas as HTMLCanvasElement, canvasContext: ctx, viewport }).promise;
    pages.push(await toJpeg(canvas));

    const items = (await page.getTextContent()).items as TextItem[];
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let line = "";
    let hiddenLine = "";
    const endLine = () => {
      if (line.trim()) text.push(line.trim());
      if (hiddenLine.trim().split(/\s+/).length >= 3) hidden.push(hiddenLine.replace(/\s+/g, " ").trim());
      line = hiddenLine = "";
    };
    for (const item of items) {
      if (typeof item.str !== "string") continue;
      line += item.str;
      if (item.str.trim()) {
        if (isVisible(item, viewport, pixels)) visible.push(item.str);
        else hiddenLine += `${item.str} `;
      }
      if (item.hasEOL) endLine();
    }
    endLine();
    page.cleanup();
  }
  // A line clipped at a page break is invisible on one page but repeated in full on the next: not hidden.
  const seen = squash(visible.join(" "));
  const reallyHidden = hidden.filter((h) => !seen.includes(squash(h)));
  return { pages, textLayer: text.join("\n"), hiddenText: mergeHidden(reallyHidden), numPages: doc.numPages };
}

/**
 * True when the glyphs of this text item leave visible ink on the rendered page. White-on-white,
 * microscopic (< 2.5px tall at screen width), clipped, covered or off-page text all fail this check.
 */
function isVisible(item: TextItem, viewport: Viewport, img: ImageData): boolean {
  const [a, b, c, d, e, f] = viewport.transform;
  const [ia, ib, ic, id, ie, iff] = item.transform;
  const tx = [a * ia + c * ib, b * ia + d * ib, a * ic + c * id, b * ic + d * id, a * ie + c * iff + e, b * ie + d * iff + f];
  const h = Math.hypot(tx[2], tx[3]);
  const w = item.width * viewport.scale;
  if (h < 2.5) return false;
  const x0 = Math.max(0, Math.floor(tx[4]));
  const x1 = Math.min(img.width, Math.ceil(tx[4] + Math.max(w, 1)));
  const y0 = Math.max(0, Math.floor(tx[5] - h));
  const y1 = Math.min(img.height, Math.ceil(tx[5] + h * 0.25));
  if (x1 - x0 < 1 || y1 - y0 < 1) return false;
  // Background = the most common luminance in the box; ink = pixels clearly different from it.
  const hist = new Uint32Array(32);
  const lum: number[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      const l = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      lum.push(l);
      hist[Math.min(31, l >> 3)]++;
    }
  }
  const bg = hist.indexOf(Math.max(...hist)) * 8 + 4;
  const ink = lum.filter((l) => Math.abs(l - bg) > 48).length;
  return ink / lum.length > 0.015;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function mergeHidden(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    if (out.length && out[out.length - 1].length < 400) out[out.length - 1] += ` ${l}`;
    else out.push(l);
  }
  return out.slice(0, 10);
}
