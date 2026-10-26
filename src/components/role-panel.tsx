"use client";

import { ChevronDown, LoaderCircle, Plus, WandSparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PRESETS } from "@/lib/presets";
import type { Rubric } from "@/lib/schema";
import { slug } from "@/lib/text";

export function RolePanel({ rubric, onChange }: { rubric: Rubric; onChange: (r: Rubric) => void }) {
  const [mode, setMode] = useState<"preset" | "jd">("preset");
  // On phones the rubric starts folded so the candidate list is the first thing you see.
  const [expanded, setExpanded] = useState(true);
  useEffect(() => setExpanded(window.matchMedia("(min-width: 1024px)").matches), []);
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sum = rubric.categories.reduce((s, c) => s + c.weight, 0);
  const total = sum || 1;
  const keys = rubric.categories.map((c) => c.key);

  const draft = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rubric", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobDescription: jd }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onChange(json.rubric);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft a rubric");
    } finally {
      setBusy(false);
    }
  };

  const setCat = (i: number, p: Partial<Rubric["categories"][number]>) =>
    onChange({ ...rubric, categories: rubric.categories.map((c, j) => (j === i ? { ...c, ...p } : c)) });

  return (
    <aside className="h-fit rounded-[24px] bg-surface-card p-5 sm:p-6 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
      <button className="flex w-full items-end justify-between gap-3 text-left lg:pointer-events-none" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
        <span className="min-w-0">
          <span className="eyebrow block text-muted">Scoring rubric</span>
          <span className="display block text-[28px] leading-tight">The role</span>
          {!expanded && <span className="mt-1 block truncate text-sm text-body">{rubric.title} · {rubric.categories.length} categories</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ink lg:hidden">
          {expanded ? "Hide" : "Edit"} <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      <div className={expanded ? "" : "hidden"}>
      <div className="mt-4 flex gap-1 rounded-full bg-surface-strong p-1 text-sm font-medium">
        {(["preset", "jd"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-full px-3 py-2 ${mode === m ? "bg-canvas text-ink shadow-sm" : "text-muted"}`}>
            {m === "preset" ? "Presets" : "Job description"}
          </button>
        ))}
      </div>

      {mode === "preset" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.title} onClick={() => onChange(p)} className={`pill ${rubric.title === p.title ? "bg-ink text-white" : "bg-canvas"}`}>
              {p.title}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <textarea className="field min-h-36 resize-y text-sm" placeholder="Paste the job description. The rubric agent turns it into weighted, evidence-based categories." value={jd} onChange={(e) => setJd(e.target.value)} />
          <button className="btn btn-primary w-full" disabled={busy || jd.trim().length < 40} onClick={draft}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
            {busy ? "Drafting rubric…" : "Draft rubric"}
          </button>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      )}

      <div className="mt-6 rounded-[16px] bg-canvas p-4">
        <input
          className="w-full bg-transparent text-lg font-semibold text-ink outline-none"
          value={rubric.title}
          onChange={(e) => onChange({ ...rubric, title: e.target.value })}
          aria-label="Role title"
        />
        <p className="text-sm text-muted">{rubric.summary}</p>

        <ul className="mt-4 space-y-4">
          {rubric.categories.map((c, i) => (
            <li key={i}>
              <div className="flex items-center gap-2">
                <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none" value={c.label} onChange={(e) => setCat(i, { label: e.target.value })} aria-label="Category name" />
                <span className="w-10 text-right text-sm font-semibold tabular-nums text-ink">{Math.round((c.weight / total) * 100)}%</span>
                {rubric.categories.length > 2 && (
                  <button className="text-muted-soft hover:text-ink" onClick={() => onChange({ ...rubric, categories: rubric.categories.filter((_, j) => j !== i) })} aria-label={`Remove ${c.label}`}>
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <input type="range" min={0} max={50} value={c.weight} onChange={(e) => setCat(i, { weight: Number(e.target.value) })} className="weight mt-2 w-full" aria-label={`${c.label} weight`} />
              <textarea className="mt-1 w-full resize-none bg-transparent text-xs leading-relaxed text-muted outline-none" rows={2} value={c.lookFor} onChange={(e) => setCat(i, { lookFor: e.target.value })} aria-label={`${c.label}: what to look for`} />
            </li>
          ))}
        </ul>
        {sum === 0 && <p className="mt-3 rounded-[8px] bg-ochre/30 px-3 py-2 text-xs text-ink">Every weight is 0, so all categories will count equally.</p>}
        {rubric.categories.length < 6 && (
          <button
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink"
            onClick={() => {
              let n = rubric.categories.length + 1;
              while (keys.includes(slug(`custom ${n}`))) n++;
              onChange({ ...rubric, categories: [...rubric.categories, { key: slug(`custom ${n}`), label: "New category", weight: 10, lookFor: "Describe the evidence that earns a high score." }] });
            }}
          >
            <Plus className="size-4" /> Add category
          </button>
        )}
      </div>
      </div>
    </aside>
  );
}
