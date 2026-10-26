"use client";

/** Saves a string as a file in the browser. */
export function download(name: string, type: string, body: string) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([body], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const profileFileName = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "candidate"}.resume.json`;
