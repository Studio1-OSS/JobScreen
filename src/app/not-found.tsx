import Link from "next/link";
import { Footer, Header } from "@/components/chrome";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6">
        <p className="eyebrow text-muted">404</p>
        <h1 className="display mt-3 text-[48px] leading-tight">This page isn’t on the shortlist.</h1>
        <div className="mt-8 flex gap-3">
          <Link href="/screen" className="btn btn-primary">Screen applicants</Link>
          <Link href="/" className="btn btn-secondary">Home</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
