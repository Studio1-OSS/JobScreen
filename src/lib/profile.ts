// Deterministic post-processing of the extracted profile: JSON Resume shape, years of experience, current role.
import type { JsonResume, ModelProfile } from "./schema";
import { plausibleName, stated } from "./text";

const clean = (s: string | undefined) => stated((s ?? "").replace(/\s+/g, " "));
const DATE = /^(\d{4})(?:-(\d{1,2}))?/;

/** "2021-03" → months since year 0; "2021" → January of that year; anything else → null. */
export function monthOf(date: string): number | null {
  const m = DATE.exec(clean(date));
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Math.min(12, Math.max(1, Number(m[2]))) : 1;
  return year < 1950 || year > 2100 ? null : year * 12 + (month - 1);
}

/**
 * Total years of work, counting overlapping roles once. A role with no end date counts until `now` only if it is
 * marked current; a role whose dates can't be read is left out rather than guessed.
 */
export function yearsOfExperience(work: { startDate: string; endDate: string; current?: boolean }[], now = new Date()): number | null {
  const nowMonth = now.getFullYear() * 12 + now.getMonth();
  const spans = work
    .map((w) => {
      const start = monthOf(w.startDate);
      const end = monthOf(w.endDate) ?? (w.current ? nowMonth : null);
      return start !== null && end !== null && end >= start ? ([start, Math.min(end, nowMonth) + 1] as const) : null;
    })
    .filter((s): s is readonly [number, number] => !!s)
    .sort((a, b) => a[0] - b[0]);
  if (!spans.length) return null;
  let months = 0;
  let [from, to] = spans[0];
  for (const [s, e] of spans.slice(1)) {
    if (s <= to) to = Math.max(to, e);
    else {
      months += to - from;
      [from, to] = [s, e];
    }
  }
  months += to - from;
  return Math.round((months / 12) * 10) / 10;
}

export function toJsonResume(p: ModelProfile, generatedBy: string): JsonResume {
  const work = p.work
    .filter((w) => clean(w.name) || clean(w.position))
    .map((w) => ({ ...w, name: clean(w.name), position: clean(w.position), location: clean(w.location), endDate: w.current ? "" : clean(w.endDate), startDate: clean(w.startDate), summary: clean(w.summary), highlights: w.highlights.map(clean).filter(Boolean) }));
  // The current role: one marked current, else the most recent start date.
  const current = work.find((_, i) => p.work[i]?.current) ?? [...work].sort((a, b) => (monthOf(b.startDate) ?? -1) - (monthOf(a.startDate) ?? -1))[0];
  const b = p.basics;
  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: plausibleName(clean(b.name)),
      label: clean(b.label),
      email: clean(b.email),
      phone: clean(b.phone),
      url: clean(b.url),
      summary: clean(b.summary),
      location: { city: clean(b.city), region: clean(b.region), countryCode: clean(b.countryCode).toUpperCase().slice(0, 2) },
      profiles: b.profiles.filter((x) => clean(x.url) || clean(x.username)).map((x) => ({ network: clean(x.network), username: clean(x.username), url: clean(x.url) })),
    },
    work: work.map(({ current: _c, ...w }) => w),
    education: p.education.filter((e) => clean(e.institution) || clean(e.studyType)),
    skills: p.skills.map((s) => ({ name: clean(s.name), keywords: s.keywords.map(clean).filter(Boolean) })).filter((s) => s.name || s.keywords.length),
    projects: p.projects.filter((x) => clean(x.name)),
    awards: p.awards.filter((x) => clean(x.title)),
    certificates: p.certificates.filter((x) => clean(x.name)),
    languages: p.languages.filter((x) => clean(x.language)),
    meta: { yearsExperience: yearsOfExperience(p.work), currentTitle: current?.position ?? clean(b.label), currentCompany: current?.name ?? "", generatedBy },
  };
}

/** Flat skill list for search and CSV: group names that look like skills plus every keyword, deduplicated. */
export function flatSkills(r: JsonResume): string[] {
  const seen = new Map<string, string>();
  for (const s of r.skills) for (const k of s.keywords.length ? s.keywords : [s.name]) if (k && !seen.has(k.toLowerCase())) seen.set(k.toLowerCase(), k);
  return [...seen.values()];
}
