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

export function findGithubUser(...texts: string[]): string | null {
  for (const text of texts) {
    for (const m of text.matchAll(/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/gi)) {
      if (!NOT_USERS.has(m[1].toLowerCase())) return m[1];
    }
  }
  return null;
}

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
