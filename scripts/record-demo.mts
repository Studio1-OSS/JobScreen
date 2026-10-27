// A real-usage demo of JobScreen, driven in a browser against the running app (pnpm dev):
//   recruiter: job description → rubric → a ZIP of resumes → shortlist → scorecards → hidden text → GitHub checks
//   job seeker: example job + their resume → the likely call and why
//
//   pnpm demo:test     # run the flow and check it, with screenshots; nothing is recorded
//   pnpm demo:record   # the same flow, recorded to public/demo/jobscreen-demo.mp4 and docs/demo.gif
//   pnpm demo:record --assemble   # rebuild the video from the last recording's saved frames (needs DEMO_WORK)
//
// Uses the made-up applicants for a backend engineering job in fixtures/demo/ (`pnpm fixtures:demo` rebuilds them).
// Waiting for the model is sped up in the video; everything else plays at real speed. Set CHROME_PATH to use a
// specific Chrome/Chromium.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright-core";
import { DEMO_JD, PILE, SEEKER } from "./make-demo-pile.mts";

const RECORD = process.argv.includes("--record");
const ASSEMBLE_ONLY = process.argv.includes("--assemble");
const URL = process.env.DEMO_URL || "http://localhost:3300";
const W = 1600;
const H = 900; // headless Chrome caps the page area at ~907px tall
// Each wait for the model plays in about this many seconds, however long it really took.
const WAIT_SECONDS = 2;
// Nothing on screen for longer than this is dead time, and is cut to this.
const MAX_HOLD = 2.5;
const OUT_MP4 = "public/demo/jobscreen-demo.mp4";
const OUT_GIF = "docs/demo.gif";
// DEMO_WORK keeps frames and screenshots somewhere you choose; by default they go to a fresh temp folder.
const work = process.env.DEMO_WORK
  ? (ASSEMBLE_ONLY || fs.rmSync(process.env.DEMO_WORK, { recursive: true, force: true }), fs.mkdirSync(process.env.DEMO_WORK, { recursive: true }), process.env.DEMO_WORK)
  : fs.mkdtempSync(path.join(os.tmpdir(), "jobscreen-demo-"));

type Frame = { file: string; t: number };
if (ASSEMBLE_ONLY) {
  const { frames, waits } = JSON.parse(fs.readFileSync(`${work}/timeline.json`, "utf8"));
  assemble(frames, waits);
  process.exit(0);
}

// --- the resumes: ten made-up applicants (one scanned, one with a hidden instruction, one whose GitHub links don't add up) ---
fs.mkdirSync(`${work}/applicants`);
for (const r of PILE) fs.copyFileSync(`fixtures/demo/${r.file}`, `${work}/applicants/${r.file}`);
execFileSync("zip", ["-qr", `${work}/applicants.zip`, "applicants"], { cwd: work });
const seekerResume = `${work}/my-resume.pdf`;
fs.copyFileSync(`fixtures/demo/${SEEKER.file}`, seekerResume);
const N = PILE.length;
const JD = DEMO_JD;

// --- browser, fake cursor, recording ---
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const dot = Object.assign(document.createElement("div"), { id: "demo-cursor" });
    dot.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-4px 0 0 -4px;z-index:2147483647;pointer-events:none;transition:transform .08s;";
    dot.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#0a0a0a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(dot);
    addEventListener("mousemove", (e) => (dot.style.left = `${e.clientX}px`, dot.style.top = `${e.clientY}px`), true);
    addEventListener("mousedown", () => (dot.style.transform = "scale(.8)"), true);
    addEventListener("mouseup", () => (dot.style.transform = ""), true);
  });
});

const frames: Frame[] = [];
const waits: [number, number][] = [];
let waitFrom = 0;
const now = () => Date.now() / 1000;
if (RECORD) {
  const cdp = await ctx.newCDPSession(page);
  let n = 0;
  cdp.on("Page.screencastFrame", async (f) => {
    const file = `${work}/f${String(n++).padStart(6, "0")}.jpg`;
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    // Chrome's own frame timestamps use a different clock from the wait markers, so stamp frames on arrival.
    frames.push({ file, t: now() });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W, maxHeight: H });
}

const pause = (ms: number) => page.waitForTimeout(ms);
const waitStart = () => void (waitFrom = now());
const waitEnd = () => void waits.push([waitFrom, now()]);
let mouse = { x: W / 2, y: H / 2 };
async function moveTo(l: Locator) {
  await l.scrollIntoViewIfNeeded();
  const b = (await l.boundingBox())!;
  const to = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(to.x, to.y, { steps: Math.max(8, Math.round(Math.hypot(to.x - mouse.x, to.y - mouse.y) / 25)) });
  mouse = to;
}
async function click(l: Locator, after = 500) {
  await moveTo(l);
  await pause(180);
  await page.mouse.click(mouse.x, mouse.y);
  await pause(after);
}
async function scrollIn(selector: string, by: number, ms = 900) {
  await page.locator(selector).evaluate((el, by) => el.scrollBy({ top: by, behavior: "smooth" }), by);
  await pause(ms);
}
const checks: [string, boolean][] = [];
const check = (name: string, ok: boolean) => (checks.push([name, ok]), console.log(`${ok ? "✓" : "✗"} ${name}`));
const shot = async (name: string) => !RECORD && page.screenshot({ path: `${work}/${name}.png` });

// --- recruiter ---
await page.goto(URL, { waitUntil: "networkidle" });
await page.mouse.move(mouse.x, mouse.y);
await pause(1500);
await click(page.getByRole("link", { name: "Screen applicants" }).first(), 900);
await page.waitForURL(/\/screen/);

await click(page.getByRole("button", { name: "Job description" }), 400);
await page.getByPlaceholder(/Paste the job description/).fill(JD);
await pause(900);
await click(page.getByRole("button", { name: "Draft rubric" }), 0);
waitStart();
await page.waitForFunction(() => !document.body.innerText.includes("Drafting rubric"), null, { timeout: 120000 });
waitEnd();
await pause(1600);
const rubricTitle = await page.locator("aside input[aria-label='Role title']").inputValue();
check(`rubric drafted from the job description ("${rubricTitle}")`, /backend|engineer/i.test(rubricTitle));
await shot("1-rubric");

await page.locator("input[type=file][accept]").setInputFiles(`${work}/applicants.zip`);
await pause(600);
await page.selectOption("select", "8");
waitStart();
await page.waitForFunction((n) => new RegExp(`\\b${n} of ${n} screened`).test(document.body.innerText) && !/running|waiting/.test(document.querySelector("[aria-live=polite]")?.textContent ?? "running"), N, { timeout: 600000, polling: 1000 });
waitEnd();
await pause(1800);
const rows = await page.locator("ol > li").count();
check(`all ${N} resumes from the ZIP screened (${rows} rows)`, rows === N);
const firstRole = await page.locator("ol > li").first().innerText();
await shot("2-shortlist");

await click(page.locator("ol > li button[aria-label^='Open scorecard']").first(), 1500);
check("top candidate's scorecard opens", await page.locator("[role=dialog]").isVisible());
await scrollIn("[role=dialog]", 420);
await scrollIn("[role=dialog]", 420, 1100);
await shot("3-scorecard");
await click(page.getByRole("button", { name: /Next candidate/ }), 1100);
await click(page.getByRole("button", { name: /Next candidate/ }), 1100);
await page.keyboard.press("Escape");
await pause(500);

const flagged = page.getByRole("tab", { name: /Flagged/ });
check("the planted hidden instruction is flagged", (await flagged.count()) > 0);
if (await flagged.count()) {
  await click(flagged, 700);
  await click(page.locator("ol > li button[aria-label^='Open scorecard']").first(), 1200);
  const panel = page.getByText("Hidden text found in this PDF");
  check("its scorecard shows the hidden passage", await panel.isVisible());
  await panel.scrollIntoViewIfNeeded();
  await pause(2200);
  await shot("4-hidden");
  await page.keyboard.press("Escape");
  await pause(400);
}

// The applicant whose GitHub links don't add up: a profile with a different display name (not a flag), a repo that
// doesn't exist and someone else's repo (both flagged).
await click(page.getByRole("tab", { name: /^All/ }), 500);
await page.getByLabel("Search candidates").fill("Jordan");
await pause(700);
await click(page.locator("ol > li button[aria-label^='Open scorecard']").first(), 1200);
const gh = page.getByText("Links and GitHub");
check("Jordan's scorecard has a Links and GitHub section", await gh.isVisible());
await gh.scrollIntoViewIfNeeded();
await scrollIn("[role=dialog]", 120, 600);
const ghText = await page.locator("[role=dialog]").innerText();
check("the profile with a different name is only 'Not linked'", /github\.com\/Astrodevil\s*Not linked/i.test(ghText));
check("someone else's repo is flagged", /torvalds\/linux\s*Another account/i.test(ghText));
check("the repo that doesn't exist is flagged", /ledger-api-go\s*Private or missing/i.test(ghText));
await pause(2600);
await shot("4b-github");
await page.keyboard.press("Escape");
await page.getByLabel("Search candidates").fill("");
await pause(400);

// --- job seeker ---
await click(page.getByRole("link", { name: /Check my resume|Check resume/ }).first(), 1000);
await page.waitForURL(/\/check/);
await click(page.getByRole("button", { name: "Use an example" }), 600);
await page.locator("input[type=file]").setInputFiles(seekerResume);
await pause(700);
await click(page.getByRole("button", { name: "Check my resume" }), 0);
waitStart();
await page.waitForSelector("text=Likely call at the first screen", { timeout: 300000 });
waitEnd();
await pause(1500);
const call = await page.getByText(/Likely call at the first screen/).innerText();
check(`job seeker gets a call: "${call.replace(/\s+/g, " ")}"`, /advance|consider|decline/i.test(call));
for (let i = 0; i < 4; i++) {
  await page.mouse.wheel(0, 380);
  await pause(950);
}
await pause(1200);
await shot("5-check");

await browser.close();
console.log(`errors in the page: ${errors.length ? errors.slice(0, 5).join(" | ") : "none"}`);
console.log(`top of the shortlist: ${firstRole.split("\n").slice(1, 3).join(" · ")}`);

// --- assemble the video ---
if (RECORD) {
  fs.writeFileSync(`${work}/timeline.json`, JSON.stringify({ frames, waits }));
  assemble(frames, waits);
} else console.log(`screenshots: ${work}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);

function assemble(frames: Frame[], waits: [number, number][]) {
  const factorAt = (t: number) => {
    const w = waits.find(([a, b]) => t >= a && t < b);
    return w ? Math.max(1, (w[1] - w[0]) / WAIT_SECONDS) : 1;
  };
  // Sped-up stretches arrive as hundreds of frames a second; keep one per video frame and let it carry the time of
  // the ones it replaces, instead of giving every frame a minimum duration (which would undo the speed-up).
  const lines: string[] = [];
  let total = 0;
  let carried = 0;
  frames.forEach((f, i) => {
    carried += Math.min(((frames[i + 1]?.t ?? f.t + 1.5) - f.t) / factorAt(f.t), MAX_HOLD);
    if (carried < 1 / 30 && i < frames.length - 1) return;
    total += carried;
    lines.push(`file '${f.file}'`, `duration ${carried.toFixed(4)}`);
    carried = 0;
  });
  lines.push(`file '${frames.at(-1)!.file}'`);
  fs.writeFileSync(`${work}/frames.txt`, lines.join("\n"));
  fs.mkdirSync(path.dirname(OUT_MP4), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${work}/frames.txt`, "-vf", `fps=30,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=fffaf0,format=yuv420p`, "-c:v", "libx264", "-crf", "21", "-preset", "slow", "-movflags", "+faststart", OUT_MP4]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", OUT_MP4, "-vf", "fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", OUT_GIF]);
  const mb = (f: string) => (fs.statSync(f).size / 1024 / 1024).toFixed(1);
  console.log(`video: ${OUT_MP4} (${total.toFixed(1)} s, ${mb(OUT_MP4)} MB, ${frames.length} frames) · gif: ${OUT_GIF} (${mb(OUT_GIF)} MB) · ${waits.length} waits: ${waits.map(([a, b]) => `${(b - a).toFixed(0)}s`).join(", ")}`);
}
