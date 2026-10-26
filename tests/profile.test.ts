import { describe, expect, it } from "vitest";
import { flatSkills, monthOf, toJsonResume, yearsOfExperience } from "@/lib/profile";
import type { ModelProfile } from "@/lib/schema";
import { isSkeleton } from "@/mastra/agents/profile";

const now = new Date(2026, 9, 1); // October 2026

describe("yearsOfExperience", () => {
  it("counts overlapping roles once", () => {
    const work = [
      { startDate: "2020-01", endDate: "2022-12" }, // 3 years
      { startDate: "2022-01", endDate: "2023-12" }, // overlaps 2022, adds 2023
    ];
    expect(yearsOfExperience(work, now)).toBe(4);
  });
  it("runs a current role to today, but never guesses a missing end date", () => {
    expect(yearsOfExperience([{ startDate: "2025-10", endDate: "", current: true }], now)).toBe(1.1);
    expect(yearsOfExperience([{ startDate: "2025-10", endDate: "" }], now)).toBeNull();
  });
  it("reads year-only dates and ignores junk", () => {
    expect(monthOf("2019")).toBe(2019 * 12);
    expect(monthOf("Summer")).toBeNull();
    expect(yearsOfExperience([{ startDate: "2019", endDate: "2020" }], now)).toBe(1.1);
  });
});

const base: ModelProfile = {
  basics: { name: " Jane  Doe ", label: "Engineer", email: "", phone: "", url: "", summary: "", city: "Pune", region: "", countryCode: "in", profiles: [{ network: "GitHub", username: "jane", url: "https://github.com/jane" }] },
  work: [
    { name: "Old Co", position: "Developer", location: "", startDate: "2018-01", endDate: "2020-12", current: false, summary: "", highlights: [] },
    { name: "Acme", position: "Senior Engineer", location: "", startDate: "2021-01", endDate: "2026-01", current: true, summary: "", highlights: ["Built billing"] },
  ],
  education: [],
  skills: [{ name: "Languages", keywords: ["Go", "go", "Python"] }],
  projects: [],
  awards: [],
  certificates: [],
  languages: [],
};

describe("toJsonResume", () => {
  it("maps to JSON Resume, picks the current role and derives years", () => {
    const r = toJsonResume(base, "test");
    expect(r.basics.name).toBe("Jane Doe");
    expect(r.basics.location.countryCode).toBe("IN");
    expect(r.work[1].endDate).toBe(""); // a current role has no end date
    expect(r.meta.currentCompany).toBe("Acme");
    expect(r.meta.yearsExperience).toBeGreaterThan(8);
    expect(flatSkills(r)).toEqual(["Go", "Python"]);
  });
  it("spots the placeholder skeleton", () => {
    expect(isSkeleton(base)).toBe(false);
    expect(isSkeleton({ ...base, basics: { ...base.basics, name: "..." } })).toBe(true);
    expect(isSkeleton({ ...base, work: [], skills: [] })).toBe(true);
  });
});
