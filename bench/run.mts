// 50 real resumes × 3 tracks × 2 pipelines, same model (DeepSeek V4.1 Flash 1017), same rubric, same scorer.
//   vision  rendered page images → reader agent → scorer      (what JobScreen does)
//   text    pymupdf4llm Markdown → scorer                      (what the original hiring-agent did)
// Plus a second clean run of the first 10 resumes per pipeline, to measure score consistency.
//
//   pnpm bench:fetch            # once: download and build bench/data/
//   pnpm bench:50 --limit 3     # dry run on 3 resumes
//   pnpm bench:50               # full run; resumable, finished rows are skipped
import "dotenv/config";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import type { Rubric, Screening } from "../src/lib/schema.ts";
import { tokens } from "../src/lib/text.ts";
import { draftRubric } from "../src/mastra/agents/rubric.ts";
import { screenWorkflow } from "../src/mastra/workflows/screen.ts";
import { readPdf } from "../scripts/pdf-node.mts";

type Track = "clean" | "scanned" | "injected";
type Pipeline = "vision" | "text";
type Item = { id: string; category: string; pages: number; truth: string; files: Record<Track, string> };
export type Row = {
  key: string;
  id: string;
  category: string;
  track: Track;
  pipeline: Pipeline;
  rep: number;
  total: number | null;
  scores: number[];
  f1: number;
  chars: number;
  hidden: number;
  injectionFlag: boolean;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
};

const DATA = "bench/data";
const OUT = "bench/results";
const args = process.argv.slice(2);
const limit = Number(args[args.indexOf("--limit") + 1]) || Infinity;
const CONCURRENCY = Number(process.env.BENCH_CONCURRENCY || 6);
const REPEATS = 10;

const items: Item[] = JSON.parse(fs.readFileSync(`${DATA}/manifest.json`, "utf8")).slice(0, limit);
fs.mkdirSync(OUT, { recursive: true });

// 1. One frozen rubric per category, written by the rubric agent from a short job description.
const JDS: Record<string, string> = {
  "INFORMATION-TECHNOLOGY": "IT Manager: runs infrastructure, help desk and security for a 500-person company; vendor management, budgets, uptime.",
  ENGINEERING: "Mechanical / Process Engineer: designs and improves manufacturing processes, CAD, root-cause analysis, safety and quality standards.",
  FINANCE: "Financial Analyst: forecasting, budgeting, variance analysis, financial models and reporting to leadership.",
  ACCOUNTANT: "Staff Accountant: month-end close, reconciliations, GAAP, accounts payable/receivable, audits and ERP systems.",
  HR: "HR Generalist: recruiting, onboarding, employee relations, benefits administration, HRIS and policy compliance.",
  SALES: "Account Executive: owns a quota, prospects and closes B2B deals, manages pipeline in a CRM, grows key accounts.",
  HEALTHCARE: "Healthcare Operations Coordinator: patient care coordination, clinical compliance, scheduling, EHR systems and team supervision.",
  TEACHER: "K-12 Teacher: lesson planning, classroom management, differentiated instruction, assessment data and parent communication.",
  DESIGNER: "Graphic / Product Designer: brand and digital design, Adobe CC or Figma, portfolio of shipped work, works with marketing and product.",
  CONSULTANT: "Management Consultant: client engagements, problem structuring, analysis and recommendations, project delivery and stakeholder management.",
};
const rubricsPath = "bench/rubrics.json";
const rubrics: Record<string, Rubric> = fs.existsSync(rubricsPath) ? JSON.parse(fs.readFileSync(rubricsPath, "utf8")) : {};
for (const cat of new Set(items.map((i) => i.category))) {
  if (!rubrics[cat]) {
    rubrics[cat] = await draftRubric(JDS[cat]);
    fs.writeFileSync(rubricsPath, JSON.stringify(rubrics, null, 2));
    console.log(`rubric: ${cat} → ${rubrics[cat].categories.map((c) => `${c.label} ${c.weight}`).join(", ")}`);
  }
}

// 2. The text baseline, extracted once with pymupdf4llm (Python, the original project's library).
const basePath = `${DATA}/baseline.jsonl`;
const baseline = new Map<string, string>();
if (fs.existsSync(basePath)) for (const l of fs.readFileSync(basePath, "utf8").split("\n").filter(Boolean)) { const j = JSON.parse(l); baseline.set(j.file, j.markdown); }
const missing = items.flatMap((i) => Object.values(i.files)).filter((f) => !baseline.has(f));
if (missing.length) {
  console.log(`pymupdf4llm: extracting ${missing.length} PDFs…`);
  const out = execFileSync("uv", ["run", "-q", "--python", "3.11", "--with-requirements", "bench/baseline/requirements.txt", "python", "-I", "bench/baseline/extract.py", ...missing], { maxBuffer: 1 << 28 })
    .toString()
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .join("\n") + "\n";
  fs.appendFileSync(basePath, out);
  for (const l of out.split("\n").filter(Boolean)) { const j = JSON.parse(l); baseline.set(j.file, j.markdown); }
}

// 3. Runs.
const runsPath = `${OUT}/runs.jsonl`;
const done = new Map<string, Row>();
if (fs.existsSync(runsPath)) for (const l of fs.readFileSync(runsPath, "utf8").split("\n").filter(Boolean)) { const r: Row = JSON.parse(l); if (!r.error) done.set(r.key, r); }

type Job = { item: Item; track: Track; pipeline: Pipeline; rep: number };
const jobs: Job[] = [];
for (const [n, item] of items.entries())
  for (const track of ["clean", "scanned", "injected"] as Track[])
    for (const pipeline of ["vision", "text"] as Pipeline[])
      for (let rep = 0; rep < (track === "clean" && n < REPEATS ? 2 : 1); rep++) jobs.push({ item, track, pipeline, rep });
const keyOf = (j: Job) => `${j.item.id}|${j.track}|${j.pipeline}|${j.rep}`;
const todo = jobs.filter((j) => !done.has(keyOf(j)));
console.log(`${jobs.length} runs, ${done.size} done, ${todo.length} to go (concurrency ${CONCURRENCY})`);

let finished = 0;
let tok = 0;
const t0 = Date.now();
async function runJob(j: Job): Promise<Row> {
  const { item, track, pipeline, rep } = j;
  const t = Date.now();
  const base = { key: keyOf(j), id: item.id, category: item.category, track, pipeline, rep };
  try {
    let input;
    if (pipeline === "vision") {
      const pdf = await readPdf(fs.readFileSync(item.files[track]));
      input = { pages: pdf.pages, hiddenText: pdf.hiddenText };
    } else input = { pages: [], text: baseline.get(item.files[track]) ?? "" };
    const run = await screenWorkflow.createRun();
    const res = await run.start({ inputData: { ...input, rubric: rubrics[item.category], github: false, profile: false, verify: false } });
    if (res.status !== "success") throw new Error(`workflow ${res.status}: ${"error" in res ? String(res.error).slice(0, 200) : ""}`);
    const s = res.result as Screening;
    const read = [s.reading.name, s.reading.headline, s.reading.email, s.reading.location, s.reading.transcript].join("\n");
    return {
      ...base,
      total: s.total,
      scores: s.categories.map((c) => c.score),
      f1: bagF1(read, item.truth),
      chars: s.reading.transcript.length,
      hidden: s.reading.hiddenText.length,
      injectionFlag: s.injectionAttempt,
      ms: Date.now() - t,
      inputTokens: s.usage.inputTokens,
      outputTokens: s.usage.outputTokens,
    };
  } catch (e) {
    return { ...base, total: null, scores: [], f1: 0, chars: 0, hidden: 0, injectionFlag: false, ms: Date.now() - t, inputTokens: 0, outputTokens: 0, error: String(e).slice(0, 300) };
  }
}

const queue = [...todo];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      let row = await runJob(j);
      if (row.error) row = await runJob(j);
      fs.appendFileSync(runsPath, JSON.stringify(row) + "\n");
      if (!row.error) done.set(row.key, row);
      tok += row.inputTokens + row.outputTokens;
      finished++;
      const eta = ((Date.now() - t0) / finished) * (todo.length - finished) / 1000;
      console.log(`[${finished}/${todo.length}] ${row.key} ${row.error ? `ERROR ${row.error.slice(0, 80)}` : `${row.total}/100 f1=${row.f1.toFixed(2)}`}  · ${(tok / 1000).toFixed(0)}k tok · eta ${Math.round(eta)}s`);
    }
  }),
);

// 4. Summary.
const rows = jobs.map((j) => done.get(keyOf(j))).filter((r): r is Row => !!r);
const failed = jobs.length - rows.length;
const summary = summarise(rows, items.length, failed);
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
fs.writeFileSync(`${OUT}/summary.md`, markdown(summary));
console.log("\n" + markdown(summary));

function bagF1(pred: string, truth: string): number {
  const count = (t: string[]) => t.reduce((m, w) => m.set(w, (m.get(w) ?? 0) + 1), new Map<string, number>());
  const p = count(tokens(pred));
  const g = count(tokens(truth));
  let overlap = 0;
  for (const [w, n] of p) overlap += Math.min(n, g.get(w) ?? 0);
  const np = [...p.values()].reduce((a, b) => a + b, 0);
  const ng = [...g.values()].reduce((a, b) => a + b, 0);
  if (!np || !ng || !overlap) return 0;
  const precision = overlap / np;
  const recall = overlap / ng;
  return (2 * precision * recall) / (precision + recall);
}

function summarise(rows: Row[], resumes: number, failed: number) {
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const first = (p: Pipeline, t: Track) => rows.filter((r) => r.pipeline === p && r.track === t && r.rep === 0);
  const cleanScore = (p: Pipeline, id: string) => first(p, "clean").find((r) => r.id === id)?.total ?? null;
  const tracks = (["clean", "scanned", "injected"] as Track[]).map((track) => ({
    track,
    pipelines: (["vision", "text"] as Pipeline[]).map((pipeline) => {
      const rs = first(pipeline, track);
      const deltas = rs.map((r) => (r.total ?? 0) - (cleanScore(pipeline, r.id) ?? r.total ?? 0));
      return {
        pipeline,
        n: rs.length,
        f1: r2(mean(rs.map((r) => r.f1))),
        emptyRate: r2(rs.filter((r) => r.chars < 50).length / (rs.length || 1)),
        meanScore: r1(mean(rs.map((r) => r.total ?? 0))),
        meanDelta: r1(mean(deltas)),
        meanAbsDelta: r1(mean(deltas.map(Math.abs))),
        maxDelta: Math.max(0, ...deltas),
        flaggedRate: r2(rs.filter((r) => r.hidden > 0 || r.injectionFlag).length / (rs.length || 1)),
        hiddenFoundRate: r2(rs.filter((r) => r.hidden > 0).length / (rs.length || 1)),
        p50ms: median(rs.map((r) => r.ms)),
        meanTokens: Math.round(mean(rs.map((r) => r.inputTokens + r.outputTokens))),
      };
    }),
  }));
  const consistency = (["vision", "text"] as Pipeline[]).map((pipeline) => {
    const pairs = rows.filter((r) => r.pipeline === pipeline && r.track === "clean" && r.rep === 1).map((r) => Math.abs((r.total ?? 0) - (cleanScore(pipeline, r.id) ?? 0)));
    return { pipeline, pairs: pairs.length, meanAbsDiff: r1(mean(pairs)), maxDiff: Math.max(0, ...pairs) };
  });
  return { model: process.env.NEBIUS_MODEL, date: new Date().toISOString().slice(0, 10), resumes, runs: rows.length, failed, tracks, consistency };
}

function markdown(s: ReturnType<typeof summarise>): string {
  const lines = [
    `# Vision vs text extraction: ${s.resumes} real resumes`,
    ``,
    `Model: \`${s.model}\` · ${s.date} · ${s.runs} runs${s.failed ? ` · ${s.failed} failed` : ""}`,
    ``,
    `| Track | Pipeline | Text F1 vs source | Empty | Mean score | Mean Δ vs clean | Max Δ | Flagged | p50 latency | Tokens |`,
    `|---|---|---|---|---|---|---|---|---|---|`,
  ];
  for (const t of s.tracks)
    for (const p of t.pipelines)
      lines.push(`| ${t.track} | ${p.pipeline} | ${p.f1} | ${Math.round(p.emptyRate * 100)}% | ${p.meanScore} | ${p.meanDelta > 0 ? "+" : ""}${p.meanDelta} | ${p.maxDelta > 0 ? "+" : ""}${p.maxDelta} | ${Math.round(p.flaggedRate * 100)}% | ${(p.p50ms / 1000).toFixed(1)}s | ${p.meanTokens} |`);
  lines.push(``, `Consistency (same clean resume scored twice):`, ``);
  for (const c of s.consistency) lines.push(`- ${c.pipeline}: mean |Δ| ${c.meanAbsDiff} points, max ${c.maxDiff} (${c.pairs} pairs)`);
  return lines.join("\n") + "\n";
}
