"use client";
// Horizontal grouped bars for two series. Emphasis form: vision in the accent hue, the text baseline in gray.
// Every bar carries its value as a label, and the page repeats the numbers in a table.
import { useState } from "react";

export const SERIES = {
  vision: { label: "Vision (JobScreen)", color: "#7a5fd6" },
  text: { label: "Text library (pymupdf4llm)", color: "#a39e92" },
} as const;
type Key = keyof typeof SERIES;

export type BarGroup = { group: string; note?: string; values: Record<Key, { value: number; display: string; detail: string }> };

export function BenchBars({ groups, min = 0, max }: { groups: BarGroup[]; min?: number; max: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const span = max - min || 1;
  const zero = ((0 - min) / span) * 100;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-sm text-body">
        {(Object.keys(SERIES) as Key[]).map((k) => (
          <span key={k} className="flex items-center gap-2">
            <span className="size-3 rounded-[3px]" style={{ background: SERIES[k].color }} aria-hidden />
            {SERIES[k].label}
          </span>
        ))}
      </div>
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="text-sm font-semibold text-ink">
              {g.group} {g.note && <span className="font-normal text-muted">· {g.note}</span>}
            </p>
            <div className="mt-2 space-y-[2px]">
              {(Object.keys(SERIES) as Key[]).map((k) => {
                const v = g.values[k];
                const left = Math.min(zero, ((v.value - min) / span) * 100);
                const width = Math.max(Math.abs(((v.value - min) / span) * 100 - zero), 0.6);
                const id = `${g.group}-${k}`;
                const neg = v.value < 0;
                return (
                  <div
                    key={k}
                    className="relative h-9 rounded-[4px] hover:bg-surface-card/60"
                    onMouseEnter={() => setHover(id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(id)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`${g.group}, ${SERIES[k].label}: ${v.display}`}
                  >
                    {/* The plot area leaves room for value labels on the side(s) bars can grow towards. */}
                    <div className={`absolute inset-y-0 right-14 ${min < 0 ? "left-14" : "left-0"}`}>
                      {min < 0 && <div className="absolute inset-y-0 w-px bg-surface-strong" style={{ left: `${zero}%` }} />}
                      <div
                        className="absolute top-1.5 h-6"
                        style={{ left: `${left}%`, width: `${width}%`, background: SERIES[k].color, borderRadius: neg ? "4px 0 0 4px" : "0 4px 4px 0" }}
                      />
                      <span
                        className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap px-2 text-sm font-semibold tabular-nums text-ink"
                        style={neg ? { right: `${100 - left}%` } : { left: `${left + width}%` }}
                      >
                        {v.display}
                      </span>
                    </div>
                    {hover === id && (
                      <div className="pointer-events-none absolute -top-2 right-0 z-10 -translate-y-full rounded-[8px] bg-ink px-3 py-2 text-xs text-white shadow-lg">
                        <p className="font-semibold">{SERIES[k].label}</p>
                        <p className="text-white/80">{v.detail}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
