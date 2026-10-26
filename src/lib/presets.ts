import type { Rubric } from "./schema";

export const PRESETS: Rubric[] = [
  {
    title: "Software Engineering Intern",
    summary: "A student or new grad who already builds and ships real software.",
    categories: [
      { key: "shipped_projects", label: "Shipped projects", weight: 35, lookFor: "Projects with real users, deployments or measurable results, not tutorials." },
      { key: "open_source", label: "Open source", weight: 20, lookFor: "Merged pull requests to projects they don't own, or maintained repos others use." },
      { key: "work_experience", label: "Work experience", weight: 20, lookFor: "Internships or jobs where they owned a piece of production code." },
      { key: "fundamentals", label: "CS fundamentals", weight: 15, lookFor: "Data structures, systems or algorithms shown through coursework, contests or projects." },
      { key: "ai_fluency", label: "AI fluency", weight: 10, lookFor: "Builds with LLM APIs, agents or ML tooling in a project that works." },
    ],
    redFlags: ["Only tutorial or clone projects", "Skills listed with no project that uses them", "Unexplained claims of senior-level impact"],
  },
  {
    title: "Full-Stack Engineer",
    summary: "Owns features end to end, from database to UI, in production.",
    categories: [
      { key: "production_ownership", label: "Production ownership", weight: 30, lookFor: "Features they designed, shipped and ran in production, with scale or impact numbers." },
      { key: "frontend", label: "Frontend", weight: 20, lookFor: "Modern framework work (React, Next.js, Vue) with attention to UX and performance." },
      { key: "backend_data", label: "Backend and data", weight: 25, lookFor: "APIs, databases, queues; schema design and performance work." },
      { key: "engineering_practice", label: "Engineering practice", weight: 15, lookFor: "Testing, CI/CD, code review, observability, incident response." },
      { key: "collaboration", label: "Collaboration", weight: 10, lookFor: "Worked with product and design, mentored, or led a small project." },
    ],
    redFlags: ["Frequent stints under 6 months with no explanation", "No production work in 3+ years of experience"],
  },
  {
    title: "Machine Learning Engineer",
    summary: "Takes models from notebook to a reliable production system.",
    categories: [
      { key: "ml_in_production", label: "ML in production", weight: 35, lookFor: "Models deployed and monitored for real users, with latency or quality metrics." },
      { key: "modeling", label: "Modeling depth", weight: 25, lookFor: "Training, fine-tuning or evaluating models; sound experiment design." },
      { key: "data_engineering", label: "Data engineering", weight: 20, lookFor: "Pipelines, feature stores, large-scale data processing." },
      { key: "llm_systems", label: "LLM systems", weight: 20, lookFor: "RAG, agents, evals or inference optimisation shipped in a product." },
    ],
    redFlags: ["Only Kaggle or course projects for a senior role", "Metrics claimed without context"],
  },
];
