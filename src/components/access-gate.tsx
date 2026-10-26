"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { setKey } from "@/lib/api";

/** Shown when the server has JOBSCREEN_ACCESS_KEY set and this browser hasn't entered it yet. */
export function AccessGate({ open, onUnlock }: { open: boolean; onUnlock: () => void }) {
  const [value, setValue] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        className="w-full max-w-md rounded-[24px] bg-canvas p-6 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          setKey(value.trim());
          onUnlock();
        }}
      >
        <div className="mb-4 grid size-12 place-items-center rounded-[14px] bg-lavender"><KeyRound className="size-6" /></div>
        <h2 id="gate-title" className="text-lg font-semibold text-ink">This JobScreen server is private</h2>
        <p className="mt-1 text-sm text-muted">Enter the access key from whoever runs it. It is kept in this browser only.</p>
        <input className="field mt-4" type="password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Access key" aria-label="Access key" />
        <button className="btn btn-primary mt-4 w-full" disabled={!value.trim()}>Unlock</button>
      </form>
    </div>
  );
}
