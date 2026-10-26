import { Mastra } from "@mastra/core/mastra";
import { readerAgent } from "./agents/reader";
import { rubricAgent } from "./agents/rubric";
import { scorerAgent } from "./agents/scorer";
import { screenWorkflow } from "./workflows/screen";

export const mastra = new Mastra({
  agents: { readerAgent, rubricAgent, scorerAgent },
  workflows: { screenWorkflow },
});
