<div align="center">

<img src="docs/logo.svg" alt="JobScreen logo" width="96" height="96">

# JobScreen

### A resume score that shows its work.

**Open-source resume scoring. Recruiters rank applicants from any ATS export and read the best first; job seekers get their resume score for a job before they apply, and see what would filter them out. It reads the actual page with [DeepSeek V4.1 Flash 1017](https://tokenfactory.nebius.com/?modals=endpoint-details&model-id=deepseek-ai/DeepSeek-V4.1-Flash-1017) vision, and every score shows its evidence.**

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
[![DeepSeek V4.1 Flash 1017](https://img.shields.io/badge/model-DeepSeek%20V4.1%20Flash%201017-7a5fd6)](https://tokenfactory.nebius.com/?modals=endpoint-details&model-id=deepseek-ai/DeepSeek-V4.1-Flash-1017)
[![Nebius Token Factory](https://img.shields.io/badge/models-Nebius%20Token%20Factory-e0ff4f?labelColor=0b0b0b)](https://dub.sh/aistudio)
[![Mastra](https://img.shields.io/badge/agents-Mastra-0a0a0a)](https://mastra.ai)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Built by Studio1 team](https://img.shields.io/badge/built%20by-Studio1%20team-ff6b1a)](https://studio1hq.com)

<a href="public/demo/jobscreen-demo.mp4"><img src="docs/demo.gif" alt="JobScreen in use: an HR job description becomes a rubric, nine resumes are screened into a ranked shortlist, a scorecard shows the evidence and a hidden instruction caught in one PDF, then a job seeker checks their resume against a job" width="900"></a>

_Screening nine resumes against an HR job, then checking one resume as a job seeker. [Watch the video](public/demo/jobscreen-demo.mp4)._

</div>

## What it does

Most screening tools turn a PDF into text and hand it to a model. Scanned resumes come back empty, and text hidden in the file (white or microscopic) reaches the model even though no person can see it. JobScreen reads the rendered page instead.

### For recruiters: rank applicants, read the best first

- Drop **up to 50 resumes at a time**: PDFs, scans, Word files, a ZIP export from your ATS, a folder, or pasted text. Add more batches whenever you like.
- Paste a **job description** and get a weighted rubric you can edit, or start from a preset.
- Get a **ranked shortlist**. Each candidate has a score per category with quotes from their resume, the model's call (advance / consider / decline) with its reason, red flags and tailored interview questions.
- **Links are opened to check they load**, and a GitHub account is only tied to the candidate when it publishes the same site, LinkedIn or email.
- **Hidden-text tricks are caught** and shown word for word.
- Sort, filter and search, step through scorecards with **← →**, and export **CSV**, structured **profiles** ([JSON Resume](https://jsonresume.org/schema)) or full **JSON**.

<div align="center"><img src="docs/screenshots/workspace.png" alt="The shortlist: a rubric drafted from an HR job description, nine resumes with per-category scores and the model's call, one marked Needs review and one flagged for hidden text" width="900"></div>

### For job seekers: your score before you apply

Paste the job, add your resume, and see what would filter you out:
- the **likely call** and why;
- your **score** per category, with the lines that earned it;
- the **gaps** that cost you, and what would hold you back;
- the **questions** you'd likely be asked;
- **broken links**, and **hidden text** in your PDF.

Nothing is stored.

<div align="center"><img src="docs/screenshots/check.png" alt="A job seeker's result: the likely call with its reason, the score, and category scores with the lines from the resume that earned them" width="900"></div>

## Get started

Use **Node.js 22+** and **pnpm**:

```sh
git clone https://github.com/Studio1-OSS/jobscreen.git
cd jobscreen
pnpm install
cp .env.example .env      # add NEBIUS_API_KEY
pnpm dev
```

Open **http://localhost:3300**:
- recruiters: **Screen applicants**, then **try 3 sample resumes**;
- job seekers: **Check my resume**, then **Use an example** job.

| Variable | What it does |
| --- | --- |
| `NEBIUS_API_KEY` | **Required.** Model calls via [Nebius Token Factory](https://tokenfactory.nebius.com). |
| `JOBSCREEN_ACCESS_KEY` | **Set it on any public deployment**, so only people with the key can use your credits. |
| `GITHUB_TOKEN` | Optional. Raises GitHub's limit from 60 to 5,000 lookups an hour, for big batches. |
| `NEBIUS_MODEL` | Optional. Any vision model with structured output; check it with `pnpm smoke:nebius`. |

The rest are in [`.env.example`](.env.example). To deploy, use any Node host (Vercel works) that allows functions to run for 60 seconds or more. Details, architecture and how to extend it: [docs/how-it-works.md](docs/how-it-works.md).

## How well it works

Tested on 50 real, anonymised resumes ([method and numbers](bench/README.md)):
- **Scanned resumes are read in full.** Vision recovered 99% of the words, where text extraction gets nothing.
- **Hidden-text tricks are caught:** in 50 of 50 resumes that had them, with no false alarms on 50 clean ones.
- **The right people rank high:** ranking quality 0.87 (1.0 is perfect). That holds when 30% of the pile is scans, where text-only drops to 0.70.
- **Scores are steady:** the same resume scored twice lands about 3 points apart.

## Responsible use and privacy

- **JobScreen supports a human reviewer; it doesn't replace one.** It never rejects anyone, and every score shows its evidence.
- **Screening laws apply.** Automated screening is regulated in places such as New York City (Local Law 144) and the EU (AI Act, high-risk). Check what applies to you, and keep a person in the loop.
- **The prompts ignore** name, age, gender, nationality, photos, school prestige and employment gaps.
- **Nothing is stored on the server.**
  - Page images (or text) go to the model.
  - Links on a resume are opened to check them.
  - Results stay in your browser until you press **Clear all**.

## Credits

Inspired by HackerRank's open-source hiring-agent. Built with [Mastra](https://mastra.ai), [Octokit](https://github.com/octokit/octokit.js), [pdf.js](https://mozilla.github.io/pdf.js/), [tldts](https://github.com/remusao/tldts) and [ipaddr.js](https://github.com/whitequark/ipaddr.js). Benchmark data: the [Resume Dataset](https://www.kaggle.com/datasets/snehaanbhawal/resume-dataset) (CC0).

MIT licensed · [Contributing](./CONTRIBUTING.md) · [Security](./SECURITY.md)
