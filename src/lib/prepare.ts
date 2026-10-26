"use client";
// Gets each kind of resume ready for /api/screen: page images for PDFs and pictures, plain text for DOCX and pastes.
import type { Intake } from "./candidate";
import { JPEG_QUALITY, PAGE_WIDTH } from "./pdf-core";
import { readPdfFile, shrink } from "./pdf";

export type Prepared = { pages: string[]; hiddenText: string[]; text?: string; thumb?: string; fallbackName?: string };

export async function prepare(item: Intake): Promise<Prepared> {
  switch (item.kind) {
    case "pdf": {
      const pdf = await readPdfFile(item.file!).catch((e) => {
        throw new Error(/password/i.test(String(e)) ? "This PDF is password-protected." : "This PDF could not be opened.");
      });
      if (!pdf.pages.length) throw new Error("This PDF has no pages.");
      return { pages: pdf.pages, hiddenText: pdf.hiddenText, thumb: pdf.thumb };
    }
    case "image": {
      const url = URL.createObjectURL(item.file!);
      try {
        const page = await shrink(url, PAGE_WIDTH, JPEG_QUALITY).catch(() => {
          throw new Error("This image could not be read.");
        });
        return { pages: [page], hiddenText: [], thumb: await shrink(page, 360) };
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ arrayBuffer: await item.file!.arrayBuffer() }).catch(() => {
        throw new Error("This Word file could not be read.");
      });
      return textOnly(value);
    }
    case "text":
      return textOnly(item.text ?? (await item.file!.text()));
  }
}

function textOnly(text: string): Prepared {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length < 80) throw new Error("There is almost no text in this resume.");
  const fallbackName = clean.split("\n").map((l) => l.trim()).find((l) => l.length > 1)?.slice(0, 60);
  return { pages: [], hiddenText: [], text: clean.slice(0, 60000), fallbackName };
}
