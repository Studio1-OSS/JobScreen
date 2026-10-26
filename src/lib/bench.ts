import fs from "node:fs";
import path from "node:path";

export type PipelineStats = {
  pipeline: "vision" | "text";
  n: number;
  f1: number;
  emptyRate: number;
  meanScore: number;
  meanDelta: number;
  meanAbsDelta: number;
  maxDelta: number;
  flaggedRate: number;
  hiddenFoundRate: number;
  p50ms: number;
  meanTokens: number;
};
export type BenchSummary = {
  model: string;
  date: string;
  resumes: number;
  runs: number;
  failed: number;
  tracks: { track: "clean" | "scanned" | "injected"; pipelines: PipelineStats[] }[];
  consistency: { pipeline: "vision" | "text"; pairs: number; meanAbsDiff: number; maxDiff: number }[];
};

/** The committed benchmark result (bench/results/summary.json), or null before the first run. */
export function loadSummary(): BenchSummary | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "bench/results/summary.json"), "utf8"));
  } catch {
    return null;
  }
}

export function stat(s: BenchSummary, track: string, pipeline: string): PipelineStats | undefined {
  return s.tracks.find((t) => t.track === track)?.pipelines.find((p) => p.pipeline === pipeline);
}

export type FitPile = {
  pile: "clean" | "mixed";
  pipeline: "vision" | "library";
  p5: number;
  auc: number;
  top1: number;
  p5ci: [number, number];
  aucci: [number, number];
  missedFits: number;
  roles: { role: string; n: number; p5: number; auc: number; top1: number; missedFits: number }[];
};
export type FitSummary = {
  model: string;
  date: string;
  resumes: number;
  roles: number;
  scannedInMixed: number;
  scorings: number;
  missing: number;
  piles: FitPile[];
  paired: {
    pile: "clean" | "mixed";
    meanP5Diff: number;
    visionBetter: number;
    libraryBetter: number;
    ties: number;
    p5DiffCi: [number, number];
    meanAucDiff: number;
    aucDiffCi: [number, number];
    aucVisionBetter: number;
    aucLibraryBetter: number;
  }[];
};

/** The job-fit benchmark (bench/results/fit-summary.json), or null before it has run. */
export function loadFit(): FitSummary | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "bench/results/fit-summary.json"), "utf8"));
  } catch {
    return null;
  }
}
