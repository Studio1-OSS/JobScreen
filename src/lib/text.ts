// Deterministic text helpers. Nothing here calls a model, so the same input always gives the same answer.
import type { CategoryResult, Evidence, Recommendation, Rubric } from "./schema";

export function tokens(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(/[a-z0-9]{2,}/g) ?? []);
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A quote counts as verified when it appears in the source text, ignoring case and punctuation. */
export function verifyEvidence(quotes: string[], ...sources: string[]): Evidence[] {
  const haystack = squash(sources.join(" "));
  return quotes
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((quote) => {
      const q = squash(quote);
      return { quote, verified: q.length > 0 && haystack.includes(q) };
    });
}

const NOT_USERS = new Set(["orgs", "about", "features", "topics", "sponsors", "settings", "marketplace", "login", "join"]);

const GITHUB_LINK = /github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))(?:\/([A-Za-z0-9._-]+))?/gi;

/** The candidate's GitHub username: their profile link (github.com/user) if the resume shows one, else the first repo's owner. */
export function findGithubUser(...texts: string[]): string | null {
  let owner: string | null = null;
  for (const text of texts) {
    for (const m of text.matchAll(GITHUB_LINK)) {
      if (NOT_USERS.has(m[1].toLowerCase())) continue;
      if (!repoName(m[2])) return m[1];
      owner ??= m[1];
    }
  }
  return owner;
}

/** Repos linked on the resume (github.com/owner/repo), deduplicated, at most `max`. */
export function githubRepos(texts: string[], max = 4): { owner: string; repo: string; url: string }[] {
  const out = new Map<string, { owner: string; repo: string; url: string }>();
  for (const text of texts) {
    for (const m of text.matchAll(GITHUB_LINK)) {
      const repo = repoName(m[2]);
      if (!repo || NOT_USERS.has(m[1].toLowerCase())) continue;
      const key = `${m[1]}/${repo}`.toLowerCase();
      if (!out.has(key)) out.set(key, { owner: m[1], repo, url: `https://github.com/${m[1]}/${repo}` });
    }
  }
  return [...out.values()].slice(0, max);
}

// "linux." at the end of a sentence is the repo "linux"; "tallyboard.git" is "tallyboard".
const repoName = (raw: string | undefined) => (raw ?? "").replace(/\.git$/i, "").replace(/\.+$/, "");

/** Scales rubric weights to whole numbers that sum to exactly 100. */
export function normaliseRubric(rubric: Rubric): Rubric {
  const cats = rubric.categories.filter((c) => c.key && c.label).slice(0, 6);
  const raw = cats.map((c) => (Number.isFinite(c.weight) ? Math.max(0, c.weight) : 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  // All-zero weights would make every total 0; treat them as equal instead.
  const scaled = cats.map((c, i) => ({ ...c, key: slug(c.key || c.label), weight: sum ? (raw[i] / sum) * 100 : 100 / cats.length }));
  const floored = scaled.map((c) => ({ ...c, weight: Math.floor(c.weight) }));
  let rest = 100 - floored.reduce((s, c) => s + c.weight, 0);
  const order = scaled.map((c, i) => [c.weight - Math.floor(c.weight), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) if (rest-- > 0) floored[i].weight += 1;
  return { ...rubric, categories: floored, redFlags: rubric.redFlags.slice(0, 4) };
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "category";

export function weightedTotal(categories: CategoryResult[]): number {
  return Math.round(categories.reduce((s, c) => s + (c.weight * c.score) / 10, 0));
}

export function recommend(total: number): Recommendation {
  return total >= 70 ? "advance" : total >= 50 ? "consider" : "decline";
}

/** Models sometimes fill an absent field with a placeholder ("Not present", "N/A") instead of leaving it empty. */
export const stated = (s: string | null | undefined) =>
  !s || /^\s*(not\s+(present|shown|provided|stated|available|listed|given|mentioned)|n\/?a|none|unknown|null|-+|—)\s*\.?\s*$/i.test(s) ? "" : s.trim();

/** A person's name: at most 5 words, no digits or sentence punctuation. Anything else (a summary line) is dropped. */
export const plausibleName = (s: string | null | undefined) => {
  const n = stated(s);
  return n && n.length <= 50 && n.split(/\s+/).length <= 5 && !/[\d,;:!?()]/.test(n) ? n : "";
};

export const clampScore = (n: number) => Math.min(10, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
