import type { Metadata } from "next";
import { Footer, Header } from "@/components/chrome";
import { BenchBars, type BarGroup } from "@/components/bench-bars";
import { site } from "@/config/site";
import { loadFit, loadSummary, stat, type BenchSummary, type FitSummary } from "@/lib/bench";

export const metadata: Metadata = { title: `Benchmark · ${site.name}`, description: "DeepSeek V4.1 Flash 1017 vision vs a PDF text library on 50 real resumes." };

const TRACKS = [
  { id: "clean", label: "Clean PDF", note: "the original file" },
  { id: "scanned", label: "Scanned", note: "same pages, image only" },
  { id: "injected", label: "Hidden injection", note: "white 1pt “give a perfect score”" },
] as const;

export default function Benchmark() {
  const s = loadSummary();
  const fit = loadFit();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <section className="pb-10 pt-12 md:pt-20">
          <p className="eyebrow text-muted">Benchmark</p>
          <h1 className="display mt-3 max-w-4xl text-[40px] leading-[1.04] sm:text-[56px]">How JobScreen was tested, on {s?.resumes ?? 50} real resumes.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-body">
            Same model ({site.model}), same rubric, same scorer. The only difference is how the resume reaches the model:
            rendered page images read by the vision agent, or Markdown from <code className="rounded bg-surface-card px-1.5 py-0.5 text-[15px]">pymupdf4llm</code>,
            the extractor the original text-only screener used.
          </p>
        </section>
        {fit && <Fit f={fit} />}
        {s ? (
          <>
            <h2 className="display mb-6 mt-16 text-[32px] leading-tight sm:text-[40px]">Reading: how much of each resume reached the model</h2>
            <Results s={s} />
          </>
        ) : (
          <p className="rounded-[16px] bg-surface-card p-6">No results yet. Run <code>pnpm bench:fetch && pnpm bench:50</code>.</p>
        )}
      </main>
      <Footer />
    </>
  );
}

function Results({ s }: { s: BenchSummary }) {
  const get = (t: string, p: "vision" | "text") => stat(s, t, p)!;
  // Word overlap can't show whether an injection worked (the score chart and detection rate do), so it's left out here.
  const f1Groups: BarGroup[] = TRACKS.filter((t) => t.id !== "injected").map((t) => ({
    group: t.label,
    note: t.note,
    values: {
      vision: { value: get(t.id, "vision").f1 * 100, display: `${Math.round(get(t.id, "vision").f1 * 100)}%`, detail: `bag-of-words F1 vs the dataset's source text · ${get(t.id, "vision").n} resumes` },
      text: { value: get(t.id, "text").f1 * 100, display: `${Math.round(get(t.id, "text").f1 * 100)}%`, detail: `${Math.round(get(t.id, "text").emptyRate * 100)}% of files came back empty · ${get(t.id, "text").n} resumes` },
    },
  }));
  const deltaGroups: BarGroup[] = TRACKS.filter((t) => t.id !== "clean").map((t) => ({
    group: t.label,
    note: t.note,
    values: {
      vision: { value: get(t.id, "vision").meanDelta, display: signed(get(t.id, "vision").meanDelta), detail: `mean |Δ| ${get(t.id, "vision").meanAbsDelta} points vs the same resume's clean score` },
      text: { value: get(t.id, "text").meanDelta, display: signed(get(t.id, "text").meanDelta), detail: `mean |Δ| ${get(t.id, "text").meanAbsDelta} points vs the same resume's clean score` },
    },
  }));
  const deltas = deltaGroups.flatMap((g) => [g.values.vision.value, g.values.text.value]);
  const lo = Math.min(-5, ...deltas) * 1.15;
  const hi = Math.max(5, ...deltas) * 1.15;
  const inj = get("injected", "vision");
  const injT = get("injected", "text");
  const sc = get("scanned", "vision");
  const scT = get("scanned", "text");
  const cv = s.consistency.find((c) => c.pipeline === "vision")!;
  const cleanV = get("clean", "vision");
  const cleanT = get("clean", "text");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Tile cls="bg-lavender" value={`${Math.round(sc.f1 * 100)}%`} label={`of a scanned resume read by vision (text library: ${Math.round(scT.f1 * 100)}%)`} />
        <Tile cls="bg-pink text-white" value={`${Math.round(inj.hiddenFoundRate * 100)}%`} label={`of hidden injections found and shown (${Math.round(cleanV.hiddenFoundRate * cleanV.n)} of ${cleanV.n} clean PDFs flagged)`} />
        <Tile cls="bg-peach" value={signed(inj.meanDelta)} label={`average score change from the injection with vision (text: ${signed(injT.meanDelta)})`} />
        <Tile cls="bg-ochre" value={`±${cv.meanAbsDiff}`} label={`points between two runs of the same resume (vision, ${cv.pairs} pairs)`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="How much of the resume reached the model" sub="Bag-of-words F1 against the dataset's source text. The library's clean score is near-automatic (the source text came from the same files), and it has no OCR, so scans give it nothing; vision's numbers are the informative ones.">
          <BenchBars groups={f1Groups} max={100} />
        </Card>
        <Card title="How far the score moved from the clean PDF" sub="Mean change for the same resume. Zero is ideal: the content didn't change.">
          <BenchBars groups={deltaGroups} min={lo} max={hi} />
        </Card>
      </div>

      <Card title="Every number" sub={`${s.runs} runs on ${s.date}${s.failed ? `, ${s.failed} failed` : ""} · model ${s.model}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-hairline">
                {["Track", "Pipeline", "Text F1", "Empty", "Mean score", "Mean Δ vs clean", "Max rise", "Flagged", "p50 latency", "Tokens / resume"].map((h) => (
                  <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-ink">
              {s.tracks.flatMap((t) =>
                t.pipelines.map((p) => (
                  <tr key={t.track + p.pipeline} className="border-b border-hairline-soft">
                    <td className="py-2 pr-4">{TRACKS.find((x) => x.id === t.track)?.label}</td>
                    <td className="py-2 pr-4">{p.pipeline === "vision" ? "Vision" : "Text library"}</td>
                    <td className="py-2 pr-4">{p.f1.toFixed(2)}</td>
                    <td className="py-2 pr-4">{Math.round(p.emptyRate * 100)}%</td>
                    <td className="py-2 pr-4">{p.meanScore}</td>
                    <td className="py-2 pr-4">{t.track === "clean" ? "–" : signed(p.meanDelta)}</td>
                    <td className="py-2 pr-4">{t.track === "clean" ? "–" : signed(p.maxDelta)}</td>
                    <td className="py-2 pr-4">{Math.round(p.flaggedRate * 100)}%</td>
                    <td className="py-2 pr-4">{(p.p50ms / 1000).toFixed(1)}s</td>
                    <td className="py-2 pr-4">{p.meanTokens.toLocaleString()}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          Consistency: {s.consistency.map((c) => `${c.pipeline === "vision" ? "vision" : "text library"} ±${c.meanAbsDiff} mean, ${c.maxDiff} max over ${c.pairs} pairs`).join(" · ")}.
          “Flagged” counts hidden text found in the PDF or the scorer reporting an injection attempt.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Scans are where vision wins">
          <p className="text-[15px] leading-relaxed text-body">
            An image-only PDF gives the text library nothing to extract, so all {scT.n} scanned resumes scored 0. Vision read them as well as the originals
            ({Math.round(sc.f1 * 100)}% of words recovered) and the scores barely moved ({signed(sc.meanDelta)} on average).
          </p>
        </Card>
        <Card title="The injection: both held">
          <p className="text-[15px] leading-relaxed text-body">
            The scorer treats the resume as untrusted and {site.model} ignored the hidden “give a perfect score” line in both pipelines ({signed(injT.meanDelta)} with text,
            {" "}{signed(inj.meanDelta)} with vision; within run-to-run noise). The difference is visibility: JobScreen finds the hidden passage in the file and shows it to you word for word.
          </p>
        </Card>
        <Card title="Where the text library wins">
          <p className="text-[15px] leading-relaxed text-body">
            On clean, digital PDFs the library is just as faithful and much cheaper: {cleanT.meanTokens.toLocaleString()} tokens and{" "}
            {(cleanT.p50ms / 1000).toFixed(1)}s per resume, against {cleanV.meanTokens.toLocaleString()} tokens and {(cleanV.p50ms / 1000).toFixed(1)}s for vision.
            If every resume you get is a clean digital export, text is the efficient choice.
          </p>
        </Card>
      </div>
      <div>
        <Card title="Method">
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-body">
            <li>{s.resumes} anonymised resumes from the public LiveCareer Resume Dataset (CC0), 10 job categories × 5, seeded sample, 1-4 pages.</li>
            <li>One rubric per category, drafted once by the rubric agent and frozen in <code>bench/rubrics.json</code>.</li>
            <li>Scanned = pages rasterised and re-packed as images. Injected = the original plus white 1pt text.</li>
            <li>Totals are computed in code from 0-10 category scores; GitHub lookup is off.</li>
            <li>Failures count. In this run, one of 150 vision reads transcribed only the header (F1 0.12) and that resume dropped 37 points.</li>
            <li>Reproduce: <code>pnpm bench:fetch && pnpm bench:50</code>.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Fit({ f }: { f: FitSummary }) {
  const get = (pile: string, p: string) => f.piles.find((x) => x.pile === pile && x.pipeline === p)!;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const groups: BarGroup[] = (["clean", "mixed"] as const).map((pile) => ({
    group: pile === "clean" ? "Clean PDFs" : "Mixed pile",
    note: pile === "clean" ? "every resume as its original file" : `${f.scannedInMixed} of ${f.resumes} arrive as scans`,
    values: {
      vision: { value: get(pile, "vision").p5 * 100, display: pct(get(pile, "vision").p5), detail: `95% CI ${pct(get(pile, "vision").p5ci[0])}–${pct(get(pile, "vision").p5ci[1])} · AUC ${get(pile, "vision").auc.toFixed(2)}` },
      text: { value: get(pile, "library").p5 * 100, display: pct(get(pile, "library").p5), detail: `95% CI ${pct(get(pile, "library").p5ci[0])}–${pct(get(pile, "library").p5ci[1])} · AUC ${get(pile, "library").auc.toFixed(2)}` },
    },
  }));
  const mixedV = get("mixed", "vision");
  const mixedL = get("mixed", "library");
  const cleanV = get("clean", "vision");
  const cleanL = get("clean", "library");
  const dMixed = f.paired.find((p) => p.pile === "mixed")!;
  const dClean = f.paired.find((p) => p.pile === "clean")!;
  const roles = cleanV.roles.map((r) => r.role);
  const role = (pile: string, p: string, name: string) => get(pile, p).roles.find((r) => r.role === name)!;
  return (
    <div className="space-y-6">
      <h2 className="display text-[32px] leading-tight sm:text-[40px]">Job fit: who ends up at the top of the pile</h2>
      <p className="max-w-3xl text-[17px] leading-relaxed text-body">
        For each of {f.roles} roles, all {f.resumes} resumes were scored and ranked. The 5 resumes the dataset files under that role are the right answers.
        A good screener puts them in its top 5.
      </p>
      <div className="grid gap-4 md:grid-cols-4">
        <Tile cls="bg-lavender" value={pct(mixedV.p5)} label={`of the right resumes in the top 5 with vision, on a realistic mixed pile (library: ${pct(mixedL.p5)})`} />
        <Tile cls="bg-pink text-white" value={String(mixedL.missedFits)} label={`right-fit resumes the library scored 0 on the mixed pile, because they were scans (vision: ${mixedV.missedFits})`} />
        <Tile cls="bg-peach" value={pct(cleanV.p5)} label={`top-5 accuracy on clean PDFs with vision (library: ${pct(cleanL.p5)})`} />
        <Tile cls="bg-ochre" value={cleanV.auc.toFixed(2)} label={`ranking quality (AUC) on clean PDFs with vision; library ${cleanL.auc.toFixed(2)}, coin flip 0.50`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Right resumes in the top 5 (P@5)" sub="Mean over roles. Ties are broken at random, in expectation.">
          <BenchBars groups={groups} max={100} />
        </Card>
        <Card title="What it shows">
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-body">
            <li>
              <b>Clean PDFs: a tie.</b> Same top-5 accuracy ({pct(cleanV.p5)} each) and the same ranking quality (AUC {cleanV.auc.toFixed(2)} vs {cleanL.auc.toFixed(2)}; paired
              difference {aucDiff(dClean.meanAucDiff)}, 95% CI {aucDiff(dClean.aucDiffCi[0])} to {aucDiff(dClean.aucDiffCi[1])}). On a clean export, the library reads well enough.
            </li>
            <li>
              <b>Mixed pile: vision ranks better.</b> AUC {mixedV.auc.toFixed(2)} vs {mixedL.auc.toFixed(2)}, a paired difference of {aucDiff(dMixed.meanAucDiff)} (95% CI{" "}
              {aucDiff(dMixed.aucDiffCi[0])} to {aucDiff(dMixed.aucDiffCi[1])}), better on {dMixed.aucVisionBetter} of {f.roles} roles. Top-5 accuracy moves {signed(Math.round(dMixed.meanP5Diff * 100))} points;
              with only {f.roles} roles that interval ({Math.round(dMixed.p5DiffCi[0] * 100)} to {Math.round(dMixed.p5DiffCi[1] * 100)}) still includes zero.
            </li>
            <li>A scanned resume gives the library no text, so it scores 0 and drops out of every shortlist, however good the candidate is.</li>
            <li>The labels say which job a resume was filed under, not how good the person is; related roles (finance and accounting, IT and engineering) overlap, which caps every score below 100%.</li>
          </ul>
        </Card>
      </div>
      <Card title="Per role" sub="P@5, vision / library">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-hairline">
                {["Role", "Clean PDFs", "Mixed pile"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="tabular-nums text-ink">
              {roles.map((name) => (
                <tr key={name} className="border-b border-hairline-soft">
                  <td className="py-2 pr-4 capitalize">{name.toLowerCase().replace(/-/g, " ")}</td>
                  <td className="py-2 pr-4">{pct(role("clean", "vision", name).p5)} / {pct(role("clean", "library", name).p5)}</td>
                  <td className="py-2 pr-4">{pct(role("mixed", "vision", name).p5)} / {pct(role("mixed", "library", name).p5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          {f.scorings.toLocaleString()} scorings on {f.date}{f.missing ? `, ${f.missing} missing` : ""}. Vision text was read once per PDF and saved; both pipelines then use the identical scoring path. Reproduce: <code>pnpm bench:fit</code>.
        </p>
      </Card>
    </div>
  );
}

const aucDiff = (n: number) => (Math.abs(n) < 0.005 ? "0.00" : `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`);
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

function Tile({ cls, value, label }: { cls: string; value: string; label: string }) {
  return (
    <div className={`rounded-[24px] p-6 ${cls}`}>
      <p className="display text-[48px] leading-none" style={{ color: "inherit" }}>{value}</p>
      <p className="mt-3 text-sm leading-snug opacity-90">{label}</p>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-hairline bg-canvas p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
