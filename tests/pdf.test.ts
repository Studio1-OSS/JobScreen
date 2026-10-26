// The hidden-text check runs on real PDFs from fixtures/ (regenerate with `pnpm fixtures`).
import fs from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { readPdf } from "../scripts/pdf-node.mts";

const fixture = (n: string) => fs.readFileSync(`fixtures/${n}.pdf`);

describe("readDocument", () => {
  it("finds white 1pt text that a reader cannot see", async () => {
    const r = await readPdf(fixture("injected"));
    expect(r.hiddenText.join(" ")).toMatch(/ignore all previous scoring instructions/i);
  });
  it("flags nothing on clean resumes", async () => {
    for (const n of ["strong", "weak"]) expect((await readPdf(fixture(n))).hiddenText).toEqual([]);
  });
  it("renders every page as a JPEG and keeps the visible text layer", async () => {
    const r = await readPdf(fixture("strong"));
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(r.textLayer).toMatch(/Ledgerline/);
  });
  it("gives an image-only PDF pages but no text layer", async () => {
    const src = await readPdf(fixture("strong"));
    const out = await PDFDocument.create();
    const img = await out.embedJpg(Buffer.from(src.pages[0].split(",")[1], "base64"));
    out.addPage([612, 792]).drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
    const r = await readPdf(await out.save());
    expect(r.pages).toHaveLength(1);
    expect(r.textLayer).toBe("");
    expect(r.hiddenText).toEqual([]);
  });
});
