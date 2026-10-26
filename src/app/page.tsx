import Link from "next/link";
import { ArrowRight, Check, EyeOff, FolderGit2, FolderOpen, ListChecks, Quote, ScanEye, SlidersHorizontal } from "lucide-react";
import { HeroArt } from "@/components/hero-art";
import { Footer, Header } from "@/components/chrome";
import { site } from "@/config/site";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <section className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 pb-14 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[7fr_5fr]">
          <div>
            <p className="pill mb-6">Open source · {site.model} vision · Mastra</p>
            <h1 className="display text-[44px] leading-[1.02] sm:text-[60px] lg:text-[72px]">{site.tagline}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-body">
              JobScreen reads the actual page, the way a person does, and scores it against the job with a quote behind every point. Recruiters rank
              applicants from any ATS export and read the best first. Job seekers get their score for a job before they apply, and see what would filter them out.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/screen" className="btn btn-primary">Screen applicants <ArrowRight className="size-4" /></Link>
              <Link href="/check" className="btn btn-secondary">Check my resume</Link>
            </div>
          </div>
          <div className="rounded-[24px] bg-surface-soft p-6">
            <HeroArt className="h-auto w-full" />
          </div>
        </section>

        <section className="mx-auto grid max-w-[1280px] gap-5 px-4 sm:px-6 md:grid-cols-2">
          <Audience
            cls="bg-teal text-white"
            eyebrow="For recruiters"
            title="Rank applicants from any ATS export and read the best first."
            points={[
              "Drop up to 50 resumes at a time: PDFs, scans, Word files, ZIP exports or whole folders",
              "A rubric from your job description, with weights you control",
              "A ranked shortlist: the model's call, a score, and quotes for every number",
              "Links and GitHub checked, hidden-text tricks caught",
              "Export CSV, structured profiles (JSON Resume) or full scorecards",
            ]}
            href="/screen"
            cta="Rank applicants"
          />
          <Audience
            cls="bg-lavender text-ink"
            eyebrow="For job seekers"
            title="Get your resume score for a job before you apply."
            points={[
              "Paste the job, add your resume",
              "See the likely call (advance, consider or decline) and why",
              "What earned you points, what's missing, and the gaps that cost you",
              "Broken links and a GitHub that can't be tied to you, flagged",
              "The questions you'd likely be asked in the interview",
            ]}
            href="/check"
            cta="Check my resume"
          />
        </section>

        <section className="mx-auto mt-24 max-w-[1280px] px-4 sm:px-6">
          <p className="eyebrow text-muted">How it reads</p>
          <h2 className="display mt-2 max-w-3xl text-[36px] leading-[1.08] sm:text-[48px]">Text extraction reads the file. People read the page.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Feature cls="bg-surface-card text-ink" icon={<ScanEye className="size-6" />} title="Vision, not text scraping">
              Each page is rendered and read as an image, so scanned resumes, photos and designed layouts count. Text-only screeners see nothing in a scan.
            </Feature>
            <Feature cls="bg-pink text-white" icon={<EyeOff className="size-6" />} title="Hidden text can't steer the score">
              White or microscopic text sits in the file but not on the page. JobScreen finds it pixel by pixel, shows it, and scores only what's visible.
            </Feature>
            <Feature cls="bg-surface-card text-ink" icon={<Quote className="size-6" />} title="Evidence, checked">
              Every category score quotes the resume, and each quote is matched word for word against it, so a citation can't be invented.
            </Feature>
            <Feature cls="bg-surface-card text-ink" icon={<FolderGit2 className="size-6" />} title="Links and GitHub, verified">
              Every link is opened to see if it loads. A GitHub account is tied to the person only when it publishes the same site, LinkedIn or email.
            </Feature>
            <Feature cls="bg-peach text-ink" icon={<SlidersHorizontal className="size-6" />} title="Your rubric in one paste">
              Paste a job description and get weighted categories you can edit. Totals are computed in code, beside the model&apos;s own call.
            </Feature>
            <Feature cls="bg-surface-card text-ink" icon={<FolderOpen className="size-6" />} title="Yours to run">
              MIT licensed, one API key, no database. Results stay in the browser; set an access key before you put it on the internet.
            </Feature>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-[1280px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-surface-soft px-6 py-5">
            <p className="flex items-center gap-2 text-sm text-body">
              <ListChecks className="size-4 shrink-0" /> Measured on 50 real resumes: scanned resumes read in full, hidden-text tricks caught every time.
            </p>
            <Link href="/benchmark" className="text-sm font-semibold text-ink underline-offset-4 hover:underline">How it was tested <ArrowRight className="inline size-3.5" /></Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Audience({ cls, eyebrow, title, points, href, cta }: { cls: string; eyebrow: string; title: string; points: string[]; href: string; cta: string }) {
  return (
    <div className={`flex flex-col rounded-[24px] p-8 ${cls}`}>
      <p className="eyebrow opacity-80">{eyebrow}</p>
      <h2 className="display mt-2 text-[30px] leading-[1.1]" style={{ color: "inherit" }}>{title}</h2>
      <ul className="mt-5 flex-1 space-y-2 text-[15px]">
        {points.map((p) => (
          <li key={p} className="flex gap-2"><Check className="mt-1 size-4 shrink-0 opacity-80" /> {p}</li>
        ))}
      </ul>
      <Link href={href} className="btn mt-6 self-start bg-canvas text-ink">{cta} <ArrowRight className="size-4" /></Link>
    </div>
  );
}

function Feature({ cls, icon, title, children }: { cls: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-[24px] p-8 ${cls}`}>
      {icon}
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed opacity-90">{children}</p>
    </div>
  );
}
