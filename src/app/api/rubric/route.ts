import { z } from "zod";
import { denied } from "@/lib/access";
import { draftRubric } from "@/mastra/agents/rubric";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({ jobDescription: z.string().trim().min(40, "Paste a longer job description (40+ characters).").max(20000) });

export async function POST(req: Request) {
  const locked = denied(req);
  if (locked) return locked;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  try {
    return Response.json({ rubric: await draftRubric(parsed.data.jobDescription) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not draft a rubric" }, { status: 502 });
  }
}
