import Link from "next/link";
import { site } from "@/config/site";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.name} home`}>
      <svg viewBox="0 0 64 64" className="size-8" aria-hidden>
        <rect width="64" height="64" rx="18" fill="#b8a4ed" />
        <rect x="12" y="10" width="29" height="38" rx="7" fill="#fffaf0" />
        <rect x="18.5" y="18" width="16" height="4.5" rx="2.25" fill="#0a0a0a" />
        <rect x="18.5" y="26.5" width="11" height="4.5" rx="2.25" fill="#ff4d8b" />
        <rect x="18.5" y="35" width="13" height="4.5" rx="2.25" fill="#0a0a0a" fillOpacity="0.28" />
        <path d="M47.5 47.5 54 54" stroke="#0a0a0a" strokeWidth="6.5" strokeLinecap="round" />
        <circle cx="40" cy="40" r="10.5" fill="#fffaf0" fillOpacity="0.55" stroke="#0a0a0a" strokeWidth="5" />
      </svg>
      <span className="display text-[22px] tracking-[-0.03em]">{site.name}</span>
    </Link>
  );
}

export function Header({ wide = false }: { wide?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline-soft bg-canvas/90 backdrop-blur">
      <div className={`mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6 ${wide ? "max-w-[1440px]" : "max-w-[1280px]"}`}>
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-medium text-ink sm:gap-2">
          <Link href="/screen" className="rounded-full px-2.5 py-2 hover:bg-surface-card sm:px-3">
            <span className="sm:hidden">Screen</span>
            <span className="hidden sm:inline">Screen applicants</span>
          </Link>
          <Link href="/check" className="rounded-full px-2.5 py-2 hover:bg-surface-card sm:px-3">
            <span className="sm:hidden">Check resume</span>
            <span className="hidden sm:inline">Check my resume</span>
          </Link>
          <a href={site.links.repo} className="hidden rounded-full px-3 py-2 hover:bg-surface-card sm:inline" target="_blank" rel="noreferrer">GitHub</a>
          <a href={site.links.model} target="_blank" rel="noreferrer" className="pill ml-1 hidden md:inline-flex">
            <span className="size-2 rounded-full bg-success" aria-hidden />
            {site.model} on Nebius
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 bg-surface-soft">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-16 text-sm sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-md text-body">
            Open-source resume screening for recruiters and job seekers. It reads the page a person sees, and every score shows its
            evidence. A screening aid, not a hiring decision.
          </p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow text-muted">Built with</p>
          <a className="block text-ink hover:underline" href={site.links.nebius} target="_blank" rel="noreferrer">Nebius Token Factory</a>
          <a className="block text-ink hover:underline" href={site.links.model} target="_blank" rel="noreferrer">{site.model}</a>
          <a className="block text-ink hover:underline" href={site.links.mastra} target="_blank" rel="noreferrer">Mastra</a>
        </div>
        <div className="space-y-2">
          <p className="eyebrow text-muted">Project</p>
          <a className="block text-ink hover:underline" href={site.links.repo} target="_blank" rel="noreferrer">Source on GitHub</a>
          <Link className="block text-ink hover:underline" href="/screen">Screen applicants</Link>
          <Link className="block text-ink hover:underline" href="/check">Check my resume</Link>
          <Link className="block text-ink hover:underline" href="/benchmark">How it was tested</Link>
          <a className="block text-ink hover:underline" href={site.links.studio1} target="_blank" rel="noreferrer">Built by Studio1</a>
        </div>
      </div>
    </footer>
  );
}
