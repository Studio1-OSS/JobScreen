# How JobScreen works

## Reading resumes

| Input | How it's read |
| --- | --- |
| PDF | Rendered in the browser (up to 4 pages at 1100px) and read as images, with the hidden-text check |
| Scans and photos (PNG, JPG, WebP) | Read as images |
| ZIP archives (an ATS export, say) | Unpacked in the browser; every supported file inside is added |
| Folders | Walked recursively |
| Word (`.docx`), `.txt`, `.md` | Scored from their text |
| Pasted text | One resume, or many separated by a `---` line |

Duplicates are skipped and unsupported files are listed. A queue screens resumes in parallel (1 to 8 at once, 4 by default), with pause, retry and time left.

## Scoring

- **Rubric.** Pick a preset, or paste a job description and the rubric agent drafts 3 to 6 weighted categories. Weights are editable and scaled to 100.
- **Scores.** Each category gets 0-10, with a rationale and quotes from the resume. Every quote is checked word for word against the source (✓ found, ⚠ paraphrased).
- **Total.** The 0-100 total is computed in code from the category scores, so it's reproducible from the scorecard.
- **Two calls side by side.**
  - The model's call (advance / consider / decline, with a reason and a confidence).
  - The score band (70+ advance, 50+ consider).
  - When they disagree, the candidate lands in **Needs review**.
- **Profile.** Each resume also becomes a structured [JSON Resume](https://jsonresume.org/schema) profile. Years of experience are computed from the dates, with overlapping roles counted once.

## Hidden text

Before anything goes to the model, every piece of text in the PDF is checked against the rendered page, pixel by pixel. Text that leaves no visible ink (white on white, under about 1.4pt, covered or off the page) is listed in a **Hidden text** panel and raised as a red flag. The vision model reads the page image, so it never sees that text and it can't move the score.

<img src="screenshots/drawer.png" alt="A scorecard with the model's call and the hidden instruction found in the PDF, shown word for word" width="900">

## Links and GitHub

Every web link visible on the resume is opened with a real request and marked:
- **loads**;
- **broken** (404, gone);
- **unreachable** (no such domain, timed out);
- **can't check**: LinkedIn and some other sites block automated checks.

The server refuses any address that resolves to a private, loopback, link-local or cloud-metadata range ([ipaddr.js](https://github.com/whitequark/ipaddr.js)). It checks on every redirect hop, so a resume can't make a public deployment probe its own network. Domains are parsed with [tldts](https://github.com/remusao/tldts).

A linked GitHub account is looked up with [Octokit](https://github.com/octokit/octokit.js), GitHub's official SDK, and tied to the person only on evidence:

| Verdict | Means |
| --- | --- |
| **Verified owner** | The account publishes the same website, LinkedIn or email as the resume |
| **Likely theirs** | Same name, but no shared link |
| **Not linked** | No shared link. A display name that differs from the resume is common and isn't a flag |
| **Doesn't exist** | No such account (red flag) |

Every repo the resume links to (`github.com/owner/repo`) is looked up too:

| Repo | Means |
| --- | --- |
| **Their repo** | On the candidate's own account |
| **Org repo** | On an organisation's account, such as an employer or an open-source project |
| **Another account** | On a different person's account (red flag) |
| **Private or missing** | GitHub returns 404: the repo is private or doesn't exist (red flag) |

<img src="screenshots/github.png" alt="Links and GitHub on a made-up applicant: the profile is only Not linked (a different display name isn't a flag), a repo that doesn't exist is Private or missing, torvalds/linux is on Another account, and a dead portfolio domain" width="900">

Only links visible on the rendered page are checked. A URL hidden in the PDF is never opened.

## Architecture

```
browser                                     server (Next.js route + Mastra)
files · ZIP · folder · paste
  └─► intake (dedupe) ─► queue (1-8 in parallel)
        PDF   ─► render pages + hidden-text check ─┐
        image ─► resized JPEG                      ├─► POST /api/screen ── live steps ──► shortlist
        DOCX / text ─► plain text                  │
rubric (preset or rubric agent) ───────────────────┘
                                         Mastra workflow "screen"
                                           read     reader agent: page images → transcript
                                           github   Octokit: profile, top repos, merged PRs, socials
                                           ┌ score    scorer agent: rubric + transcript → scorecard + call
                                           ├ profile  profile agent: transcript → JSON Resume
                                           └ verify   link checks, GitHub ownership, linked repos
                                           finish   code: totals, quote checks, years of experience, flags
```

| Part | Where |
| --- | --- |
| Model config (one OpenAI-compatible model for every agent, temperature 0, strict JSON) | [`src/mastra/model.ts`](../src/mastra/model.ts) |
| Agents | [`reader`](../src/mastra/agents/reader.ts), [`rubric`](../src/mastra/agents/rubric.ts), [`scorer`](../src/mastra/agents/scorer.ts), [`profile`](../src/mastra/agents/profile.ts) |
| Workflow, streamed to the browser | [`src/mastra/workflows/screen.ts`](../src/mastra/workflows/screen.ts), [`src/app/api/screen/route.ts`](../src/app/api/screen/route.ts) |
| PDF rendering and hidden text | [`src/lib/pdf-core.ts`](../src/lib/pdf-core.ts) |
| Bulk intake, queue, storage (IndexedDB) | [`src/lib/intake.ts`](../src/lib/intake.ts), [`src/components/workspace.tsx`](../src/components/workspace.tsx), [`src/lib/store.ts`](../src/lib/store.ts) |
| Verification | [`src/lib/verify.ts`](../src/lib/verify.ts), [`src/mastra/tools/links.ts`](../src/mastra/tools/links.ts) |
| Totals, score bands, quote checks (no model calls) | [`src/lib/text.ts`](../src/lib/text.ts) |

## Deploying

- It's a standard Next.js app with no database. Deploy anywhere Node runs and set `NEBIUS_API_KEY` and `JOBSCREEN_ACCESS_KEY`.
- Most resumes finish in 10-25 seconds; the screening route allows up to 180, so set your host's function limit to match.
- Each request carries one resume. Bulk speed is set by the browser's queue and your Nebius rate limit.
- Workflow runs aren't kept in memory after they finish.
- Nebius [caches identical prompt prefixes](https://docs.tokenfactory.nebius.com/cached-tokens) automatically, on a best-effort basis, with no setup. JobScreen puts the fixed instructions and the rubric first, so a batch against one job reuses them.

## Extending

- **Another model:** set `NEBIUS_MODEL` and run `pnpm smoke:nebius`.
- **Another rubric preset:** [`src/lib/presets.ts`](../src/lib/presets.ts).
- **Another file type:** [`src/lib/intake.ts`](../src/lib/intake.ts) and [`src/lib/prepare.ts`](../src/lib/prepare.ts).
- **A new workflow step:** add a `createStep` in [`src/mastra/workflows/screen.ts`](../src/mastra/workflows/screen.ts).
