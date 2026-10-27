// read (vision or text) → GitHub enrichment → score ∥ profile ∥ verify → finish.
// The total and the score band are computed here, not by the model; the model's own call is kept beside them.
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { rubricSchema, type GithubSummary, type Reading, type Screening, type Usage } from "@/lib/schema";
import { clampScore, findGithubUser, githubRepos, plausibleName, recommend, stated, verifyEvidence, weightedTotal } from "@/lib/text";
import { extractProfile } from "../agents/profile";
import { addUsage, readPages } from "../agents/reader";
import { scoreResume, githubText } from "../agents/scorer";
import { fetchRepo, githubTool, type GithubLookup } from "../tools/github";
import { checkLinks } from "../tools/links";
import { extractLinks, githubOwnership, guessName, projectStatus } from "@/lib/verify";

export const screenInput = z.object({
  /** Rendered pages as JPEG data URLs. Empty means "score the text as given" (the text-only baseline). */
  pages: z.array(z.string()).max(6),
  /** Text-layer passages that render invisibly (white, microscopic, off-page); see src/lib/pdf-core.ts. */
  hiddenText: z.array(z.string().max(2000)).max(10).optional(),
  /** Pre-extracted text, used when there are no page images. */
  text: z.string().max(60000).optional(),
  rubric: rubricSchema,
  github: z.boolean().optional(),
  /** Extract a structured JSON Resume profile alongside the score (default true; the benchmarks turn it off). */
  profile: z.boolean().optional(),
  /** Check that links load and that the GitHub account belongs to the candidate (default true; benchmarks turn it off). */
  verify: z.boolean().optional(),
});
export type ScreenInput = z.infer<typeof screenInput>;

const any = z.any();

const read = createStep({
  id: "read",
  inputSchema: screenInput,
  outputSchema: any,
  execute: async ({ inputData }) => {
    const t = Date.now();
    let reading: Reading;
    let usage: Usage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
    if (inputData.pages.length) {
      const r = await readPages(inputData.pages);
      usage = r.usage;
      reading = {
        ...r.reading,
        name: plausibleName(r.reading.name),
        headline: stated(r.reading.headline),
        email: stated(r.reading.email),
        location: stated(r.reading.location),
        hiddenText: inputData.hiddenText ?? [],
        // Only visible links count; a GitHub URL hidden in the text layer is ignored.
        github: findGithubUser(r.reading.links.join(" "), r.reading.transcript),
        source: "vision",
        pages: inputData.pages.length,
      };
    } else {
      const text = inputData.text ?? "";
      reading = { name: "", headline: "", email: "", location: "", links: [], transcript: text, hiddenText: [], github: findGithubUser(text), source: "text", pages: 0 };
    }
    return { reading, usage, ms: Date.now() - t };
  },
});

const github = createStep(githubTool);

const score = createStep({
  id: "score",
  inputSchema: any,
  outputSchema: any,
  execute: async ({ getInitData, getStepResult }): Promise<Omit<Screening, "profile" | "verification">> => {
    const init = getInitData<ScreenInput>();
    const { reading, usage: readUsage, ms: readMs } = getStepResult(read) as { reading: Reading; usage: Usage; ms: number };
    const gh = getStepResult(github) as { profile: GithubSummary | null; ms?: number } | undefined;
    const profile = gh?.profile ?? null;
    const t = Date.now();
    const { card, usage } = await scoreResume({ rubric: init.rubric, resume: reading.transcript, github: profile });
    const sources = [reading.transcript, profile ? githubText(profile) : ""];
    const categories = init.rubric.categories.map((c) => {
      const got = card.categories.find((x) => x.key === c.key);
      return {
        key: c.key,
        label: c.label,
        weight: c.weight,
        score: clampScore(got?.score ?? 0),
        rationale: got?.rationale ?? "Not scored.",
        evidence: verifyEvidence(got?.evidence ?? [], ...sources),
      };
    });
    const total = weightedTotal(categories);
    const redFlags = [...card.redFlags];
    if (reading.hiddenText.length) redFlags.unshift(`Hidden text in the PDF that a reader cannot see (${reading.hiddenText.length} passage${reading.hiddenText.length > 1 ? "s" : ""}).`);
    return {
      reading,
      github: profile,
      total,
      recommendation: recommend(total),
      decision: { call: card.decision, reason: card.decisionReason, confidence: card.confidence },
      categories,
      summary: card.summary,
      strengths: card.strengths.slice(0, 4),
      gaps: card.gaps.slice(0, 4),
      redFlags,
      interviewQuestions: card.interviewQuestions.slice(0, 3),
      injectionAttempt: card.injectionAttempt || reading.hiddenText.length > 0,
      usage: {
        inputTokens: readUsage.inputTokens + usage.inputTokens,
        outputTokens: readUsage.outputTokens + usage.outputTokens,
        cachedInputTokens: readUsage.cachedInputTokens + usage.cachedInputTokens,
      },
      ms: { read: readMs, github: gh?.ms ?? 0, score: Date.now() - t },
    };
  },
});

// Links come from what's visible on the page only; a URL hidden in the PDF's text layer is never opened.
const verify = createStep({
  id: "verify",
  inputSchema: any,
  outputSchema: any,
  execute: async ({ getInitData, getStepResult }) => {
    if (getInitData<ScreenInput>().verify === false) return { verification: null };
    const { reading } = getStepResult(read) as { reading: Reading };
    const gh = getStepResult(github) as { profile: GithubLookup["profile"]; status: GithubLookup["status"] | "skipped" } | undefined;
    const links = extractLinks([reading.links.join(" "), reading.transcript]);
    const username = reading.github && gh && gh.status !== "skipped" ? reading.github : null;
    const [checked, projects] = await Promise.all([
      checkLinks(links),
      // Each repo the resume links to: on the candidate's own account, an organisation's, someone else's, or not public.
      username
        ? Promise.all(githubRepos([reading.links.join(" "), reading.transcript]).map(async (r) => ({ ...r, status: projectStatus(await fetchRepo(r.owner, r.repo), gh?.profile?.username ?? username) })))
        : [],
    ]);
    const ownership = username
      ? githubOwnership(gh!.profile, gh!.status as GithubLookup["status"], username, { name: reading.name || guessName(reading.transcript), email: reading.email || (reading.transcript.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? ""), links })
      : null;
    return { verification: { links: checked, github: ownership && { ...ownership, projects } } };
  },
});

// Runs beside scoring on the same visible text, so a screening takes no longer.
const profile = createStep({
  id: "profile",
  inputSchema: any,
  outputSchema: any,
  execute: async ({ getInitData, getStepResult }) => {
    if (getInitData<ScreenInput>().profile === false) return { profile: null, usage: null };
    const { reading } = getStepResult(read) as { reading: Reading };
    return extractProfile(reading.transcript);
  },
});

const finish = createStep({
  id: "finish",
  inputSchema: any,
  outputSchema: any,
  execute: async ({ inputData }): Promise<Screening> => {
    const { score: s, profile: p, verify: v } = inputData as {
      score: Omit<Screening, "profile" | "verification">;
      profile: { profile: Screening["profile"]; usage: Usage | null };
      verify: { verification: Screening["verification"] };
    };
    const usage = { ...s.usage };
    if (p.usage) addUsage(usage, p.usage);
    // A GitHub that doesn't exist, or project repos that are private, gone or on someone else's account, are facts worth a reviewer's eye.
    const redFlags = [...s.redFlags];
    const own = v.verification?.github;
    if (own?.verdict === "not_found") redFlags.push(`The GitHub link (@${own.username}) points to an account that doesn't exist.`);
    const repos = (status: string) => own?.projects?.filter((p) => p.status === status) ?? [];
    const list = (ps: { owner: string; repo: string }[]) => ps.map((p) => `${p.owner}/${p.repo}`).join(", ");
    const missing = repos("missing");
    const other = repos("other");
    if (missing.length) redFlags.push(`${missing.length > 1 ? "Project repos" : "A project repo"} can't be opened (private or doesn't exist): ${list(missing)}.`);
    if (other.length) redFlags.push(`${other.length > 1 ? "Projects are" : "A project is"} on a different GitHub account than @${own!.username}: ${list(other)}.`);
    // A missing repo is already flagged above, so it isn't counted again as a link that doesn't load.
    const flagged = new Set(missing.map((p) => p.url.toLowerCase()));
    const broken = v.verification?.links.filter((l) => (l.status === "broken" || l.status === "unreachable") && !flagged.has(l.url.toLowerCase())) ?? [];
    if (broken.length) redFlags.push(`${broken.length} link${broken.length > 1 ? "s" : ""} on the resume ${broken.length > 1 ? "don't" : "doesn't"} load.`);
    return { ...s, redFlags, profile: p.profile, verification: v.verification, usage };
  },
});

export const screenWorkflow = createWorkflow({
  id: "screen",
  description: "Read a resume (vision or text), enrich it from GitHub, and score it against a rubric.",
  inputSchema: screenInput,
  outputSchema: any,
  // Each screening is self-contained and returned to the caller, so no run snapshot is kept.
  // Without this the in-memory store would hold every run (page images included) for the life of the server.
  options: { shouldPersistSnapshot: () => false },
})
  .then(read)
  .map(async ({ inputData, getInitData }) => ({
    username: getInitData<ScreenInput>().github === false ? "" : ((inputData as { reading: Reading }).reading.github ?? ""),
  }))
  .then(github)
  .parallel([score, profile, verify])
  .then(finish)
  .commit();
