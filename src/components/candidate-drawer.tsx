"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { displayName, type Candidate } from "@/lib/candidate";
import { Scorecard } from "./scorecard";

type Props = {
  candidate?: Candidate;
  stale: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; of: number };
};

export function CandidateDrawer({ candidate, stale, onClose, onPrev, onNext, position }: Props) {
  const r = candidate?.result;
  const panel = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const isOpen = !!r;

  // Esc closes, ←/→ (or k/j) move through the shortlist, Tab stays inside the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Escape") onClose();
      else if (!typing && (e.key === "ArrowRight" || e.key === "j")) onNext?.();
      else if (!typing && (e.key === "ArrowLeft" || e.key === "k")) onPrev?.();
      else if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, onNext, onPrev]);

  // Lock the page behind the drawer and give focus back when it closes.
  useEffect(() => {
    if (!isOpen) return;
    const back = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      back?.focus?.();
    };
  }, [isOpen]);

  // Each candidate starts at the top.
  useEffect(() => panel.current?.scrollTo(0, 0), [candidate?.id]);

  return (
    <AnimatePresence>
      {candidate && r && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={`Scorecard for ${displayName(candidate)}`}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[680px] overflow-y-auto bg-canvas shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-hairline-soft bg-canvas/95 px-3 py-2 backdrop-blur sm:px-6">
              <div className="flex shrink-0 items-center">
                <button className="grid size-9 place-items-center rounded-full hover:bg-surface-card disabled:opacity-30" onClick={onPrev} disabled={!onPrev} aria-label="Previous candidate (←)">
                  <ChevronLeft className="size-5" />
                </button>
                <button className="grid size-9 place-items-center rounded-full hover:bg-surface-card disabled:opacity-30" onClick={onNext} disabled={!onNext} aria-label="Next candidate (→)">
                  <ChevronRight className="size-5" />
                </button>
                {position && <span className="ml-1 text-sm tabular-nums text-muted">{position.index} / {position.of}</span>}
              </div>
              <p className="min-w-0 truncate text-sm text-muted">{candidate.fileName} · {candidate.rubricTitle}</p>
              <button ref={closeBtn} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-surface-card" onClick={onClose} aria-label="Close (Esc)">
                <X className="size-5" />
              </button>
            </div>

            <div className="px-5 py-6 sm:px-8">
              <Scorecard candidate={candidate} stale={stale} audience="recruiter" />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
