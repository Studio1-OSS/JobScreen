"use client";
// The candidate side: one resume, one job description. The job becomes a rubric, the resume goes through the same
// screening a recruiter's pile does, and the result is shown in the candidate's terms. Nothing is stored.
import { ClipboardPaste, FileText, LoaderCircle, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api, LockedError } from "@/lib/api";
import { rubricId, type Candidate, type Intake } from "@/lib/candidate";
import { ACCEPT, fromFiles, fromPaste } from "@/lib/intake";
import { prepare } from "@/lib/prepare";
import type { Rubric, ScreenEvent } from "@/lib/schema";
import { normaliseRubric } from "@/lib/text";
import { AccessGate } from "./access-gate";
import { Scorecard } from "./scorecard";

type Phase = "idle" | "job" | "resume" | "read" | "github" | "score" | "done";
const STEPS: { id: Phase; label: string }[] = [
  { id: "job", label: "Reading the job" },
  { id: "resume", label: "Opening your resume" },
  { id: "read", label: "Reading the page" },
  { id: "github", label: "Checking links and GitHub" },
  { id: "score", label: "Scoring against the job" },
];

const EXAMPLE_JD = `Full-Stack Engineer (mid-level)

You'll own features end to end in our B2B analytics product: React/Next.js on the front, Node and PostgreSQL behind it.

What you'll do
- Design, build and ship features used by 2,000+ customer teams
- Own services in production: monitoring, on-call rotation, performance work
- Work with design and product on scope; review code and mentor juniors

What we're looking for
- 3+ years building production web apps with TypeScript and React
- Solid SQL and API design; experience with queues or background jobs is a plus
- Testing and CI habits; you've debugged real incidents`;

export function ResumeCheck() {
  const [jd, setJd] = useState("");
  const [item, setItem] = useState<Intake | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<{ candidate: Candidate; rubric: Rubric } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const pick = async (files: File[]) => {
    const { items, skipped } = await fromFiles(files.slice(0, 1));
    if (items[0] && items[0].kind !== "text") {
      setItem(items[0]);
      setError(null);
    } else setError(skipped.length ? `${skipped[0]} isn't a supported file. Use a PDF, an image or a Word file.` : "That file couldn't be read.");
  };

  const resume: Intake | null = pasting ? (fromPaste(pasted)[0] ?? null) : item;
  const busy = phase !== "idle" && phase !== "done";
  const ready = jd.trim().length >= 40 && !!resume && !busy;

  const run = async () => {
    if (!resume) return;
    setError(null);
    setResult(null);
    try {
      setPhase("job");
      const rRes = await api("/api/rubric", { jobDescription: jd });
      const rJson = await rRes.json();
      if (!rRes.ok) throw new Error(rJson.error);
      const rubric = normaliseRubric(rJson.rubric as Rubric);

      setPhase("resume");
      const p = await prepare(resume);
      setPhase(p.pages.length ? "read" : "score");
      const res = await api("/api/screen", { pages: p.pages, hiddenText: p.hiddenText, text: p.text, rubric });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const ev = JSON.parse(buf.slice(0, nl)) as ScreenEvent;
          buf = buf.slice(nl + 1);
          if (ev.type === "step") setPhase(ev.step);
          else if (ev.type === "error") throw new Error(ev.message);
          else {
            setResult({
              rubric,
              candidate: { id: resume.id, key: resume.key, fileName: resume.name, kind: resume.kind, status: "done", rubricId: rubricId(rubric), rubricTitle: rubric.title, thumb: p.thumb, fallbackName: p.fallbackName, result: ev.result, addedAt: Date.now() },
            });
            setPhase("done");
            requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }
        }
      }
    } catch (e) {
      if (e instanceof LockedError) setLocked(true);
      else setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setPhase("idle");
    }
  };

  const at = STEPS.findIndex((s) => s.id === phase);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
      <p className="pill mb-5">For job seekers · free · nothing is stored</p>
      <h1 className="display text-[40px] leading-[1.04] sm:text-[56px]">Get your resume score for a job, before you apply.</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-body">
        Paste the job, add your resume, and see what would filter you out: the likely call, your score with the evidence behind it, what&apos;s missing, and
        the questions you&apos;d face. Same engine recruiters use in JobScreen.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="rounded-[24px] bg-surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">1. The job</h2>
            <button className="text-sm font-semibold text-ink underline-offset-4 hover:underline" onClick={() => setJd(EXAMPLE_JD)}>Use an example</button>
          </div>
          <textarea className="field mt-3 min-h-64 resize-y text-sm" placeholder="Paste the full job description." value={jd} onChange={(e) => setJd(e.target.value)} aria-label="Job description" />
        </section>

        <section className="rounded-[24px] bg-surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">2. Your resume</h2>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-ink underline-offset-4 hover:underline" onClick={() => setPasting((p) => !p)}>
              {pasting ? <Upload className="size-4" /> : <ClipboardPaste className="size-4" />} {pasting ? "Upload a file instead" : "Paste text instead"}
            </button>
          </div>
          {pasting ? (
            <textarea className="field mt-3 min-h-64 resize-y font-mono text-xs" placeholder="Paste your resume text." value={pasted} onChange={(e) => setPasted(e.target.value)} aria-label="Resume text" />
          ) : (
            <button
              className="mt-3 grid min-h-64 w-full place-items-center rounded-[16px] border-2 border-dashed border-surface-strong bg-canvas p-6 text-center hover:border-ink"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void pick([...e.dataTransfer.files]);
              }}
            >
              <span>
                <span className="mx-auto mb-3 grid size-12 place-items-center rounded-[14px] bg-lavender"><FileText className="size-6" /></span>
                {item ? (
                  <>
                    <span className="block font-semibold text-ink">{item.name}</span>
                    <span className="mt-1 block text-sm text-muted">Click to choose a different file</span>
                  </>
                ) : (
                  <>
                    <span className="block font-semibold text-ink">Drop your resume or click to choose</span>
                    <span className="mt-1 block text-sm text-muted">PDF works best (it gets the hidden-text check). Images and Word files work too.</span>
                  </>
                )}
              </span>
            </button>
          )}
          <input ref={fileInput} type="file" accept={ACCEPT.replace(",.zip", "")} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (e.target.files?.length ? void pick([...e.target.files]) : null, (e.target.value = ""))} />
        </section>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button className="btn btn-primary" disabled={!ready} onClick={run}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {busy ? "Checking…" : result ? "Check again" : "Check my resume"}
        </button>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <ShieldCheck className="size-4" /> Your file is read in your browser and sent only to the model for this check. Nothing is saved.
        </p>
      </div>
      {error && <p className="mt-3 text-sm text-error">{error}</p>}

      {busy && (
        <ol className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {STEPS.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-1.5 ${i < at ? "text-ink" : i === at ? "font-semibold text-ink" : "text-muted-soft"}`}>
              {i === at ? <LoaderCircle className="size-3.5 animate-spin" /> : <span className={`size-1.5 rounded-full ${i < at ? "bg-ink" : "bg-surface-strong"}`} />}
              {s.label}
            </li>
          ))}
        </ol>
      )}

      {result && (
        <div ref={resultRef} className="mt-10 scroll-mt-24 space-y-6">
          <details className="rounded-[16px] border border-hairline bg-canvas p-5">
            <summary className="cursor-pointer font-semibold text-ink">What this job&apos;s score is based on ({result.rubric.categories.length} categories)</summary>
            <ul className="mt-3 space-y-2 text-sm">
              {result.rubric.categories.map((c) => (
                <li key={c.key}>
                  <b className="text-ink">{c.label}</b> <span className="text-muted">· {c.weight}%</span>
                  <span className="block text-body">{c.lookFor}</span>
                </li>
              ))}
            </ul>
          </details>
          <div className="rounded-[24px] border border-hairline bg-canvas p-5 sm:p-8">
            <Scorecard candidate={result.candidate} audience="candidate" />
          </div>
          <button className="btn btn-secondary" onClick={() => (setResult(null), setPhase("idle"), window.scrollTo({ top: 0, behavior: "smooth" }))}>
            <RotateCcw className="size-4" /> Check another version
          </button>
          <p className="text-xs text-muted">
            This is one model&apos;s reading against a rubric drafted from the job description, not a prediction of any specific company&apos;s system. Use it to find
            gaps and fix how your experience comes across; never add experience you don&apos;t have.
          </p>
        </div>
      )}

      <AccessGate open={locked} onUnlock={() => (setLocked(false), void run())} />
    </div>
  );
}
