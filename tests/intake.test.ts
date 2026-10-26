import { describe, expect, it } from "vitest";
import { rubricId } from "@/lib/candidate";
import { fromPaste } from "@/lib/intake";
import { PRESETS } from "@/lib/presets";
import { isCompleteCard } from "@/mastra/agents/scorer";

const resume = (name: string) => `${name}\nBackend Engineer\nBuilt and ran a payments API in Go for three years, cut p99 latency by 40%.`;

describe("fromPaste", () => {
  it("splits on lines of three or more dashes and names each resume by its first line", () => {
    const items = fromPaste(`${resume("Jane Doe")}\n---\n${resume("Sam Lee")}\n-----\ntoo short`);
    expect(items.map((i) => i.name)).toEqual(["Jane Doe", "Sam Lee"]);
    expect(items.every((i) => i.kind === "text")).toBe(true);
  });
});

describe("rubricId", () => {
  it("changes when a weight changes, not when nothing does", () => {
    const a = rubricId(PRESETS[0]);
    expect(rubricId(structuredClone(PRESETS[0]))).toBe(a);
    const b = structuredClone(PRESETS[0]);
    b.categories[0].weight += 1;
    expect(rubricId(b)).not.toBe(a);
  });
});

describe("isCompleteCard", () => {
  const rubric = PRESETS[2];
  const card = (over = {}) => ({
    summary: "Strong ML engineer with production experience.",
    categories: rubric.categories.map((c) => ({ key: c.key, score: 7, rationale: "Shipped models.", evidence: [] })),
    strengths: [],
    gaps: [],
    redFlags: [],
    decision: "consider" as const,
    decisionReason: "Solid production ML, thin on LLM systems.",
    confidence: "medium" as const,
    interviewQuestions: ["Walk me through the model you shipped to production."],
    injectionAttempt: false,
    ...over,
  });
  it("accepts a real scorecard", () => expect(isCompleteCard(card(), rubric)).toBe(true));
  it("rejects the schema skeleton the model sometimes returns under load", () => {
    expect(isCompleteCard(card({ summary: "..." }), rubric)).toBe(false);
    expect(isCompleteCard(card({ categories: [] }), rubric)).toBe(false);
    expect(isCompleteCard(card({ categories: [{ key: "...", score: 0, rationale: "...", evidence: [] }] }), rubric)).toBe(false);
  });
});
