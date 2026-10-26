"use client";
// Results live in IndexedDB (no 5 MB cap like localStorage), so a full batch survives a reload.
import { del, get, set } from "idb-keyval";
import type { Candidate } from "./candidate";
import type { Rubric } from "./schema";

const KEY = "jobscreen:v2";
// Earlier builds of this app saved under these keys; the newest one found is read once and moved.
const OLD_IDB_KEYS = ["openscreen:v2", "vetted:v2"];
export type Saved = { rubric?: Rubric; candidates?: Candidate[]; concurrency?: number };

export async function load(): Promise<Saved> {
  try {
    const saved = await get<Saved>(KEY);
    if (saved) return saved;
    for (const old of OLD_IDB_KEYS) {
      const older = await get<Saved>(old);
      if (!older) continue;
      await set(KEY, older);
      await del(old);
      return older;
    }
    // One-time move from the first version, which used localStorage.
    const old = JSON.parse(localStorage.getItem("vetted:v1") ?? "null");
    if (old) {
      localStorage.removeItem("vetted:v1");
      return { rubric: old.rubric, candidates: (old.candidates ?? []).map((c: Candidate) => ({ ...c, key: c.fileName, kind: "pdf", rubricId: "", addedAt: Date.now() })) };
    }
  } catch {}
  return {};
}

export async function save(s: Saved) {
  try {
    await set(KEY, s);
  } catch {}
}

export async function clear() {
  try {
    await del(KEY);
  } catch {}
}
