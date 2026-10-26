import { describe, expect, it } from "vitest";
import type { GithubSummary } from "@/lib/schema";
import { extractLinks, githubOwnership, guessName, kindOf, namesMatch, normaliseUrl } from "@/lib/verify";
import { isPublicAddress } from "@/mastra/tools/links";

describe("extractLinks", () => {
  it("finds web links, skips emails and prose like Node.js", () => {
    const links = extractLinks(["Maya · maya@example.com · mayaokafor.dev · linkedin.com/in/maya-okafor/ · https://github.com/maya-okafor. Built with Node.js and e.g. React."]);
    expect(links).toEqual(["https://mayaokafor.dev", "https://linkedin.com/in/maya-okafor", "https://github.com/maya-okafor"]);
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
  it("is only 'likely' on a name match, and flags a different person", () => {
    expect(githubOwnership(gh(), "ok", "maya-okafor", resume)?.verdict).toBe("likely");
    expect(githubOwnership(gh({ name: "Linus Torvalds" }), "ok", "torvalds", resume)?.verdict).toBe("mismatch");
  });
  it("tells 'doesn't exist' apart from 'couldn't check'", () => {
    expect(githubOwnership(null, "not_found", "nobody-here", resume)?.verdict).toBe("not_found");
    expect(githubOwnership(null, "unavailable", "maya-okafor", resume)?.verdict).toBe("unknown");
  });
});

describe("isPublicAddress", () => {
  it("refuses private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "::1", "fc00::1", "::ffff:127.0.0.1"]) expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of ["8.8.8.8", "2606:4700:4700::1111"]) expect(isPublicAddress(ip), ip).toBe(true);
  });
});
