"use client";
// fetch() for the app's own API. When the server sets JOBSCREEN_ACCESS_KEY, requests carry the key the user entered.
const STORE = "jobscreen:access-key";

export class LockedError extends Error {
  constructor() {
    super("This JobScreen server needs an access key.");
  }
}

export const getKey = () => {
  try {
    return localStorage.getItem(STORE) ?? "";
  } catch {
    return "";
  }
};
export const setKey = (k: string) => {
  try {
    localStorage.setItem(STORE, k);
  } catch {}
};

export async function api(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-jobscreen-key": getKey() },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 401) throw new LockedError();
  return res;
}
