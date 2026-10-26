import type { Metadata } from "next";
import { Header } from "@/components/chrome";
import { Workspace } from "@/components/workspace";
import { site } from "@/config/site";

export const metadata: Metadata = { title: `Screen resumes · ${site.name}`, description: site.description };

export default function Screen() {
  return (
    <>
      <Header wide />
      <main>
        <Workspace />
      </main>
    </>
  );
}
