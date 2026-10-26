"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6">
      <p className="eyebrow text-muted">Something broke</p>
      <h1 className="display mt-3 text-[40px] leading-tight">The page hit an error.</h1>
      <p className="mt-4 max-w-xl text-body">Your results are saved in this browser. Try again; if it keeps happening, open an issue with the message below.</p>
      <pre className="mt-4 max-w-xl overflow-auto rounded-[12px] bg-surface-card p-4 text-xs">{error.message}{error.digest ? `\n${error.digest}` : ""}</pre>
      <button className="btn btn-primary mt-6" onClick={reset}>Try again</button>
    </main>
  );
}
