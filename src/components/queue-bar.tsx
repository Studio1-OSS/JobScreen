"use client";

import { Pause, Play, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";

export type Counts = { total: number; done: number; failed: number; queued: number; active: number; stale: number; staleLost: number; avgMs: number };

type Props = {
  counts: Counts;
  concurrency: number;
  paused: boolean;
  rubricTitle: string;
  onConcurrency: (n: number) => void;
  onPause: () => void;
  onRetryFailed: () => void;
  onRescoreStale: () => void;
  onClearQueue: () => void;
  onClearAll: () => void;
};

export function QueueBar({ counts: c, concurrency, paused, rubricTitle, onConcurrency, onPause, onRetryFailed, onRescoreStale, onClearQueue, onClearAll }: Props) {
  const finished = c.done + c.failed;
  const pct = c.total ? Math.round((finished / c.total) * 100) : 0;
  const remaining = c.queued + c.active;
  const eta = remaining && c.avgMs ? Math.ceil((remaining * c.avgMs) / Math.max(1, Math.min(concurrency, remaining)) / 60000) : 0;
  const working = remaining > 0;

  return (
    <div className="rounded-[16px] border border-hairline bg-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-body" aria-live="polite">
          <b className="text-ink">{c.done}</b> of {c.total} screened
          {c.active > 0 && ` · ${c.active} running`}
          {c.queued > 0 && ` · ${c.queued} waiting`}
          {c.failed > 0 && <span className="text-error"> · {c.failed} failed</span>}
          {working && !paused && eta > 0 && ` · about ${eta} min left`}
          {paused && working && " · paused"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            In parallel
            <select className="h-9 rounded-[8px] border border-hairline bg-canvas px-2 text-sm text-ink" value={concurrency} onChange={(e) => onConcurrency(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          {working && (
            <button className="btn btn-secondary btn-sm" onClick={onPause}>
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />} {paused ? "Resume" : "Pause"}
            </button>
          )}
          {c.queued > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={onClearQueue} title="Remove resumes that haven't started">
              <X className="size-4" /> Clear waiting
            </button>
          )}
          {c.failed > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={onRetryFailed}>
              <RefreshCw className="size-4" /> Retry failed
            </button>
          )}
          {!working && (
            <button className="btn btn-secondary btn-sm" onClick={onClearAll}>
              <Trash2 className="size-4" /> Clear all
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-strong" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Screening progress">
        <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {(c.stale > 0 || c.staleLost > 0) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-ochre/30 px-3 py-2 text-sm text-ink">
          <span>
            {c.stale + c.staleLost} scored with an older version of the rubric.
            {c.staleLost > 0 && ` ${c.staleLost} came from an earlier session; add those files again to rescore them.`}
          </span>
          {c.stale > 0 && (
            <button className="btn btn-primary btn-sm" onClick={onRescoreStale}>
              <RotateCcw className="size-4" /> Rescore {c.stale} with “{rubricTitle}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
