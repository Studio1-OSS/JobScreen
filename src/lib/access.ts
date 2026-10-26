import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * When JOBSCREEN_ACCESS_KEY is set, every API call must send it in the x-jobscreen-key header. Set it on any public
 * deployment so strangers can't spend your Nebius credits.
 */
export function denied(req: Request): Response | null {
  const want = process.env.JOBSCREEN_ACCESS_KEY;
  if (!want) return null;
  const got = Buffer.from(req.headers.get("x-jobscreen-key") ?? "");
  const ok = got.length === Buffer.byteLength(want) && timingSafeEqual(got, Buffer.from(want));
  return ok ? null : Response.json({ error: "Access key required." }, { status: 401 });
}
