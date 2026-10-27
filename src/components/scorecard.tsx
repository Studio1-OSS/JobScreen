"use client";
// The full scorecard for one resume. Recruiters see it in the shortlist drawer; candidates see it on /check,
// with wording written for them.
import { BadgeCheck, Briefcase, CircleAlert, CircleCheck, CircleHelp, CircleX, Download, ExternalLink, EyeOff, FolderGit2, GraduationCap, Link2, MessageCircleQuestion, Star, TriangleAlert } from "lucide-react";
import { callOf, disagrees, displayHeadline, displayName, type Candidate } from "@/lib/candidate";
import { download, profileFileName } from "@/lib/download";
import { flatSkills } from "@/lib/profile";
import type { GithubOwnership, GithubProject, JsonResume, LinkCheck, Verification } from "@/lib/schema";
import { REC } from "./rec";

type Props = { candidate: Candidate; stale?: boolean; audience: "recruiter" | "candidate" };

export function Scorecard({ candidate, stale = false, audience }: Props) {
  const r = candidate.result!;
  const you = audience === "candidate";
  const headline = displayHeadline(candidate);
  return (
    <div className="space-y-8">
      <header className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          <h3 className="display text-[30px] leading-[1.05] sm:text-[36px]">{displayName(candidate)}</h3>
          <p className="mt-1 text-body">{[headline === candidate.fileName ? "" : headline, r.reading.location].filter(Boolean).join(" · ")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`pill font-semibold ${REC[callOf(r)].cls}`}>{REC[callOf(r)].label}</span>
            {r.reading.email && <span className="pill">{r.reading.email}</span>}
          </div>
        </div>
        <div className="grid size-24 shrink-0 place-items-center rounded-[24px] bg-teal text-white">
          <div className="text-center">
            <p className="display text-[40px] leading-none text-white">{r.total}</p>
            <p className="text-xs text-white/70">of 100</p>
          </div>
        </div>
      </header>

      <p className="text-[17px] leading-relaxed text-body-strong">{r.summary}</p>

      {r.decision && (
        <div className={`rounded-[16px] p-4 ${disagrees(r) ? "bg-ochre/30" : "bg-surface-card"}`}>
          <p className="text-sm text-ink">
            <b>{you ? "Likely call at the first screen" : "Model’s call"}: {REC[r.decision.call].label}</b> <span className="text-muted">· {r.decision.confidence} confidence</span>
          </p>
          <p className="mt-1 text-sm text-body">{r.decision.reason}</p>
          <p className="mt-2 text-xs text-muted">
            Score band: {REC[r.recommendation].label} ({r.total}/100, from the weighted category scores).
            {disagrees(r) && (you ? " The two disagree: you're near a cut-off, where small changes matter most." : " The two disagree, so this one deserves a closer human look.")}
          </p>
        </div>
      )}

      {stale && !you && (
        <p className="rounded-[12px] bg-ochre/30 px-4 py-3 text-sm text-ink">
          Scored with an older version of the rubric. Use <b>Rescore</b> above the list to compare everyone on the current one.
        </p>
      )}
      {r.reading.source === "text" && (
        <p className="rounded-[12px] bg-surface-card px-4 py-3 text-sm text-body">
          {candidate.kind === "docx" ? "Word file" : "Pasted text"}: scored from its text, without the vision read or the hidden-text check (those run on PDFs and images).
        </p>
      )}

      {r.reading.hiddenText.length > 0 && (
        <div className="rounded-[24px] bg-pink p-6 text-white">
          <p className="flex items-center gap-2 font-semibold"><EyeOff className="size-5" /> Hidden text found in this PDF</p>
          <p className="mt-1 text-sm text-white/85">
            {you
              ? "Your file contains text nobody can see on the page (white, microscopic or off-page). Hiring teams increasingly treat this as keyword stuffing and reject for it. Remove it before you apply."
              : "This text is in the file but invisible on the page (white, microscopic or off-page). A text-only screener would read it; JobScreen scored only what is visible."}
          </p>
          <ul className="mt-3 space-y-2">
            {r.reading.hiddenText.map((h, i) => (
              <li key={i} className="rounded-[12px] bg-white/15 px-3 py-2 font-mono text-xs leading-relaxed">“{h}”</li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <p className="eyebrow mb-3 text-muted">Scorecard</p>
        <ul className="space-y-3">
          {r.categories.map((c) => (
            <li key={c.key} className="rounded-[16px] border border-hairline p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-ink">{c.label} <span className="text-sm font-normal text-muted">· weight {c.weight}</span></p>
                <p className="display text-xl">{c.score}<span className="text-sm text-muted">/10</span></p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-strong">
                <div className="h-full rounded-full bg-ink" style={{ width: `${c.score * 10}%` }} />
              </div>
              <p className="mt-2 text-sm text-body">{c.rationale}</p>
              {c.evidence.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {c.evidence.map((e, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      {e.verified ? (
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="Quote found in the resume" />
                      ) : (
                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Quote not found word for word" />
                      )}
                      <span className="italic text-body">“{e.quote}”</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <CircleCheck className="size-3.5 text-success" /> quote found word for word in the resume
          <CircleAlert className="ml-2 size-3.5 text-warning" /> paraphrased or not found
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <ListCard title="Strengths" items={r.strengths} />
        <ListCard title={you ? "Gaps to address" : "Gaps"} items={r.gaps} />
      </div>

      {r.redFlags.length > 0 && (
        <section className="rounded-[24px] bg-peach p-6">
          <p className="flex items-center gap-2 font-semibold text-ink"><TriangleAlert className="size-5" /> {you ? "What would hold you back" : "Red flags"}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
            {r.redFlags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </section>
      )}

      {r.interviewQuestions.length > 0 && (
      <section className="rounded-[24px] bg-lavender p-6">
        <p className="flex items-center gap-2 font-semibold text-ink"><MessageCircleQuestion className="size-5" /> {you ? "Questions you'd likely be asked" : "Ask in the interview"}</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] text-ink">
          {r.interviewQuestions.map((q, i) => <li key={i}>{q}</li>)}
        </ol>
      </section>
      )}

      {r.verification && <Verify v={r.verification} you={you} />}

      {r.github && (
        <section>
          <p className="eyebrow mb-3 flex items-center gap-2 text-muted">
            <FolderGit2 className="size-4" /> GitHub · @{r.github.username} · {r.github.publicRepos} repos
            {r.github.externalMergedPRs != null && ` · ${r.github.externalMergedPRs} merged PRs elsewhere`}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {r.github.topRepos.map((repo) => (
              <li key={repo.url}>
                <a href={repo.url} target="_blank" rel="noreferrer" className="block h-full rounded-[16px] border border-hairline p-4 hover:border-ink">
                  <p className="flex items-center justify-between gap-2 font-semibold text-ink">
                    <span className="truncate">{repo.name}</span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted" />
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{repo.description || "No description"}</p>
                  <p className="mt-2 flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><Star className="size-3" /> {repo.stars}</span>
                    {repo.language && <span>{repo.language}</span>}
                    {repo.kind === "fork" && <span>fork</span>}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.profile && <Profile p={r.profile} fileName={profileFileName(displayName(candidate))} />}

      <section>
        <p className="eyebrow mb-3 text-muted">{you ? "What was read from your resume" : "What the model read"}</p>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          {candidate.thumb && <img src={candidate.thumb} alt="First page of the resume" className="w-full rounded-[12px] border border-hairline" />}
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[16px] bg-surface-soft p-4 font-sans text-xs leading-relaxed text-body">{r.reading.transcript}</pre>
        </div>
        <p className="mt-2 text-xs text-muted">
          {r.reading.source === "vision" ? `${r.reading.pages} page${r.reading.pages === 1 ? "" : "s"} read as images` : "read as text"} · {(r.usage.inputTokens + r.usage.outputTokens).toLocaleString()} tokens · read {(r.ms.read / 1000).toFixed(1)}s · scored {(r.ms.score / 1000).toFixed(1)}s
        </p>
      </section>
    </div>
  );
}

const LINK_STATUS: Record<LinkCheck["status"], { icon: typeof CircleCheck; cls: string; label: string }> = {
  ok: { icon: CircleCheck, cls: "text-success", label: "Loads" },
  broken: { icon: CircleX, cls: "text-error", label: "Broken" },
  unreachable: { icon: CircleX, cls: "text-error", label: "Unreachable" },
  blocked: { icon: CircleHelp, cls: "text-muted", label: "Can't check" },
};
const OWNERSHIP: Record<GithubOwnership["verdict"], { label: string; cls: string }> = {
  confirmed: { label: "Verified owner", cls: "bg-mint text-ink" },
  likely: { label: "Likely theirs", cls: "bg-surface-strong text-ink" },
  unconfirmed: { label: "Not linked", cls: "bg-ochre/50 text-ink" },
  not_found: { label: "Doesn't exist", cls: "bg-coral text-white" },
  unknown: { label: "Not checked", cls: "bg-surface-strong text-ink" },
};
const PROJECT: Record<GithubProject["status"], { label: string; cls: string }> = {
  own: { label: "Their repo", cls: "bg-mint text-ink" },
  org: { label: "Org repo", cls: "bg-surface-strong text-ink" },
  other: { label: "Another account", cls: "bg-coral text-white" },
  missing: { label: "Private or missing", cls: "bg-coral text-white" },
  unknown: { label: "Not checked", cls: "bg-surface-strong text-ink" },
};

function Verify({ v, you }: { v: Verification; you: boolean }) {
  if (!v.links.length && !v.github) return null;
  // Results saved by an older version can carry a verdict that no longer exists.
  const own = v.github ? (OWNERSHIP[v.github.verdict] ?? OWNERSHIP.unknown) : OWNERSHIP.unknown;
  return (
    <section>
      <p className="eyebrow mb-3 flex items-center gap-2 text-muted"><Link2 className="size-4" /> Links and GitHub</p>
      {v.github && (
        <div className="mb-3 rounded-[16px] border border-hairline p-4">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            <FolderGit2 className="size-4" /> github.com/{v.github.username}
            <span className={`pill font-semibold ${own.cls}`}>
              {v.github.verdict === "confirmed" && <BadgeCheck className="size-3.5" />}
              {own.label}
            </span>
          </p>
          <p className="mt-1 text-sm text-body">{v.github.note}</p>
          {!!v.github.projects?.length && (
            <ul className="mt-3 space-y-1.5">
              {v.github.projects.map((p) => (
                <li key={p.url} className="flex flex-wrap items-center gap-2 text-sm">
                  <a href={p.url} target="_blank" rel="noreferrer nofollow" className="text-ink hover:underline">{p.owner}/{p.repo}</a>
                  <span className={`pill font-semibold ${PROJECT[p.status].cls}`}>{PROJECT[p.status].label}</span>
                </li>
              ))}
            </ul>
          )}
          {you && (v.github.verdict === "likely" || v.github.verdict === "unconfirmed") && (
            <p className="mt-1 text-xs text-muted">Tip: add your portfolio site or LinkedIn to your GitHub profile so recruiters can confirm it&apos;s you.</p>
          )}
        </div>
      )}
      {v.links.length > 0 && (
        <ul className="divide-y divide-hairline-soft rounded-[16px] border border-hairline">
          {v.links.map((l) => {
            const s = LINK_STATUS[l.status];
            return (
              <li key={l.url} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <s.icon className={`mt-0.5 size-4 shrink-0 ${s.cls}`} aria-label={s.label} />
                <span className="min-w-0 flex-1">
                  <a href={l.url} target="_blank" rel="noreferrer nofollow" className="block truncate text-ink hover:underline">{l.url.replace(/^https?:\/\//, "")}</a>
                  <span className="text-xs text-muted">{l.note}{l.httpStatus && l.status !== "ok" ? ` (${l.httpStatus})` : ""}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Each link is opened from the server with a real request; private network addresses are never opened.</p>
    </section>
  );
}

function Profile({ p, fileName }: { p: JsonResume; fileName: string }) {
  const skills = flatSkills(p);
  const place = [p.basics.location.city, p.basics.location.region, p.basics.location.countryCode].filter(Boolean).join(", ");
  const facts = [
    p.meta.yearsExperience != null && `${p.meta.yearsExperience} yrs experience`,
    p.meta.currentTitle && `${p.meta.currentTitle}${p.meta.currentCompany ? ` at ${p.meta.currentCompany}` : ""}`,
    place,
    p.basics.phone,
  ].filter(Boolean) as string[];
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="eyebrow text-muted">Profile</p>
        <button className="btn btn-secondary btn-sm" onClick={() => download(fileName, "application/json", JSON.stringify(p, null, 2))} title="Download this profile in the JSON Resume format">
          <Download className="size-4" /> JSON Resume
        </button>
      </div>
      {facts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {facts.map((f) => <span key={f} className="pill">{f}</span>)}
        </div>
      )}
      {p.work.length > 0 && (
        <ol className="space-y-3 border-l-2 border-surface-strong pl-4">
          {p.work.map((w, i) => (
            <li key={i}>
              <p className="flex items-start gap-2 text-sm font-semibold text-ink">
                <Briefcase className="mt-0.5 size-3.5 shrink-0 text-muted" />
                <span>{[w.position, w.name].filter(Boolean).join(" · ")}</span>
              </p>
              <p className="ml-5.5 text-xs text-muted">{[range(w.startDate, w.endDate), w.location].filter(Boolean).join(" · ")}</p>
              {w.highlights.length > 0 && (
                <details className="ml-5.5 mt-1 text-sm text-body">
                  <summary className="cursor-pointer text-xs font-semibold text-ink">{w.highlights.length} highlight{w.highlights.length === 1 ? "" : "s"}</summary>
                  <ul className="mt-1 list-disc space-y-1 pl-5">{w.highlights.map((h, j) => <li key={j}>{h}</li>)}</ul>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
      {p.education.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {p.education.map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink">
              <GraduationCap className="mt-0.5 size-3.5 shrink-0 text-muted" />
              <span>
                {[e.studyType, e.area].filter(Boolean).join(", ")}{e.institution && <span className="text-muted"> · {e.institution}</span>}
                {e.endDate && <span className="text-muted"> · {e.endDate}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {skills.slice(0, 30).map((k) => <span key={k} className="rounded-full border border-hairline px-2.5 py-0.5 text-xs text-ink">{k}</span>)}
          {skills.length > 30 && <span className="px-1 text-xs text-muted">+{skills.length - 30} more</span>}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Extracted from the visible resume text. Check anything you act on against the original.</p>
    </section>
  );
}

const range = (a: string, b: string) => (a || b ? `${a || "?"} – ${b || "present"}` : "");

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[16px] bg-surface-card p-5">
      <p className="font-semibold text-ink">{title}</p>
      {items.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-body">
          {items.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">None noted.</p>
      )}
    </section>
  );
}
