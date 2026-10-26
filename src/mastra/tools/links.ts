// Checks that each link on a resume actually loads. The server fetches URLs a stranger wrote, so every hop is
// resolved and refused if it points at a private, loopback or link-local address (no probing of your own network).
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import type { LinkCheck } from "@/lib/schema";
import { kindOf } from "@/lib/verify";

const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 4;
const UA = "Mozilla/5.0 (compatible; JobScreen link check; +https://github.com/Studio1-OSS/jobscreen)";

/** True only for addresses on the public internet. */
export function isPublicAddress(ip: string): boolean {
  try {
    const addr = ipaddr.process(ip);
    return addr.range() === "unicast";
  } catch {
    return false;
  }
}

async function publicHost(hostname: string): Promise<boolean> {
  if (ipaddr.isValid(hostname)) return isPublicAddress(hostname);
  const addrs = await lookup(hostname, { all: true });
  return addrs.length > 0 && addrs.every((a) => isPublicAddress(a.address));
}

export async function checkLink(url: string): Promise<LinkCheck> {
  const kind = kindOf(url);
  const done = (status: LinkCheck["status"], httpStatus: number | null, finalUrl: string | null, note: string): LinkCheck => ({ url, kind, status, httpStatus, finalUrl, note });
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const u = new URL(current);
      if (u.protocol !== "https:" && u.protocol !== "http:") return done("unreachable", null, null, "Not a web link.");
      if (!(await publicHost(u.hostname))) return done("unreachable", null, null, "Points to a private address, so it wasn't opened.");
      const res = await fetch(current, { method: "GET", redirect: "manual", headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      await res.body?.cancel().catch(() => {});
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        current = new URL(loc, current).toString();
        continue;
      }
      const final = current === url ? null : current;
      if (res.ok) return done("ok", res.status, final, final ? "Loads (after a redirect)." : "Loads.");
      // LinkedIn answers bots with 999; many sites answer 401/403/429 to automated requests.
      if ([999, 401, 403, 429].includes(res.status)) return done("blocked", res.status, final, kind === "linkedin" ? "LinkedIn blocks automated checks; open it to verify." : "The site blocks automated checks; open it to verify.");
      return done("broken", res.status, final, res.status === 404 || res.status === 410 ? "Page not found." : `The site answered ${res.status}.`);
    }
    return done("unreachable", null, current, "Too many redirects.");
  } catch (e) {
    const code = (e as { cause?: { code?: string }; code?: string }).cause?.code ?? (e as { code?: string }).code;
    if (code === "ENOTFOUND") return done("unreachable", null, null, "The domain doesn't exist.");
    if ((e as Error).name === "TimeoutError") return done("unreachable", null, null, "Timed out.");
    return done("unreachable", null, null, "Couldn't connect.");
  }
}

/** Checks links in parallel; at most 8 per resume. */
export const checkLinks = (urls: string[]) => Promise.all(urls.slice(0, 8).map(checkLink));
