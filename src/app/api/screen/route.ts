// Streams NDJSON ScreenEvents while the Mastra workflow runs: one "step" per stage, then "done" or "error".
import { denied } from "@/lib/access";
import { mastra } from "@/mastra";
import type { ScreenEvent, Screening } from "@/lib/schema";
import { screenInput } from "@/mastra/workflows/screen";

export const runtime = "nodejs";
export const maxDuration = 180;

const STEPS = new Set(["read", "github-profile", "score"]);

const MAX_PAGE_CHARS = 6_000_000; // a data URL; ~4.5 MB of JPEG

export async function POST(req: Request) {
  const locked = denied(req);
  if (locked) return locked;
  const parsed = screenInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { pages, text } = parsed.data;
  if (!pages.length && (text ?? "").trim().length < 80) return Response.json({ error: "Nothing to read: send page images or resume text." }, { status: 400 });
  if (pages.some((p) => !p.startsWith("data:image/") || p.length > MAX_PAGE_CHARS)) return Response.json({ error: "Each page must be an image under 4.5 MB." }, { status: 413 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ScreenEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const run = await mastra.getWorkflow("screenWorkflow").createRun();
        const out = run.stream({ inputData: parsed.data });
        for await (const ev of out.fullStream) {
          if (ev.type === "workflow-step-start" && STEPS.has(ev.payload.id)) {
            if (ev.payload.id === "github-profile") send({ type: "step", step: "github", skipped: !(ev.payload.payload as { username?: string } | undefined)?.username });
            else send({ type: "step", step: ev.payload.id as "read" | "score" });
          }
        }
        const res = await out.result;
        if (res.status === "success") send({ type: "done", result: res.result as Screening });
        else send({ type: "error", message: res.status === "failed" ? friendly(res.error) : `Workflow ${res.status}` });
      } catch (e) {
        send({ type: "error", message: friendly(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "Unknown error");
  if (/NEBIUS_API_KEY/.test(msg)) return msg;
  if (/401|403|api key/i.test(msg)) return "Nebius rejected the API key. Check NEBIUS_API_KEY in .env.";
  if (/429|rate/i.test(msg)) return "Rate limited by Nebius. Wait a moment and retry.";
  return msg.slice(0, 240);
}
