// Checks that the configured Nebius model can do what JobScreen needs: read a rendered page, and return
// strict JSON with reasoning on and off.
//
//   pnpm smoke:nebius
import "dotenv/config";
import fs from "node:fs";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { callOptions, MODEL_ID, nebius } from "../src/mastra/model.ts";
import { readPdf } from "./pdf-node.mts";

if (!fs.existsSync("fixtures/strong.pdf")) {
  console.error("Run `pnpm fixtures` first.");
  process.exit(1);
}
const { pages } = await readPdf(fs.readFileSync("fixtures/strong.pdf"));
const agent = new Agent({ id: "smoke", name: "smoke", instructions: "Answer from the image only.", model: () => nebius() });
const schema = z.object({ name: z.string(), email: z.string(), employer: z.string() });
console.log(`Model ${MODEL_ID}\n`);

let ok = true;
for (const thinking of [false, true]) {
  const t = Date.now();
  try {
    const r = await agent.generate(
      [{ role: "user", content: [{ type: "image", image: pages[0] }, { type: "text", text: "Candidate name, email, and the company of their internship." }] }],
      { structuredOutput: { schema }, ...callOptions(thinking, 2000) },
    );
    const pass = /maya okafor/i.test(r.object.name) && /ledgerline/i.test(r.object.employer);
    ok &&= pass;
    console.log(`${pass ? "✓" : "✗"} vision + strict JSON, thinking ${thinking ? "on " : "off"}  ${Date.now() - t}ms  ${JSON.stringify(r.object)}`);
  } catch (e) {
    ok = false;
    console.log(`✗ vision + strict JSON, thinking ${thinking ? "on " : "off"}  ${String(e).slice(0, 160)}`);
  }
}
process.exit(ok ? 0 : 1);
