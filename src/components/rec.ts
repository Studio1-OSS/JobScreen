import type { Recommendation } from "@/lib/schema";

export const REC: Record<Recommendation, { label: string; cls: string }> = {
  advance: { label: "Advance", cls: "bg-mint text-ink" },
  consider: { label: "Consider", cls: "bg-ochre text-ink" },
  decline: { label: "Decline", cls: "bg-surface-strong text-ink" },
};
