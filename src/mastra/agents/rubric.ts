import { Agent } from "@mastra/core/agent";
import { rubricSchema, type Rubric } from "@/lib/schema";
import { normaliseRubric } from "@/lib/text";
import { callOptions, nebius } from "../model";

export const rubricAgent = new Agent({
  id: "rubric",
  name: "Rubric builder",
  description: "Turns a job description into a weighted screening rubric.",
  instructions: `You design resume-screening rubrics from job descriptions.

- 3 to 6 categories. Each one must be something a resume can show evidence for.
- Weights reflect what the job description stresses most; they will be scaled to sum to 100.
- "lookFor" names concrete evidence (shipped work, numbers, tools in use), not personality traits.
- Never use age, gender, nationality, school prestige, photos or other protected or proxy attributes.
- Red flags are about the work itself (unsupported claims, no evidence for required skills). Never flag employment gaps, career breaks or job changes.`,
  model: () => nebius(),
});

export async function draftRubric(jobDescription: string): Promise<Rubric> {
  const r = await rubricAgent.generate(`Job description:\n\n${jobDescription.slice(0, 12000)}`, {
    structuredOutput: { schema: rubricSchema },
    ...callOptions(false, 4000),
  });
  return normaliseRubric(r.object);
}
