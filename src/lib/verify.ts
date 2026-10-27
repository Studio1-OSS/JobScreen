// Pure verification logic: which links a resume shows, what kind they are, and whether a GitHub account visibly
// belongs to the candidate. Network checks live in src/mastra/tools/links.ts.
import { parse } from "tldts";
import type { GithubOwnership, GithubProject, GithubSummary, LinkKind } from "./schema";

const URLISH = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()"'`,;]*)?)/gi;

/** Every web link visible in the resume (no emails), normalised to https and deduplicated, at most `max`. */
export function extractLinks(texts: string[], max = 8): string[] {
  const out = new Map<string, string>();
  for (const text of texts)
    for (const m of text.matchAll(URLISH)) {
      const at = m.index ?? 0;
      // Part of an email address: after the @, or before it ("noah.kim@…" would otherwise be the site noah.kim).
      if (text[at - 1] === "@" || text[at + m[1].length] === "@" || /@/.test(m[1])) continue;
      if (isAbbreviation(m[1])) continue;
      const url = normaliseUrl(m[1]);
      if (url && !out.has(key(url))) out.set(key(url), url);
    }
  return [...out.values()].slice(0, max);
}

// Degrees and abbreviations parse as hosts on real country domains: "B.Sc" is b.sc, "B.Tech" is b.tech. A bare host
// (no scheme, no path) whose name is a single letter is one of those, not a link.
const isAbbreviation = (raw: string) => !/^https?:\/\//i.test(raw) && !raw.includes("/") && (parse(raw).domainWithoutSuffix ?? "").length === 1;

export function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/[.)\]]+$/, "");
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const info = parse(u.hostname);
    // A real public domain only: "Node.js" or "e.g." in prose parse as hosts but have no listed suffix.
    if (!info.domain || !info.isIcann || info.isIp) return null;
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const key = (url: string) => url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export function kindOf(url: string): LinkKind {
  const domain = parse(url).domain ?? "";
  if (domain === "github.com") return "github";
  if (domain === "linkedin.com") return "linkedin";
  if (["gitlab.com", "bitbucket.org", "kaggle.com", "leetcode.com", "stackoverflow.com", "medium.com", "dev.to", "behance.net", "dribbble.com"].includes(domain)) return "profile";
  return "website";
}

/** Same registrable domain (www. and paths ignored): portfolio.dev/about matches https://www.portfolio.dev. */
export const sameSite = (a: string, b: string) => {
  const da = parse(a).hostname?.replace(/^www\./, "");
  const db = parse(b).hostname?.replace(/^www\./, "");
  return !!da && da === db;
};

/** LinkedIn profile slug, e.g. "maya-okafor" from linkedin.com/in/maya-okafor/. */
const linkedinSlug = (url: string) => /linkedin\.com\/in\/([^/?#]+)/i.exec(url)?.[1]?.toLowerCase() ?? null;

const nameTokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((t) => t.length > 1);

/**
 * The candidate's name for text-only resumes (pasted, Word), which skip the vision reader: the first line, if it looks
 * like a name (2-4 words, letters only). Otherwise empty, and the GitHub check falls back to links alone.
 */
export function guessName(transcript: string): string {
  const first = transcript.split("\n").map((l) => l.replace(/^[#*\s-]+|[*\s]+$/g, "").trim()).find(Boolean) ?? "";
  const words = first.split(/\s+/);
  const looksLikeName = words.length >= 2 && words.length <= 4 && words.every((w) => /^\p{L}[\p{L}.'’-]*$/u.test(w));
  // A false "different name" would wrongly accuse someone, so a heading or job title must never pass as a name.
  return looksLikeName && !words.some((w) => NOT_NAMES.has(w.toLowerCase().replace(/[.'’-]/g, ""))) ? first : "";
}

const NOT_NAMES = new Set(
  "resume cv curriculum vitae profile summary objective experience education skills contact about senior junior lead principal staff chief head intern engineer developer designer manager director analyst accountant consultant teacher specialist assistant officer coordinator administrator representative executive associate technician nurse sales marketing software data product project full stack frontend backend".split(" "),
);

/**
 * True when both names share their first and last tokens (order-free), or one contains the other entirely.
 * "Maya Okafor" ~ "Maya N. Okafor" ~ "okafor maya"; "Maya Okafor" !~ "Maya Smith". null when either name is unknown.
 */
export function namesMatch(a: string, b: string): boolean | null {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (x.length < 2 || y.length < 1) return null;
  const sx = new Set(x);
  const sy = new Set(y);
  if (y.every((t) => sx.has(t)) || x.every((t) => sy.has(t))) return true;
  return sy.has(x[0]) && sy.has(x[x.length - 1]);
}

/**
 * Does this GitHub account visibly belong to the candidate? A link the account itself publishes (its website, its
 * LinkedIn, its public email) that matches the resume confirms it; a matching name alone makes it likely.
 */
export function githubOwnership(
  gh: GithubSummary | null,
  status: "ok" | "not_found" | "unavailable",
  username: string,
  resume: { name: string; email: string; links: string[] },
): GithubOwnership | null {
  if (!username) return null;
  if (status === "not_found") return { username, verdict: "not_found", signals: { name: null, site: false, linkedin: false, email: false }, note: `No GitHub account called @${username} exists.` };
  if (status === "unavailable" || !gh) return { username, verdict: "unknown", signals: { name: null, site: false, linkedin: false, email: false }, note: "GitHub could not be reached (rate limit or network), so ownership wasn't checked." };
  const site = !!gh.blog && resume.links.some((l) => kindOf(l) === "website" && sameSite(l, normaliseUrl(gh.blog!) ?? gh.blog!));
  const resumeLinkedin = resume.links.map(linkedinSlug).filter(Boolean);
  const linkedin = gh.socials.some((s) => {
    const slug = linkedinSlug(s.url);
    return !!slug && resumeLinkedin.includes(slug);
  });
  const email = !!gh.email && !!resume.email && gh.email.toLowerCase() === resume.email.toLowerCase();
  const name = gh.name ? namesMatch(resume.name, gh.name) : null;
  const signals = { name, site, linkedin, email };
  const proof = [site && "its website matches the resume", linkedin && "it links the same LinkedIn", email && "its public email matches"].filter(Boolean) as string[];
  if (proof.length) return { username: gh.username, verdict: "confirmed", signals, note: `Confirmed: ${proof.join(", ")}.` };
  if (name) return { username: gh.username, verdict: "likely", signals, note: `The account's name (${gh.name}) matches, but it shares no link with the resume.` };
  // GitHub usernames and display names often differ from the name on a resume, so a different name is not a flag.
  if (name === false) return { username: gh.username, verdict: "unconfirmed", signals, note: "The account shares no link with the resume, so it can't be confirmed. A different display name on GitHub is common and isn't a flag." };
  return { username: gh.username, verdict: "unconfirmed", signals, note: "The account shows no name and shares no link with the resume, so it can't be confirmed." };
}

/**
 * How a repo linked on the resume relates to the candidate's account. A repo that's private or gone, or that sits on
 * another person's account, is worth a reviewer's eye; an organisation's repo (work, open source) is normal.
 */
export function projectStatus(repo: { status: "ok" | "not_found" | "unavailable"; owner: string; ownerType: string | null }, username: string): GithubProject["status"] {
  if (repo.status === "not_found") return "missing";
  if (repo.status !== "ok") return "unknown";
  if (repo.owner.toLowerCase() === username.toLowerCase()) return "own";
  return repo.ownerType === "Organization" ? "org" : "other";
}
