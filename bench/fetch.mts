// Downloads the public LiveCareer Resume Dataset (CC0, anonymised; kaggle.com/datasets/snehaanbhawal/resume-dataset),
// picks a seeded sample of 50 resumes (10 categories × 5, 1-4 pages each) and builds the three tracks:
//   clean     the original PDF
//   scanned   the same pages as images only, with no text layer
//   injected  the original plus a white 1pt instruction to give a perfect score
// Everything lands in bench/data/ (gitignored). Only aggregate results are committed.
//
//   pnpm bench:fetch
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { INJECTION } from "../scripts/make-fixtures.mts";
import { readPdf } from "../scripts/pdf-node.mts";

const DATA = "bench/data";
const ZIP = `${DATA}/archive.zip`;
const URL = "https://www.kaggle.com/api/v1/datasets/download/snehaanbhawal/resume-dataset";
const CATEGORIES = ["INFORMATION-TECHNOLOGY", "ENGINEERING", "FINANCE", "ACCOUNTANT", "HR", "SALES", "HEALTHCARE", "TEACHER", "DESIGNER", "CONSULTANT"];
const PER_CATEGORY = 5;
const SEED = 20261023;

export type Item = { id: string; category: string; pages: number; truth: string; files: Record<"clean" | "scanned" | "injected", string> };

fs.mkdirSync(`${DATA}/pdf`, { recursive: true });
if (!fs.existsSync(ZIP)) {
  console.log("Downloading the dataset (62 MB)…");
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  fs.writeFileSync(ZIP, Buffer.from(await res.arrayBuffer()));
}
const csv = execFileSync("unzip", ["-p", ZIP, "Resume/Resume.csv"], { maxBuffer: 1 << 30 }).toString("utf8");
const rows = parseCsv(csv);
const header = rows.shift()!;
const col = (n: string) => header.indexOf(n);
const truthById = new Map(rows.map((r) => [r[col("ID")], { truth: r[col("Resume_str")], category: r[col("Category")] }]));

const rand = mulberry32(SEED);
const items: Item[] = [];
for (const category of CATEGORIES) {
  const ids = [...truthById].filter(([, v]) => v.category === category).map(([id]) => id).sort();
  shuffle(ids, rand);
  let taken = 0;
  for (const id of ids) {
    if (taken === PER_CATEGORY) break;
    const bytes = execFileSync("unzip", ["-p", ZIP, `data/data/${category}/${id}.pdf`], { maxBuffer: 1 << 28 });
    if (!bytes.length) continue;
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true }).catch(() => null);
    if (!doc || doc.getPageCount() > 4) continue;
    const base = `${DATA}/pdf/${id}`;
    fs.writeFileSync(`${base}-clean.pdf`, bytes);
    fs.writeFileSync(`${base}-scanned.pdf`, await scanned(bytes));
    fs.writeFileSync(`${base}-injected.pdf`, await injected(bytes));
    items.push({
      id,
      category,
      pages: doc.getPageCount(),
      truth: truthById.get(id)!.truth.replace(/\s+/g, " ").trim(),
      files: { clean: `${base}-clean.pdf`, scanned: `${base}-scanned.pdf`, injected: `${base}-injected.pdf` },
    });
    taken++;
  }
  console.log(`${category}: ${taken}`);
}
fs.writeFileSync(`${DATA}/manifest.json`, JSON.stringify(items, null, 1));
console.log(`${items.length} resumes → ${DATA}/manifest.json`);

/** The rendered pages re-packed as JPEGs: what a scanned or photographed resume looks like. */
async function scanned(bytes: Uint8Array): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const { pages } = await readPdf(bytes, { maxPages: 4, width: 1400 });
  const out = await PDFDocument.create();
  for (const [i, dataUrl] of pages.entries()) {
    const { width, height } = src.getPage(i).getSize();
    const img = await out.embedJpg(Buffer.from(dataUrl.split(",")[1], "base64"));
    out.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
  }
  return out.save();
}

async function injected(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const words = INJECTION.split(" ");
  for (let i = 0, y = 14; i < words.length; i += 18, y -= 1.5) {
    page.drawText(words.slice(i, i + 18).join(" "), { x: 36, y, size: 1, font, color: rgb(1, 1, 1) });
  }
  return doc.save();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(field), (field = "");
    else if (ch === "\n") row.push(field), rows.push(row), (row = []), (field = "");
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(a: T[], r: () => number) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
