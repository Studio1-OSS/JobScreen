import type { Recommendation, Rubric, Screening } from "./schema";

export type IntakeKind = "pdf" | "image" | "docx" | "text";

/** One resume as it arrived. The File or text lives in memory only; it is never stored. */
export type Intake = { id: string; kind: IntakeKind; name: string; size: number; key: string; file?: File; text?: string; source?: string };

export type Status = "queued" | "preparing" | "read" | "github" | "score" | "done" | "error";
export const ACTIVE: Status[] = ["preparing", "read", "github", "score"];

export type Candidate = {
  id: string;
  key: string;
  fileName: string;
  kind: IntakeKind;
  source?: string;
  status: Status;
  rubricId: string;
  rubricTitle: string;
  thumb?: string;
  /** Display name for resumes without a vision read (pasted text, DOCX). */
  fallbackName?: string;
  githubChecked?: boolean;
  result?: Screening;
  error?: string;
  addedAt: number;
  ms?: number;
};

/** A short fingerprint of everything in a rubric that affects scores, to tell when results are out of date. */
export function rubricId(r: Rubric): string {
  const s = JSON.stringify([r.title, r.categories.map((c) => [c.key, c.label, c.weight, c.lookFor]), r.redFlags]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The call shown to reviewers: the model's decision, or the score band for results saved before decisions existed. */
export const callOf = (r: Screening): Recommendation => r.decision?.call ?? r.recommendation;
/** The model's call and the score band point different ways: worth a human look. */
export const disagrees = (r: Screening) => !!r.decision && r.decision.call !== r.recommendation;

export const displayName = (c: Candidate) => c.result?.reading.name || c.result?.profile?.basics.name || c.fallbackName || c.fileName;
export const displayHeadline = (c: Candidate) => c.result?.reading.headline || c.result?.profile?.meta.currentTitle || c.result?.profile?.basics.label || c.fileName;
