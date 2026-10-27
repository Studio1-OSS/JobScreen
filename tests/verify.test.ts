import { describe, expect, it } from "vitest";
import type { GithubSummary } from "@/lib/schema";
import { extractLinks, githubOwnership, guessName, kindOf, namesMatch, normaliseUrl, projectStatus } from "@/lib/verify";
import { isPublicAddress } from "@/mastra/tools/links";

describe("extractLinks", () => {
  it("finds web links, skips emails and prose like Node.js", () => {
    const links = extractLinks(["Maya · maya@example.com · mayaokafor.dev · linkedin.com/in/maya-okafor/ · https://github.com/maya-okafor. Built with Node.js and e.g. React."]);
    expect(links).toEqual(["https://mayaokafor.dev", "https://linkedin.com/in/maya-okafor", "https://github.com/maya-okafor"]);
  });
  it("never mistakes the start of an email for a site", () => {
    expect(extractLinks(["noah.kim@example.com · Seoul"])).toEqual([]);
  });
  it("skips degrees that look like domains", () => {
    expect(extractLinks(["B.Sc. Computer Science, M.Sc. Economics, B.Tech 2020; see https://x.com/maya"])).toEqual(["https://x.com/maya"]);
  });
  it("deduplicates across www and trailing slashes", () => {
    expect(extractLinks(["https://www.site.dev/", "site.dev"])).toHaveLength(1);
  });
  it("classifies links", () => {
    expect(["https://github.com/x", "https://www.linkedin.com/in/x", "https://kaggle.com/x", "https://x.dev"].map(kindOf)).toEqual(["github", "linkedin", "profile", "website"]);
    expect(normaliseUrl("192.168.1.10/admin")).toBeNull();
  });
});

describe("namesMatch", () => {
  it("matches order, middle names and accents; rejects different people", () => {
    expect(namesMatch("Maya Okafor", "Maya N. Okafor")).toBe(true);
    expect(namesMatch("Maya Okafor", "okafor maya")).toBe(true);
    expect(namesMatch("José Álvarez", "Jose Alvarez")).toBe(true);
    expect(namesMatch("Maya Okafor", "Maya Smith")).toBe(false);
    expect(namesMatch("", "Maya Okafor")).toBeNull();
  });
});

describe("guessName", () => {
  it("takes a name-like first line and nothing else", () => {
    expect(guessName("## Maya Okafor\nEngineer")).toBe("Maya Okafor");
    expect(guessName("José María Álvarez\n…")).toBe("José María Álvarez");
    expect(guessName("SENIOR ACCOUNTANT WITH 10 YEARS\n")).toBe("");
    expect(guessName("SENIOR ACCOUNTANT\n")).toBe("");
    expect(guessName("MAYA OKAFOR\n")).toBe("MAYA OKAFOR");
    expect(guessName("Summary\nI build things")).toBe("");
  });
});

describe("githubOwnership", () => {
  const gh = (over: Partial<GithubSummary> = {}): GithubSummary => ({
    username: "maya-okafor", url: "", name: "Maya Okafor", bio: null, blog: null, email: null, company: null, location: null, socials: [],
    followers: 0, publicRepos: 0, accountYears: 1, externalMergedPRs: 0, topRepos: [], ...over,
  });
  const resume = { name: "Maya Okafor", email: "maya@example.com", links: ["https://mayaokafor.dev", "https://linkedin.com/in/maya-okafor"] };
  it("confirms when the account publishes the same site or LinkedIn", () => {
    expect(githubOwnership(gh({ blog: "https://www.mayaokafor.dev/" }), "ok", "maya-okafor", resume)?.verdict).toBe("confirmed");
    expect(githubOwnership(gh({ socials: [{ provider: "linkedin", url: "https://www.linkedin.com/in/Maya-Okafor" }] }), "ok", "maya-okafor", resume)?.verdict).toBe("confirmed");
  });
  it("is only 'likely' on a name match, and never flags a different display name", () => {
    expect(githubOwnership(gh(), "ok", "maya-okafor", resume)?.verdict).toBe("likely");
    // GitHub names often differ from resume names: @astrodevil belongs to Amitesh Anand.
    const amitesh = { name: "Amitesh Anand", email: "", links: [] };
    expect(githubOwnership(gh({ username: "Astrodevil", name: "Mr. Ånand" }), "ok", "astrodevil", amitesh)?.verdict).toBe("unconfirmed");
    expect(githubOwnership(gh({ name: "Linus Torvalds" }), "ok", "torvalds", resume)?.verdict).toBe("unconfirmed");
  });
  it("tells 'doesn't exist' apart from 'couldn't check'", () => {
    expect(githubOwnership(null, "not_found", "nobody-here", resume)?.verdict).toBe("not_found");
    expect(githubOwnership(null, "unavailable", "maya-okafor", resume)?.verdict).toBe("unknown");
  });
});

describe("projectStatus", () => {
  const repo = (owner: string, ownerType: string | null = "User", status: "ok" | "not_found" | "unavailable" = "ok") => ({ status, owner, ownerType });
  it("flags repos that are private, gone or on another person's account", () => {
    expect(projectStatus(repo("Astrodevil"), "astrodevil")).toBe("own");
    expect(projectStatus(repo("torvalds"), "astrodevil")).toBe("other");
    expect(projectStatus(repo("Astrodevil", null, "not_found"), "astrodevil")).toBe("missing");
  });
  it("accepts an organisation's repo and never guesses when GitHub is unreachable", () => {
    expect(projectStatus(repo("vercel", "Organization"), "astrodevil")).toBe("org");
    expect(projectStatus(repo("torvalds", null, "unavailable"), "astrodevil")).toBe("unknown");
  });
});

describe("isPublicAddress", () => {
  it("refuses private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "::1", "fc00::1", "::ffff:127.0.0.1"]) expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of ["8.8.8.8", "2606:4700:4700::1111"]) expect(isPublicAddress(ip), ip).toBe(true);
  });
});
