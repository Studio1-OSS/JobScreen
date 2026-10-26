"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, LockedError } from "@/lib/api";
import { ACTIVE, callOf, disagrees, displayName, rubricId, type Candidate, type Intake } from "@/lib/candidate";
import { fromDataTransfer, fromFiles, fromPaste } from "@/lib/intake";
import { prepare } from "@/lib/prepare";
import { flatSkills } from "@/lib/profile";
import { PRESETS } from "@/lib/presets";
import type { Rubric, ScreenEvent } from "@/lib/schema";
import { clear, load, save } from "@/lib/store";
import { normaliseRubric } from "@/lib/text";
import { AccessGate } from "./access-gate";
import { CandidateDrawer } from "./candidate-drawer";
import { IntakePanel } from "./intake-panel";
import { QueueBar } from "./queue-bar";
import { Results, type Filter, type Sort } from "./results";
import { RolePanel } from "./role-panel";

export function Workspace() {
  const [rubric, setRubric] = useState<Rubric>(PRESETS[0]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [concurrency, setConcurrency] = useState(4);
  const [paused, setPaused] = useState(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "score", dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const intakes = useRef(new Map<string, Intake>());
  const controllers = useRef(new Map<string, AbortController>());
  const rubricRef = useRef(rubric);
  rubricRef.current = rubric;
  const currentRubricId = rubricId(rubric);

  // Restore the last session. Files themselves are never stored, only results and a small thumbnail.
  useEffect(() => {
    void load().then((s) => {
      if (s.rubric) setRubric(s.rubric);
      if (s.concurrency) setConcurrency(s.concurrency);
      if (s.candidates) setCandidates(s.candidates.map((c) => (ACTIVE.includes(c.status) || c.status === "queued" ? { ...c, status: "error", error: "Interrupted. Add the file again to screen it." } : c)));
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => void save({ rubric, concurrency, candidates: candidates.filter((c) => c.status === "done" || c.status === "error") }), 400);
    return () => clearTimeout(t);
  }, [rubric, candidates, concurrency, loaded]);

  // Status notes fade on their own; the reviewer can still dismiss them sooner.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(t);
  }, [notice]);

  const patch = useCallback((id: string, p: Partial<Candidate>) => setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c))), []);

  const screen = useCallback(
    async (c: Candidate) => {
      const item = intakes.current.get(c.id);
      if (!item) {
        controllers.current.delete(c.id);
        return patch(c.id, { status: "error", error: "The file is no longer in memory. Add it again." });
      }
      const ctrl = new AbortController();
      controllers.current.set(c.id, ctrl);
      const r = normaliseRubric(rubricRef.current);
      const started = Date.now();
      patch(c.id, { status: "preparing", rubricId: rubricId(rubricRef.current), rubricTitle: r.title, error: undefined, githubChecked: undefined });
      try {
        const p = await prepare(item);
        patch(c.id, { thumb: p.thumb, fallbackName: p.fallbackName, status: p.pages.length ? "read" : "score" });
        const res = await api("/api/screen", { pages: p.pages, hiddenText: p.hiddenText, text: p.text, rubric: r }, ctrl.signal);
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        let finished = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const ev = JSON.parse(buf.slice(0, nl)) as ScreenEvent;
            buf = buf.slice(nl + 1);
            if (ev.type === "step") patch(c.id, ev.step === "github" ? { status: "github", githubChecked: !ev.skipped } : { status: ev.step });
            else if (ev.type === "done") {
              finished = true;
              patch(c.id, { status: "done", result: ev.result, ms: Date.now() - started });
            } else throw new Error(ev.message);
          }
        }
        if (!finished) throw new Error("The connection closed before the score arrived. Retry it.");
      } catch (e) {
        if (ctrl.signal.aborted) return;
        if (e instanceof LockedError) {
          setLocked(true);
          return patch(c.id, { status: "queued" });
        }
        patch(c.id, { status: "error", error: e instanceof Error ? e.message : "Something went wrong" });
      } finally {
        controllers.current.delete(c.id);
      }
    },
    [patch],
  );

  // The queue: start the oldest queued resumes until `concurrency` are in flight.
  useEffect(() => {
    if (paused || locked) return;
    const active = candidates.filter((c) => ACTIVE.includes(c.status)).length;
    const next = candidates
      .filter((c) => c.status === "queued" && !controllers.current.has(c.id))
      .sort((a, b) => a.addedAt - b.addedAt)
      .slice(0, Math.max(0, concurrency - active));
    for (const c of next) {
      controllers.current.set(c.id, new AbortController()); // reserve the slot before the async start
      void screen(c);
    }
  }, [candidates, concurrency, paused, locked, screen]);

  const add = (items: Intake[], skipped: string[] = []) => {
    const seen = new Set(candidates.map((c) => c.key));
    const fresh = items.filter((i) => !seen.has(i.key) && (seen.add(i.key), true));
    const dupes = items.length - fresh.length;
    const now = Date.now();
    for (const i of fresh) intakes.current.set(i.id, i);
    setCandidates((cs) => [
      ...cs,
      ...fresh.map((i, n) => ({ id: i.id, key: i.key, fileName: i.name, kind: i.kind, source: i.source, status: "queued" as const, rubricId: currentRubricId, rubricTitle: rubric.title, addedAt: now + n })),
    ]);
    const parts = [
      fresh.length && `Added ${fresh.length} resume${fresh.length === 1 ? "" : "s"}.`,
      dupes && `${dupes} already in the list ${dupes === 1 ? "was" : "were"} skipped.`,
      skipped.length && `Not supported: ${skipped.slice(0, 4).join(", ")}${skipped.length > 4 ? ` and ${skipped.length - 4} more` : ""}.`,
    ].filter(Boolean);
    setNotice(parts.length ? parts.join(" ") : "No resumes found in what you added.");
  };

  const addFiles = async (files: File[]) => {
    const r = await fromFiles(files);
    add(r.items, r.skipped);
  };
  const addDrop = async (dt: DataTransfer) => {
    const r = await fromDataTransfer(dt);
    add(r.items, r.skipped);
  };
  const addPaste = (text: string) => add(fromPaste(text));

  const loadSamples = async () => {
    const files = await Promise.all(["strong", "weak", "injected"].map(async (n) => new File([await (await fetch(`/samples/${n}.pdf`)).blob()], `sample-${n}.pdf`, { type: "application/pdf" })));
    await addFiles(files);
  };

  const requeue = (pick: (c: Candidate) => boolean) =>
    setCandidates((cs) => cs.map((c) => (pick(c) && intakes.current.has(c.id) && !ACTIVE.includes(c.status) ? { ...c, status: "queued", result: undefined, error: undefined } : c)));

  const remove = (ids: string[]) => {
    for (const id of ids) {
      controllers.current.get(id)?.abort();
      controllers.current.delete(id);
      intakes.current.delete(id);
    }
    const drop = new Set(ids);
    setCandidates((cs) => cs.filter((c) => !drop.has(c.id)));
    if (openId && drop.has(openId)) setOpenId(null);
  };
  const clearAll = () => {
    if (!confirm(`Remove all ${candidates.length} candidates and their results from this browser?`)) return;
    remove(candidates.map((c) => c.id));
    void clear();
  };

  // Drag anywhere on the page to add files.
  useEffect(() => {
    let depth = 0;
    const isFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => isFiles(e) && (depth++, setDragging(true));
    const leave = (e: DragEvent) => isFiles(e) && --depth <= 0 && ((depth = 0), setDragging(false));
    const over = (e: DragEvent) => isFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!isFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer) void addDrop(e.dataTransfer);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  });

  const counts = useMemo(() => {
    const done = candidates.filter((c) => c.result);
    return {
      total: candidates.length,
      done: done.length,
      failed: candidates.filter((c) => c.status === "error").length,
      queued: candidates.filter((c) => c.status === "queued").length,
      active: candidates.filter((c) => ACTIVE.includes(c.status)).length,
      stale: done.filter((c) => c.rubricId !== currentRubricId && intakes.current.has(c.id)).length,
      staleLost: done.filter((c) => c.rubricId !== currentRubricId && !intakes.current.has(c.id)).length,
      avgMs: avg(candidates.map((c) => c.ms).filter((m): m is number => !!m)),
    };
  }, [candidates, currentRubricId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = candidates.filter((c) => {
      const r = c.result;
      if (filter === "advance" || filter === "consider" || filter === "decline") return !!r && callOf(r) === filter;
      if (filter === "review") return !!r && disagrees(r);
      if (filter === "flagged") return !!r && (r.reading.hiddenText.length > 0 || r.injectionAttempt);
      if (filter === "failed") return c.status === "error";
      if (filter === "pending") return !r && c.status !== "error";
      return true;
    }).filter((c) => {
      if (!q) return true;
      const p = c.result?.profile;
      const fields = [displayName(c), c.fileName, c.result?.reading.headline, c.result?.reading.transcript, p?.meta.currentTitle, p?.meta.currentCompany, p ? flatSkills(p).join(" ") : ""];
      return fields.some((s) => s?.toLowerCase().includes(q));
    });
    const val = (c: Candidate): number | string => {
      if (sort.key === "name") return displayName(c).toLowerCase();
      if (sort.key === "added") return c.addedAt;
      if (sort.key === "score") return c.result ? c.result.total : -1;
      return c.result?.categories.find((x) => x.key === sort.key)?.score ?? -1;
    };
    return list.sort((a, b) => {
      // Finished first, then in progress, then failed, whatever the sort.
      const g = group(a) - group(b);
      if (g) return g;
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir || a.addedAt - b.addedAt;
    });
  }, [candidates, filter, query, sort]);

  const open = candidates.find((c) => c.id === openId);
  const openable = visible.filter((c) => c.result).map((c) => c.id);

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <RolePanel rubric={rubric} onChange={setRubric} />

      <section className="min-w-0 space-y-4" aria-label="Candidates">
        <IntakePanel compact={candidates.length > 0} onFiles={addFiles} onPaste={addPaste} onSamples={loadSamples} />

        {notice && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-[12px] bg-surface-card px-4 py-3 text-sm text-body">
            <span>{notice}</span>
            <button className="shrink-0 font-semibold text-ink" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}

        {candidates.length > 0 && (
          <>
            <QueueBar
              counts={counts}
              concurrency={concurrency}
              paused={paused}
              rubricTitle={rubric.title}
              onConcurrency={setConcurrency}
              onPause={() => setPaused((p) => !p)}
              onRetryFailed={() => requeue((c) => c.status === "error")}
              onRescoreStale={() => requeue((c) => !!c.result && c.rubricId !== currentRubricId)}
              onClearQueue={() => remove(candidates.filter((c) => c.status === "queued").map((c) => c.id))}
              onClearAll={clearAll}
            />
            <Results
              rubric={rubric}
              all={candidates}
              visible={visible}
              filter={filter}
              onFilter={setFilter}
              query={query}
              onQuery={setQuery}
              sort={sort}
              onSort={setSort}
              currentRubricId={currentRubricId}
              onOpen={setOpenId}
              onRemove={(id) => remove([id])}
              onRetry={(id) => requeue((c) => c.id === id)}
            />
          </>
        )}
      </section>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-6">
          <div className="rounded-[24px] bg-canvas px-10 py-8 text-center shadow-2xl">
            <p className="display text-3xl">Drop to add resumes</p>
            <p className="mt-2 text-sm text-muted">PDFs, images, Word files, ZIP archives or whole folders</p>
          </div>
        </div>
      )}

      <CandidateDrawer
        candidate={open}
        stale={!!open?.result && open.rubricId !== currentRubricId}
        onClose={() => setOpenId(null)}
        onPrev={openable.indexOf(openId ?? "") > 0 ? () => setOpenId(openable[openable.indexOf(openId!) - 1]) : undefined}
        onNext={openable.indexOf(openId ?? "") >= 0 && openable.indexOf(openId!) < openable.length - 1 ? () => setOpenId(openable[openable.indexOf(openId!) + 1]) : undefined}
        position={open ? { index: openable.indexOf(open.id) + 1, of: openable.length } : undefined}
      />

      <AccessGate open={locked} onUnlock={() => setLocked(false)} />
    </div>
  );
}

const group = (c: Candidate) => (c.result ? 0 : c.status === "error" ? 2 : 1);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
