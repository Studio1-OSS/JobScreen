import { describe, expect, it } from "vitest";
import { PRESETS } from "@/lib/presets";
import type { CategoryResult } from "@/lib/schema";
import { clampScore, findGithubUser, normaliseRubric, plausibleName, recommend, stated, verifyEvidence, weightedTotal } from "@/lib/text";

describe("normaliseRubric", () => {
  it("scales weights to whole numbers that sum to exactly 100", () => {
    const r = normaliseRubric({ ...PRESETS[0], categories: PRESETS[0].categories.map((c, i) => ({ ...c, weight: [3, 3, 3, 1, 1][i] })) });
    expect(r.categories.reduce((s, c) => s + c.weight, 0)).toBe(100);
    expect(r.categories.every((c) => Number.isInteger(c.weight))).toBe(true);
  });
  it("treats all-zero weights as equal instead of zeroing every score", () => {
    const r = normaliseRubric({ ...PRESETS[2], categories: PRESETS[2].categories.map((c) => ({ ...c, weight: 0 })) });
    expect(r.categories.map((c) => c.weight)).toEqual([25, 25, 25, 25]);
  });
  it("keeps at most 6 categories and slugs keys", () => {
    const cats = Array.from({ length: 8 }, (_, i) => ({ key: `Cat ${i}!`, label: `L${i}`, weight: 1, lookFor: "x" }));
    const r = normaliseRubric({ title: "t", summary: "s", categories: cats, redFlags: [] });
    expect(r.categories).toHaveLength(6);
    expect(r.categories[0].key).toBe("cat_0");
  });
});

describe("scoring", () => {
  const cat = (weight: number, score: number): CategoryResult => ({ key: "k", label: "k", weight, score, rationale: "", evidence: [] });
  it("computes the weighted total in code", () => {
    expect(weightedTotal([cat(60, 10), cat(40, 5)])).toBe(80);
  });
  it("maps totals to a call", () => {
    expect([recommend(70), recommend(69), recommend(50), recommend(49)]).toEqual(["advance", "consider", "consider", "decline"]);
  });
  it("clamps and rounds model scores", () => {
    expect([clampScore(11), clampScore(-2), clampScore(7.6), clampScore(Number.NaN)]).toEqual([10, 0, 8, 0]);
  });
});

describe("verifyEvidence", () => {
  it("accepts quotes found word for word, ignoring case and punctuation", () => {
    const [a, b] = verifyEvidence(["Cut CI time from 19 to 7 minutes", "Led a team of 40"], "• Cut CI time from 19 to 7 minutes, by caching.");
    expect(a.verified).toBe(true);
    expect(b.verified).toBe(false);
  });
});

describe("stated", () => {
  it("blanks model placeholders and keeps real values", () => {
    expect(["Not present", "N/A", "not shown.", "Unknown", "—"].map(stated)).toEqual(["", "", "", "", ""]);
    expect(stated(" Maya Okafor ")).toBe("Maya Okafor");
  });
  it("drops a summary line that landed in the name field", () => {
    expect(plausibleName("Detail-oriented 25 years human resources professional who excels")).toBe("");
    expect(plausibleName("José María Álvarez-Ruiz")).toBe("José María Álvarez-Ruiz");
  });
});

describe("findGithubUser", () => {
  it("finds a profile and skips GitHub's own pages", () => {
    expect(findGithubUser("see github.com/orgs/acme and https://github.com/maya-okafor/tallyboard")).toBe("maya-okafor");
    expect(findGithubUser("no links here")).toBeNull();
  });
});
