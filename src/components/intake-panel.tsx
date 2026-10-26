"use client";

import { ClipboardPaste, FileText, FolderOpen, Upload, WandSparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ACCEPT, fromPaste } from "@/lib/intake";

type Props = { compact: boolean; onFiles: (f: File[]) => void; onPaste: (text: string) => void; onSamples: () => void };

export function IntakePanel({ compact, onFiles, onPaste, onSamples }: Props) {
  const [pasting, setPasting] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const pick = (input: HTMLInputElement | null) => input?.click();
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles([...e.target.files]);
    e.target.value = "";
  };

  const buttons = (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "justify-center"}`}>
      <button className="btn btn-primary btn-sm" onClick={() => pick(files.current)}>
        <Upload className="size-4" /> Add files
      </button>
      <button className="btn btn-secondary btn-sm" onClick={() => pick(folder.current)}>
        <FolderOpen className="size-4" /> Add a folder
      </button>
      <button className="btn btn-secondary btn-sm" onClick={() => setPasting(true)}>
        <ClipboardPaste className="size-4" /> Paste text
      </button>
      <input ref={files} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={take} />
      <input ref={folder} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={take} {...{ webkitdirectory: "", directory: "" }} />
    </div>
  );

  return (
    <>
      {compact ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-dashed border-surface-strong bg-surface-soft px-4 py-3">
          <p className="text-sm text-muted">Drop more PDFs, images, Word files, ZIPs or folders anywhere on the page.</p>
          {buttons}
        </div>
      ) : (
        <div className="rounded-[24px] border-2 border-dashed border-surface-strong bg-surface-soft px-6 py-14 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-[16px] bg-lavender text-ink">
            <FileText className="size-7" />
          </div>
          <h2 className="display text-[28px] leading-tight">Drop your applicant pile here</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Up to 50 at a time: PDFs, scanned images, Word files, ZIP exports from your ATS, or a whole folder. PDFs are rendered in your browser and read as
            images; results stay on this device.
          </p>
          <div className="mt-6">{buttons}</div>
          <button className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline-offset-4 hover:underline" onClick={onSamples}>
            <WandSparkles className="size-4" /> or try 3 sample resumes
          </button>
        </div>
      )}
      {pasting && <PasteDialog onClose={() => setPasting(false)} onAdd={(t) => (onPaste(t), setPasting(false))} />}
    </>
  );
}

function PasteDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const found = fromPaste(text).length;
  useEffect(() => {
    area.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="paste-title" className="w-full max-w-2xl rounded-[24px] bg-canvas p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="paste-title" className="text-lg font-semibold text-ink">Paste resume text</h2>
            <p className="mt-1 text-sm text-muted">One resume, or many separated by a line with three dashes (<code>---</code>). Pasted text is scored as text, without the vision read.</p>
          </div>
          <button className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-surface-card" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <textarea ref={area} className="field mt-4 min-h-72 resize-y font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Jane Doe\nBackend Engineer · jane@example.com\n...\n---\nNext candidate\n..."} />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{found ? `${found} resume${found === 1 ? "" : "s"} found` : "Each resume needs at least a few lines."}</p>
          <button className="btn btn-primary" disabled={!found} onClick={() => onAdd(text)}>
            Add {found || ""} to the queue
          </button>
        </div>
      </div>
    </div>
  );
}
