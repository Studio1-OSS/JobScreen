"use client";

import { ArrowDown, ArrowUp, ChevronRight, Download, EyeOff, FileJson, FileText, IdCard, LoaderCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import { callOf, disagrees, displayHeadline, displayName, type Candidate, type Status } from "@/lib/candidate";
import { download } from "@/lib/download";
import { flatSkills } from "@/lib/profile";
import type { Rubric } from "@/lib/schema";
import { REC } from "./rec";

export type Filter = "all" | "advance" | "consider" | "decline" | "review" | "flagged" | "pending" | "failed";
export type Sort = { key: string; dir: 1 | -1 };

type Props = {
  rubric: Rubric;
  all: Candidate[];
  visible: Candidate[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  query: string;
  onQuery: (q: string) => void;
  sort: Sort;
  onSort: (s: Sort) => void;
  currentRubricId: string;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

const FILTERS: { id: Filter; label: string; test: (c: Candidate) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "advance", label: "Advance", test: (c) => !!c.result && callOf(c.result) === "advance" },
  { id: "consider", label: "Consider", test: (c) => !!c.result && callOf(c.result) === "consider" },
  { id: "decline", label: "Decline", test: (c) => !!c.result && callOf(c.result) === "decline" },
  { id: "review", label: "Needs review", test: (c) => !!c.result && disagrees(c.result) },
  { id: "flagged", label: "Flagged", test: (c) => !!c.result && (c.result.reading.hiddenText.length > 0 || c.result.injectionAttempt) },
  { id: "pending", label: "In progress", test: (c) => !c.result && c.status !== "error" },
  { id: "failed", label: "Failed", test: (c) => c.status === "error" },
];

export function Results(p: Props) {
  const cats = p.rubric.categories.slice(0, 6);
  const cols = `2rem minmax(0,1fr) repeat(${cats.length}, 4.25rem) 4.5rem 6.5rem 3rem`;
  const done = p.visible.filter((c) => c.result);

  const sortBy = (key: string) => p.onSort({ key, dir: p.sort.key === key ? (p.sort.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 });
  const arrow = (key: string) => (p.sort.key === key ? p.sort.dir === -1 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : null);

  return (
    <div className="rounded-[24px] border border-hairline bg-canvas">
      <div className="flex flex-col gap-3 border-b border-hairline-soft p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 xl:pb-0" role="tablist" aria-label="Filter candidates">
          {FILTERS.map((f) => {
            const n = p.all.filter(f.test).length;
            if (f.id !== "all" && !n) return null;
            const on = p.filter === f.id;
            return (
              <button key={f.id} role="tab" aria-selected={on} onClick={() => p.onFilter(f.id)} className={`pill shrink-0 ${on ? "bg-ink text-white" : "bg-transparent text-muted hover:bg-surface-card hover:text-ink"}`}>
                {f.label} <span className={on ? "text-white/70" : "text-muted-soft"}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-soft" />
            <input className="field h-9 py-0 pl-9 text-sm sm:w-56" placeholder="Search names, skills…" value={p.query} onChange={(e) => p.onQuery(e.target.value)} aria-label="Search candidates" />
          </label>
          <button className="btn btn-secondary btn-sm" disabled={!done.length} onClick={() => exportCsv(done, p.rubric)} title="Export the candidates shown, in this order">
            <Download className="size-4" /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" disabled={!done.some((c) => c.result?.profile)} onClick={() => exportProfiles(done)} title="Structured profiles (JSON Resume format) of the candidates shown">
            <IdCard className="size-4" /> Profiles
          </button>
          <button className="btn btn-secondary btn-sm" disabled={!done.length} onClick={() => exportJson(done)} title="Full scorecards as JSON">
            <FileJson className="size-4" /> JSON
          </button>
        </div>
      </div>

      <div className="hidden items-center gap-3 border-b border-hairline-soft px-4 py-2 text-xs font-medium text-muted lg:grid" style={{ gridTemplateColumns: cols }}>
        <span />
        <button className="flex items-center gap-1 text-left hover:text-ink" onClick={() => sortBy("name")}>Candidate {arrow("name")}</button>
        {cats.map((c) => (
          <button key={c.key} className="flex items-center justify-center gap-0.5 truncate hover:text-ink" title={`Sort by ${c.label}`} onClick={() => sortBy(c.key)}>
            <span className="truncate">{abbr(c.label)}</span> {arrow(c.key)}
          </button>
        ))}
        <button className="flex items-center justify-end gap-1 hover:text-ink" onClick={() => sortBy("score")}>Score {arrow("score")}</button>
        <span className="text-center">Call</span>
        <span />
      </div>

      {p.visible.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">No candidates match. Clear the search or pick another filter.</p>
      ) : (
        <ol className="divide-y divide-hairline-soft">
          {p.visible.map((c) => (
            <Row key={c.id} c={c} rank={c.result ? done.indexOf(c) + 1 : 0} cols={cols} cats={cats.map((x) => x.key)} stale={!!c.result && c.rubricId !== p.currentRubricId} {...p} />
          ))}
        </ol>
      )}
    </div>
  );
}

function Row({ c, rank, cols, cats, stale, onOpen, onRemove, onRetry }: { c: Candidate; rank: number; cols: string; cats: string[]; stale: boolean } & Props) {
  const r = c.result;
  const hidden = (r?.reading.hiddenText.length ?? 0) > 0;
  const name = displayName(c);
  const remove = (
    <button className="grid size-8 place-items-center rounded-full text-muted-soft hover:bg-surface-card hover:text-ink" onClick={() => onRemove(c.id)} aria-label={`Remove ${name}`}>
      <Trash2 className="size-4" />
    </button>
  );

  const who = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="h-12 w-9 shrink-0 overflow-hidden rounded-[6px] border border-hairline bg-surface-card">
        {c.thumb ? <img src={c.thumb} alt="" className="h-full w-full object-cover object-top" /> : <FileText className="mx-auto mt-3.5 size-4 text-muted-soft" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink">{name}</span>
        {r ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <span className="truncate">{displayHeadline(c)}</span>
            {hidden && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pink px-2 py-0.5 font-semibold text-white">
                <EyeOff className="size-3" /> Hidden text
              </span>
            )}
            {stale && <span className="hidden shrink-0 rounded-full bg-ochre/40 px-2 py-0.5 text-ink lg:inline">old rubric</span>}
          </span>
        ) : c.status === "error" ? (
          <span className="block truncate text-xs text-error">{c.error}</span>
        ) : (
          <Steps c={c} />
        )}
      </span>
    </span>
  );

  if (!r) {
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <span className="hidden w-8 shrink-0 lg:block" />
        <span className="min-w-0 flex-1">{who}</span>
        {c.status === "error" && (
          <button className="btn btn-secondary btn-sm" onClick={() => onRetry(c.id)}>
            <RefreshCw className="size-4" /> Retry
          </button>
        )}
        {remove}
      </li>
    );
  }

  return (
    <li className="group relative">
      <button className="w-full px-4 py-3 text-left hover:bg-surface-soft focus-visible:bg-surface-soft" onClick={() => onOpen(c.id)} aria-label={`Open scorecard for ${name}, ${r.total} of 100, ${callOf(r)}${disagrees(r) ? `, score band says ${r.recommendation}` : ""}`}>
        {/* Wide screens: one grid row with every category score. */}
        <span className="hidden items-center gap-3 lg:grid" style={{ gridTemplateColumns: cols }}>
          <span className="text-center text-sm font-semibold text-muted">{rank}</span>
          {who}
          {cats.map((k) => {
            const s = r.categories.find((x) => x.key === k)?.score;
            return (
              <span key={k} className="text-center">
                <span className="text-sm font-semibold tabular-nums text-ink">{s ?? "–"}</span>
                <span className="mx-auto mt-1 block h-1 w-8 overflow-hidden rounded-full bg-surface-strong">
                  <span className="block h-full rounded-full bg-ink" style={{ width: `${(s ?? 0) * 10}%` }} />
                </span>
              </span>
            );
          })}
          <span className="display text-right text-[26px] leading-none tabular-nums">{r.total}</span>
          <span className="flex flex-col items-center gap-0.5">
            <span className={`pill font-semibold ${REC[callOf(r)].cls}`} title={r.decision ? `Model's call (${r.decision.confidence} confidence): ${r.decision.reason}` : "Score band"}>{REC[callOf(r)].label}</span>
            {disagrees(r) && <span className="text-[11px] font-medium text-warning" title={`The score (${r.total}) falls in the ${REC[r.recommendation].label} band`}>score: {REC[r.recommendation].label.toLowerCase()}</span>}
          </span>
          <span />
        </span>
        {/* Narrow screens: a compact card. */}
        <span className="flex items-center gap-3 lg:hidden">
          <span className="min-w-0 flex-1">{who}</span>
          <span className="shrink-0 text-right">
            <span className="display block text-[26px] leading-none tabular-nums">{r.total}</span>
            <span className={`text-xs ${disagrees(r) ? "font-medium text-warning" : "text-muted"}`}>{REC[callOf(r)].label}{disagrees(r) ? " · review" : ""}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-soft" />
        </span>
      </button>
      <span className="absolute right-4 top-1/2 hidden -translate-y-1/2 lg:block">{remove}</span>
    </li>
  );
}

const STEP_LABELS: Partial<Record<Status, string>> = { preparing: "Preparing", read: "Reading the page", github: "GitHub", score: "Scoring" };

function Steps({ c }: { c: Candidate }) {
  if (c.status === "queued") return <span className="block text-xs text-muted">Waiting in the queue</span>;
  const steps: Status[] = c.kind === "pdf" || c.kind === "image" ? ["preparing", "read", "github", "score"] : ["preparing", "github", "score"];
  const at = steps.indexOf(c.status);
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      {steps.map((s, i) => {
        const label = s === "github" && i < at && c.githubChecked === false ? "No GitHub" : STEP_LABELS[s];
        return (
          <span key={s} className={`flex items-center gap-1 ${i < at ? (label === "No GitHub" ? "text-muted-soft" : "text-ink") : i === at ? "font-semibold text-ink" : "text-muted-soft"}`}>
            {i === at ? <LoaderCircle className="size-3 animate-spin" /> : <span className={`size-1.5 rounded-full ${i < at ? "bg-ink" : "bg-surface-strong"}`} />}
            {label}
          </span>
        );
      })}
    </span>
  );
}

/** Column headers: the label if it's short, else its first word ("Shipped projects" → "Shipped"). The full label is the tooltip. */
const abbr = (label: string) => (label.length <= 9 ? label : (label.split(/[\s&/,:-]+/).find(Boolean) ?? label).slice(0, 9));

function exportCsv(cs: Candidate[], rubric: Rubric) {
  const cats = rubric.categories;
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["rank", "name", "email", "phone", "location", "current_title", "current_company", "years_experience", "linkedin", "github", "top_skills", "file", "score", "model_decision", "decision_confidence", "decision_reason", "score_band", "needs_review", ...cats.map((c) => c.label), "hidden_text", "injection_attempt", "rubric", "summary"],
    ...cs.map((c, i) => {
      const r = c.result!;
      const p = r.profile;
      const link = (net: string) => p?.basics.profiles.find((x) => x.network.toLowerCase().includes(net))?.url ?? "";
      const loc = p ? [p.basics.location.city, p.basics.location.region, p.basics.location.countryCode].filter(Boolean).join(", ") : r.reading.location;
      return [
        i + 1, displayName(c), p?.basics.email || r.reading.email, p?.basics.phone ?? "", loc, p?.meta.currentTitle ?? r.reading.headline, p?.meta.currentCompany ?? "", p?.meta.yearsExperience ?? "", link("linkedin"), link("github") || (r.github?.url ?? ""), p ? flatSkills(p).slice(0, 12).join("; ") : "",
        c.fileName, r.total, callOf(r), r.decision?.confidence ?? "", r.decision?.reason ?? "", r.recommendation, disagrees(r), ...cats.map((k) => r.categories.find((x) => x.key === k.key)?.score ?? ""), r.reading.hiddenText.length > 0, r.injectionAttempt, c.rubricTitle, r.summary,
      ];
    }),
  ];
  download("jobscreen-shortlist.csv", "text/csv", rows.map((r) => r.map(esc).join(",")).join("\n"));
}

/** Every candidate's structured profile, in the JSON Resume format, with JobScreen's score alongside. */
function exportProfiles(cs: Candidate[]) {
  const profiles = cs.filter((c) => c.result?.profile).map((c, i) => ({ ...c.result!.profile!, meta: { ...c.result!.profile!.meta, rank: i + 1, score: c.result!.total, decision: callOf(c.result!), decisionReason: c.result!.decision?.reason ?? "", scoreBand: c.result!.recommendation, file: c.fileName } }));
  download("jobscreen-profiles.json", "application/json", JSON.stringify(profiles, null, 2));
}

function exportJson(cs: Candidate[]) {
  download("jobscreen-scorecards.json", "application/json", JSON.stringify(cs.map(({ thumb: _t, ...c }) => c), null, 2));
}
