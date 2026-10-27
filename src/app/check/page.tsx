import type { Metadata } from "next";
import { Footer, Header } from "@/components/chrome";
import { ResumeCheck } from "@/components/resume-check";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `Resume score checker · ${site.name}`,
  description: "Get your resume score for a job before you apply. See the likely call, the evidence behind every point, what's missing and what would hold you back. Free and open source; nothing is stored.",
};

export default function Check() {
  return (
    <>
      <Header />
      <main>
        <ResumeCheck />
      </main>
      <Footer />
    </>
  );
}
