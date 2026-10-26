// Job-fit benchmark: does each pipeline put the right people at the top of the pile?
//
// Ground truth: each resume in the dataset is labelled with the job category it was filed under. For every one of the
// 10 roles (one frozen rubric each, bench/rubrics.json), all 50 resumes are scored and ranked. The 5 resumes from that
// role's own category are the "fits". A pipeline is better when those 5 land at the top.
//
//   vision   text the vision model read from the rendered pages (read once, saved in bench/data/vision/)
//   library  pymupdf4llm Markdown (bench/data/baseline.jsonl)
// Both go through the identical scoring path: the screen workflow with that text, the same rubric, the same scorer.
//
// Two piles:
//   clean   every resume as its original PDF
//   mixed   the same pile with a seeded 30% (15 resumes) replaced by their scanned copies, as an inbox really looks
//
//   pnpm bench:fit            # resumable; ~1,300 scorings
//   pnpm bench:fit --summary  # recompute the summary from saved rows
import "dotenv/config";
import fs from "node:fs";
import type { Rubric, Screening } from "../src/lib/schema.ts";
import { readPages } from "../src/mastra/agents/reader.ts";
import { screenWorkflow } from "../src/mastra/workflows/screen.ts";
import { readPdf } from "../scripts/pdf-node.mts";

type Track = "clean" | "scanned";
type Pipeline = "vision" | "library";
type Item = { id: string; category: string; files: Record<"clean" | "scanned" | "injected", string> };
type Row = { key: string; role: string; id: string; category: string; track: Track; pipeline: Pipeline; total: number | null; error?: string };

const DATA = "bench/data";
const OUT = "bench/results";
const VISION = `${DATA}/vision`;
const ROWS = `${OUT}/fit-runs.jsonl`;
const SCORE_CONCURRENCY = Number(process.env.BENCH_CONCURRENCY || 8);
const SCANNED_SHARE = 0.3;
const SEED = 7;

const items: Item[] = JSON.parse(fs.readFileSync(`${DATA}/manifest.json`, "utf8"));
const rubrics: Record<string, Rubric> = JSON.parse(fs.readFileSync("bench/rubrics.json", "utf8"));
const roles = Object.keys(rubrics);
const scanned = new Set(seededPick(items.map((i) => i.id), Math.round(items.length * SCANNED_SHARE), SEED));
fs.mkdirSync(VISION, { recursive: true });

// 1. Text per resume and track. Library text was extracted once by bench/run.mts; vision text is read once here.
const library = new Map<string, string>();
for (const l of fs.readFileSync(`${DATA}/baseline.jsonl`, "utf8").split("\n").filter(Boolean)) {
  const j = JSON.parse(l);
  library.set(j.file, j.markdown);
}
const visionPath = (id: string, t: Track) => `${VISION}/${id}-${t}.json`;
const reads = items.flatMap((it) => (["clean", "scanned"] as Track[]).map((t) => ({ it, t }))).filter(({ it, t }) => !fs.existsSync(visionPath(it.id, t)));
if (!process.argv.includes("--summary") && reads.length) {
  console.log(`vision: reading ${reads.length} PDFs once (saved to ${VISION}/)…`);
  await pool(reads, 6, async ({ it, t }) => {
    const pdf = await readPdf(fs.readFileSync(it.files[t]));
    const { reading, usage } = await readPages(pdf.pages);
    fs.writeFileSync(visionPath(it.id, t), JSON.stringify({ id: it.id, track: t, transcript: reading.transcript, usage }));
    process.stdout.write(".");
  });
  console.log();
}
const textOf = (it: Item, t: Track, p: Pipeline): string =>
  p === "library" ? (library.get(it.files[t]) ?? "") : JSON.parse(fs.readFileSync(visionPath(it.id, t), "utf8")).transcript;

// 2. Scores: every role × every resume × pipeline, on clean PDFs, plus the scanned copies the mixed pile uses.
const done = new Map<string, Row>();
if (fs.existsSync(ROWS)) for (const l of fs.readFileSync(ROWS, "utf8").split("\n").filter(Boolean)) { const r: Row = JSON.parse(l); if (r.total !== null) done.set(r.key, r); }
type Job = { role: string; it: Item; track: Track; pipeline: Pipeline };
const jobs: Job[] = [];
for (const role of roles)
  for (const it of items)
    for (const pipeline of ["vision", "library"] as Pipeline[]) {
      jobs.push({ role, it, track: "clean", pipeline });
      if (scanned.has(it.id)) jobs.push({ role, it, track: "scanned", pipeline });
    }
const keyOf = (j: Job) => `${j.role}|${j.it.id}|${j.track}|${j.pipeline}`;
const todo = jobs.filter((j) => !done.has(keyOf(j)));
if (!process.argv.includes("--summary") && todo.length) {
  console.log(`${jobs.length} scorings, ${done.size} done, ${todo.length} to go (concurrency ${SCORE_CONCURRENCY})`);
  let n = 0;
  const t0 = Date.now();
  await pool(todo, SCORE_CONCURRENCY, async (j) => {
    let row = await score(j);
    if (row.error) row = await score(j);
    fs.appendFileSync(ROWS, JSON.stringify(row) + "\n");
    if (row.total !== null) done.set(row.key, row);
    n++;
    if (n % 25 === 0 || row.error) console.log(`[${n}/${todo.length}] ${row.key} ${row.error ? `ERROR ${row.error.slice(0, 80)}` : row.total} · eta ${Math.round(((Date.now() - t0) / n) * (todo.length - n) / 1000)}s`);
  });
}

async function score(j: Job): Promise<Row> {
  const base = { key: keyOf(j), role: j.role, id: j.it.id, category: j.it.category, track: j.track, pipeline: j.pipeline };
  try {
    const run = await screenWorkflow.createRun();
    // The workflow rejects nothing here: an empty library extraction (a scan) is scored as the empty resume it is.
    const res = await run.start({ inputData: { pages: [], text: textOf(j.it, j.track, j.pipeline), rubric: rubrics[j.role], github: false, profile: false, verify: false } });
    if (res.status !== "success") throw new Error(`workflow ${res.status}: ${"error" in res ? String(res.error).slice(0, 160) : ""}`);
    return { ...base, total: (res.result as Screening).total };
  } catch (e) {
    return { ...base, total: null, error: String(e).slice(0, 300) };
  }
}

// 3. Summary.
const missing = jobs.filter((j) => !done.has(keyOf(j))).length;
const summary = summarise();
fs.writeFileSync(`${OUT}/fit-summary.json`, JSON.stringify(summary, null, 2));
fs.writeFileSync(`${OUT}/fit-summary.md`, markdown(summary));
console.log("\n" + markdown(summary));

function summarise() {
  const piles = ["clean", "mixed"] as const;
  const per = piles.flatMap((pile) =>
    (["vision", "library"] as Pipeline[]).map((pipeline) => {
      const byRole = roles.map((role) => {
        const scored = items.map((it) => {
          const track: Track = pile === "mixed" && scanned.has(it.id) ? "scanned" : "clean";
          return { id: it.id, fit: it.category === role, total: done.get(`${role}|${it.id}|${track}|${pipeline}`)?.total ?? null };
        });
        const ok = scored.filter((s): s is { id: string; fit: boolean; total: number } => s.total !== null);
        return { role, n: ok.length, p5: precisionAtK(ok, 5), auc: auc(ok), top1: precisionAtK(ok, 1), missedFits: ok.filter((s) => s.fit && s.total === 0).length };
      });
      return { pile, pipeline, roles: byRole, p5: mean(byRole.map((r) => r.p5)), auc: mean(byRole.map((r) => r.auc)), top1: mean(byRole.map((r) => r.top1)), p5ci: bootstrap(byRole.map((r) => r.p5)), aucci: bootstrap(byRole.map((r) => r.auc)), missedFits: byRole.reduce((s, r) => s + r.missedFits, 0) };
    }),
  );
  const paired = piles.map((pile) => {
    const v = per.find((x) => x.pile === pile && x.pipeline === "vision")!.roles;
    const l = per.find((x) => x.pile === pile && x.pipeline === "library")!.roles;
    const d = v.map((r, i) => r.p5 - l[i].p5);
    const da = v.map((r, i) => r.auc - l[i].auc);
    return {
      pile,
      meanP5Diff: round(mean(d)),
      visionBetter: d.filter((x) => x > 1e-9).length,
      libraryBetter: d.filter((x) => x < -1e-9).length,
      ties: d.filter((x) => Math.abs(x) <= 1e-9).length,
      p5DiffCi: bootstrap(d),
      meanAucDiff: round(mean(da)),
      aucDiffCi: bootstrap(da),
      aucVisionBetter: da.filter((x) => x > 1e-9).length,
      aucLibraryBetter: da.filter((x) => x < -1e-9).length,
    };
  });
  return { model: process.env.NEBIUS_MODEL, date: new Date().toISOString().slice(0, 10), resumes: items.length, roles: roles.length, scannedInMixed: scanned.size, scorings: done.size, missing, piles: per.map((x) => ({ ...x, p5: round(x.p5), auc: round(x.auc), top1: round(x.top1) })), paired };
}

/** Expected precision@k when tied scores are broken at random: the fair answer for a list with many equal totals. */
function precisionAtK(s: { fit: boolean; total: number }[], k: number): number {
  const sorted = [...s].sort((a, b) => b.total - a.total);
  if (sorted.length < k) return 0;
  const cut = sorted[k - 1].total;
  const above = sorted.filter((x) => x.total > cut);
  const tied = sorted.filter((x) => x.total === cut);
  const slots = k - above.length;
  return (above.filter((x) => x.fit).length + (slots * tied.filter((x) => x.fit).length) / tied.length) / k;
}

/** Probability a random fit outscores a random non-fit (ties count half). 0.5 is a coin flip. */
function auc(s: { fit: boolean; total: number }[]): number {
  const pos = s.filter((x) => x.fit);
  const neg = s.filter((x) => !x.fit);
  if (!pos.length || !neg.length) return 0;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p.total > n.total ? 1 : p.total === n.total ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

/** 95% bootstrap interval of the mean, resampling roles (10,000 draws, fixed seed). */
function bootstrap(xs: number[]): [number, number] {
  const rand = mulberry32(42);
  const means: number[] = [];
  for (let b = 0; b < 10000; b++) means.push(mean(Array.from({ length: xs.length }, () => xs[Math.floor(rand() * xs.length)])));
  means.sort((a, b) => a - b);
  return [round(means[250]), round(means[9749])];
}

function markdown(s: ReturnType<typeof summarise>): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const lines = [
    `# Job fit: who ends up at the top of the pile`,
    ``,
    `Model: \`${s.model}\` · ${s.date} · ${s.resumes} resumes × ${s.roles} roles · ${s.scorings} scorings${s.missing ? ` · ${s.missing} missing` : ""}`,
    ``,
    `| Pile | Pipeline | Fits in top 5 (P@5) | 95% CI | Right resume at #1 | Ranking quality (AUC) | 95% CI | Fits scored 0 |`,
    `|---|---|---|---|---|---|---|---|`,
    ...s.piles.map((p) => `| ${p.pile === "clean" ? "Clean PDFs" : `Mixed (${s.scannedInMixed} scans)`} | ${p.pipeline} | ${pct(p.p5)} | ${pct(p.p5ci[0])}–${pct(p.p5ci[1])} | ${pct(p.top1)} | ${p.auc.toFixed(2)} | ${p.aucci[0].toFixed(2)}–${p.aucci[1].toFixed(2)} | ${p.missedFits} |`),
    ``,
    `Paired by role (vision minus library, P@5):`,
    ``,
    ...s.paired.map((d) => `- ${d.pile}: P@5 ${d.meanP5Diff > 0 ? "+" : ""}${Math.round(d.meanP5Diff * 100)} points (95% CI ${Math.round(d.p5DiffCi[0] * 100)} to ${Math.round(d.p5DiffCi[1] * 100)}; vision better on ${d.visionBetter} roles, library on ${d.libraryBetter}, tied on ${d.ties}) · AUC ${d.meanAucDiff > 0 ? "+" : ""}${d.meanAucDiff.toFixed(2)} (95% CI ${d.aucDiffCi[0].toFixed(2)} to ${d.aucDiffCi[1].toFixed(2)}; vision better on ${d.aucVisionBetter} of ${s.roles} roles)`),
    ``,
    `Per role, P@5 (vision / library):`,
    ``,
    `| Role | Clean | Mixed |`,
    `|---|---|---|`,
    ...roles.map((role) => {
      const g = (pile: string, p: string) => pct(s.piles.find((x) => x.pile === pile && x.pipeline === p)!.roles.find((r) => r.role === role)!.p5);
      return `| ${role} | ${g("clean", "vision")} / ${g("clean", "library")} | ${g("mixed", "vision")} / ${g("mixed", "library")} |`;
    }),
  ];
  return lines.join("\n") + "\n";
}

async function pool<T>(xs: T[], n: number, fn: (x: T) => Promise<void>) {
  const q = [...xs];
  await Promise.all(Array.from({ length: n }, async () => { for (let x = q.shift(); x; x = q.shift()) await fn(x); }));
}
function seededPick<T>(xs: T[], k: number, seed: number): T[] {
  const r = mulberry32(seed);
  const a = [...xs].sort();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, k);
}
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function round(x: number) {
  return Math.round(x * 1000) / 1000;
}
