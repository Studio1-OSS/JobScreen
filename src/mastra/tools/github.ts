// GitHub lookups through Octokit, GitHub's official SDK: profile, the repos worth reading (ranked in code, not by a
// model), merged PRs to other people's projects, and what the account publishes about itself (site, email, socials),
// which src/lib/verify.ts uses to tie the account to the candidate. Repos linked on the resume are looked up too.
import { createTool } from "@mastra/core/tools";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import type { GithubRepo, GithubSummary } from "@/lib/schema";

export type GithubLookup = { profile: GithubSummary | null; status: "ok" | "not_found" | "unavailable" };
/** A repo linked on a resume: who really owns it (after renames and transfers), and whether that's a person or an org. */
export type RepoLookup = { status: "ok" | "not_found" | "unavailable"; owner: string; ownerType: string | null };

let client: Octokit | null = null;
const quiet = () => {};
// A 404 is an answer here ("no such user"), not an error worth logging.
const octokit = () => (client ??= new Octokit({ auth: process.env.GITHUB_TOKEN || undefined, userAgent: "jobscreen", request: { timeout: 10_000 }, log: { debug: quiet, info: quiet, warn: console.warn, error: quiet } }));
const statusOf = (e: unknown) => (typeof e === "object" && e && "status" in e ? Number((e as { status: unknown }).status) : 0);

// Bulk batches often repeat profiles, and unauthenticated GitHub allows 60 requests an hour: cache for an hour.
const cache = new Map<string, { at: number; value: GithubLookup }>();

export async function fetchGithub(username: string): Promise<GithubLookup> {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3.6e6) return hit.value;
  const value = await lookup(username);
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  // "unavailable" can mean rate limited, so only real answers are cached.
  if (value.status !== "unavailable") cache.set(key, { at: Date.now(), value });
  return value;
}

const repoCache = new Map<string, { at: number; value: RepoLookup }>();

/** One request per repo. A 404 means private or gone: GitHub answers the same for both. */
export async function fetchRepo(owner: string, repo: string): Promise<RepoLookup> {
  const key = `${owner}/${repo}`.toLowerCase();
  const hit = repoCache.get(key);
  if (hit && Date.now() - hit.at < 3.6e6) return hit.value;
  let value: RepoLookup;
  try {
    const { data } = await octokit().rest.repos.get({ owner, repo });
    value = { status: "ok", owner: data.owner.login, ownerType: data.owner.type };
  } catch (e) {
    value = { status: statusOf(e) === 404 ? "not_found" : "unavailable", owner, ownerType: null };
  }
  if (repoCache.size > 500) repoCache.delete(repoCache.keys().next().value!);
  if (value.status !== "unavailable") repoCache.set(key, { at: Date.now(), value });
  return value;
}

async function lookup(username: string): Promise<GithubLookup> {
  const gh = octokit();
  let user;
  try {
    user = (await gh.rest.users.getByUsername({ username })).data;
  } catch (e) {
    return { profile: null, status: statusOf(e) === 404 ? "not_found" : "unavailable" };
  }
  // The rest is best effort: a profile is still useful without it.
  const [repos, prs, socials] = await Promise.all([
    gh.rest.repos.listForUser({ username, per_page: 100, sort: "pushed" }).then((r) => r.data).catch(() => []),
    gh.rest.search.issuesAndPullRequests({ q: `type:pr is:merged author:${username} -user:${username}`, per_page: 1 }).then((r) => r.data.total_count).catch(() => null),
    gh.rest.users.listSocialAccountsForUser({ username }).then((r) => r.data).catch(() => []),
  ]);
  const now = Date.now();
  const rank = (r: (typeof repos)[number]) => (r.stargazers_count ?? 0) * 3 + (r.forks_count ?? 0) * 2 - (now - Date.parse(r.pushed_at ?? "1970")) / 8.64e7 / 120;
  const topRepos: GithubRepo[] = repos
    .filter((r) => !r.fork || (r.stargazers_count ?? 0) > 0)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 6)
    .map((r) => ({
      name: r.name,
      url: r.html_url,
      description: (r.description ?? "").slice(0, 200),
      language: r.language ?? null,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      pushedAt: r.pushed_at ?? "",
      kind: r.fork ? "fork" : "own",
    }));
  return {
    status: "ok",
    profile: {
      username: user.login,
      url: user.html_url,
      name: user.name ?? null,
      bio: user.bio ?? null,
      blog: user.blog || null,
      email: user.email ?? null,
      company: user.company ?? null,
      location: user.location ?? null,
      socials: socials.map((s) => ({ provider: s.provider, url: s.url })),
      followers: user.followers,
      publicRepos: user.public_repos,
      accountYears: Math.max(0, Math.round(((now - Date.parse(user.created_at)) / 3.156e10) * 10) / 10),
      externalMergedPRs: prs,
      topRepos,
    },
  };
}

export const githubTool = createTool({
  id: "github-profile",
  description: "Fetch a candidate's public GitHub profile, their strongest repositories, merged PRs to other projects, and the links the account publishes.",
  inputSchema: z.object({ username: z.string().describe("GitHub login; empty skips the lookup") }),
  outputSchema: z.object({ profile: z.custom<GithubSummary | null>(), status: z.enum(["ok", "not_found", "unavailable", "skipped"]), ms: z.number() }),
  execute: async ({ username }) => {
    const t = Date.now();
    if (!username) return { profile: null, status: "skipped" as const, ms: 0 };
    const r = await fetchGithub(username);
    return { ...r, ms: Date.now() - t };
  },
});
