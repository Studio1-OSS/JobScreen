"use client";
// Turns whatever a recruiter drops in (files, folders, ZIP archives, pasted text) into a flat list of resumes.
import type { Intake, IntakeKind } from "./candidate";

const KIND_BY_EXT: Record<string, IntakeKind> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  docx: "docx",
  txt: "text",
  md: "text",
};
const MIME: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,.md,.zip";
export const MAX_FILE_MB = 25;

export type IntakeResult = { items: Intake[]; skipped: string[] };

const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";
const junk = (path: string) => path.split("/").some((p) => p.startsWith(".") || p === "__MACOSX");

export async function fromFiles(files: File[]): Promise<IntakeResult> {
  const items: Intake[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    if (junk(path)) continue;
    const e = ext(file.name);
    if (e === "zip") {
      const r = await fromZip(file);
      items.push(...r.items);
      skipped.push(...r.skipped);
    } else if (KIND_BY_EXT[e]) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) skipped.push(`${file.name} (over ${MAX_FILE_MB} MB)`);
      else items.push(make(KIND_BY_EXT[e], file.name, { file }));
    } else skipped.push(file.name);
  }
  return { items, skipped };
}

async function fromZip(zip: File): Promise<IntakeResult> {
  const { unzip } = await import("fflate");
  const data = new Uint8Array(await zip.arrayBuffer());
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(data, { filter: (f) => !junk(f.name) && !!KIND_BY_EXT[ext(f.name)] && f.originalSize <= MAX_FILE_MB * 1024 * 1024 }, (err, out) => (err ? reject(err) : resolve(out))),
  ).catch(() => null);
  if (!entries) return { items: [], skipped: [`${zip.name} (not a readable ZIP)`] };
  const items = Object.entries(entries).map(([path, bytes]) => {
    const name = path.split("/").pop()!;
    const file = new File([bytes as BlobPart], name, { type: MIME[ext(name)] ?? "" });
    return make(KIND_BY_EXT[ext(name)], name, { file, source: zip.name });
  });
  return { items, skipped: items.length ? [] : [`${zip.name} (no resumes inside)`] };
}

/** Files and folders from a drag-and-drop, walking folders recursively. */
export async function fromDataTransfer(dt: DataTransfer): Promise<IntakeResult> {
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
  if (!entries.length) return fromFiles([...dt.files]);
  const files: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      files.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) if (!e.name.startsWith(".")) await walk(e);
      }
    }
  };
  for (const e of entries) await walk(e);
  return fromFiles(files);
}

/** Pasted text: one resume, or several separated by a line of three or more dashes. */
export function fromPaste(text: string): Intake[] {
  return text
    .split(/^\s*-{3,}\s*$/m)
    .map((t) => t.trim())
    .filter((t) => t.length >= 80)
    .map((t, i) => make("text", firstLine(t) || `Pasted resume ${i + 1}`, { text: t }));
}

const firstLine = (t: string) => t.split("\n").map((l) => l.replace(/^[#*\s-]+/, "").trim()).find((l) => l.length > 1)?.slice(0, 60) ?? "";

function make(kind: IntakeKind, name: string, extra: Partial<Intake>): Intake {
  const size = extra.file?.size ?? extra.text?.length ?? 0;
  return { id: crypto.randomUUID(), kind, name, size, key: `${name.toLowerCase()}:${size}`, ...extra };
}
