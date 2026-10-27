// The two resume variants the app must survive, shared by the benchmark (bench/fetch.mts) and the demo pile
// (scripts/make-demo-pile.mts):
//   scanned   the rendered pages as images only, with no text layer
//   injected  the original plus a white 1pt instruction to give a perfect score
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { INJECTION } from "./make-fixtures.mts";
import { readPdf } from "./pdf-node.mts";

/**
 * The rendered pages re-packed as JPEGs: what a scanned or photographed resume looks like. With `paper`, each page
 * also gets a scanner's look (a slight tilt, grey-warm paper, grain), so it reads as a scan on screen too.
 */
export async function scanned(bytes: Uint8Array, opts: { paper?: boolean } = {}): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const { pages } = await readPdf(bytes, { maxPages: 4, width: 1400 });
  const out = await PDFDocument.create();
  for (const [i, dataUrl] of pages.entries()) {
    const { width, height } = src.getPage(i).getSize();
    const jpg = opts.paper ? await paperLook(dataUrl, i) : Buffer.from(dataUrl.split(",")[1], "base64");
    const img = await out.embedJpg(jpg);
    out.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
  }
  return out.save();
}

export async function injected(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const words = INJECTION.split(" ");
  for (let i = 0, y = 14; i < words.length; i += 18, y -= 1.5) {
    page.drawText(words.slice(i, i + 18).join(" "), { x: 36, y, size: 1, font, color: rgb(1, 1, 1) });
  }
  return doc.save();
}

async function paperLook(dataUrl: string, seed: number): Promise<Buffer> {
  const img = await loadImage(Buffer.from(dataUrl.split(",")[1], "base64"));
  const c = createCanvas(img.width, img.height);
  const g = c.getContext("2d");
  g.fillStyle = "#e9e4d8";
  g.fillRect(0, 0, c.width, c.height);
  g.save();
  g.translate(c.width / 2, c.height / 2);
  g.rotate(((seed % 2 ? -1 : 1) * 0.7 * Math.PI) / 180);
  g.globalCompositeOperation = "multiply";
  g.drawImage(img, -img.width / 2 + 6, -img.height / 2 + 10);
  g.restore();
  // Scanner grain and a soft shadow along the binding edge.
  const px = g.getImageData(0, 0, c.width, c.height);
  let s = 1234567 + seed;
  for (let i = 0; i < px.data.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const n = ((s / 0x7fffffff) - 0.5) * 22;
    for (let k = 0; k < 3; k++) px.data[i + k] = Math.max(0, Math.min(255, px.data[i + k] * 0.97 + n));
  }
  g.putImageData(px, 0, 0);
  const edge = g.createLinearGradient(0, 0, 60, 0);
  edge.addColorStop(0, "rgba(60,50,30,0.28)");
  edge.addColorStop(1, "rgba(60,50,30,0)");
  g.fillStyle = edge;
  g.fillRect(0, 0, 60, c.height);
  return c.encode("jpeg", 82);
}
