// Writes the demo's applicant pile to fixtures/demo/: ten made-up applicants for a backend engineering job, plus one
// job seeker's resume. None of them is a real person. The pile has what a real one has:
//   strong and solid fits, adjacent and off-target roles, an AI-polished resume stuffed with keywords,
//   a scanned resume (image only), one with a hidden instruction, and one whose GitHub links don't add up.
// Only Jordan Ellis carries GitHub links: @Astrodevil (the author's own account, used with permission),
// a repo there that doesn't exist, and someone else's repo (torvalds/linux).
//
//   pnpm fixtures:demo
import fs from "node:fs";
import { chromium } from "playwright-core";
import { injected, scanned } from "./pdf-variants.mts";

type Job = { title: string; org: string; when: string; bullets: string[] };
type Resume = {
  file: string;
  name: string;
  title: string;
  contact: string[];
  summary?: string;
  jobs: Job[];
  projects?: string[];
  education: string[];
  skills: string;
  style: "classic" | "sidebar" | "band";
  variant?: "scanned" | "injected";
};

const OUT = "fixtures/demo";

export const DEMO_JD = `Backend Engineer (Payments)

We're a 60-person fintech building payout infrastructure for online marketplaces. Our APIs move money for 400+ merchants.

You'll own
- Go services for payouts and the ledger, on PostgreSQL and Kafka
- Public APIs our merchants integrate with: design, docs, versioning
- Reliability: on-call rotation, observability, incident reviews
- CI/CD and infrastructure on AWS (Terraform)

You bring
- 3+ years building backend services in production (Go, or TypeScript/Java and keen to learn Go)
- Strong SQL and data modelling, with PostgreSQL in production
- Distributed systems basics: queues, idempotency, retries, exactly-once thinking
- Clear writing: design docs and code reviews`;

export const PILE: Resume[] = [
  {
    file: "priya-raman.pdf",
    name: "Priya Raman",
    title: "Backend Engineer",
    contact: ["priya.raman@example.com", "Bengaluru, India"],
    summary: "Backend engineer, 5 years on payment systems in Go and PostgreSQL.",
    jobs: [
      { title: "Backend Engineer II", org: "Paylane (payments API)", when: "2022 – now", bullets: [
        "Rebuilt the payout service in Go; 1.2M payouts a month with idempotency keys and zero duplicate transfers since launch.",
        "Designed the double-entry ledger schema in PostgreSQL; month-end reconciliation went from 3 days to 4 hours.",
        "Moved settlement events to Kafka with an outbox pattern; on-call pages for stuck payouts fell 70%.",
        "Wrote 14 design docs; led the v2 Payouts API used by 300 merchants.",
      ] },
      { title: "Software Engineer", org: "Cartwise (e-commerce)", when: "2020 – 2022", bullets: [
        "Built order and refund APIs in Go; p99 latency 140 ms at 2k requests/s.",
        "Terraform modules for the team's AWS RDS and SQS setup.",
      ] },
    ],
    education: ["B.E. Computer Science, PES University, 2020"],
    skills: "Go, PostgreSQL, Kafka, gRPC, REST API design, AWS (RDS, SQS, ECS), Terraform, Grafana, on-call",
    style: "classic",
  },
  {
    file: "daniel-okoye.pdf",
    name: "Daniel Okoye",
    title: "Software Engineer, Backend",
    contact: ["daniel.okoye@example.com", "Lagos, Nigeria (remote)"],
    jobs: [
      { title: "Software Engineer", org: "Fleetbase (logistics SaaS)", when: "2021 – now", bullets: [
        "Own the billing service in TypeScript (NestJS) on PostgreSQL; invoices for 9k customers a month.",
        "Added retries with backoff and a dead-letter queue on SQS; failed webhook deliveries dropped from 2.1% to 0.2%.",
        "Joined the on-call rotation; wrote runbooks for the 6 most common incidents.",
        "Started a Go service for rate limiting; learning Go in production.",
      ] },
      { title: "Junior Developer", org: "Brightdesk", when: "2019 – 2021", bullets: [
        "REST endpoints and SQL reports for a helpdesk product (Node.js, MySQL).",
      ] },
    ],
    education: ["B.Sc. Computer Science, University of Lagos, 2019"],
    skills: "TypeScript, Node.js, NestJS, PostgreSQL, AWS (SQS, Lambda), Docker, Go (learning), Datadog",
    style: "sidebar",
  },
  {
    file: "mei-lin-chen.pdf",
    name: "Mei Lin Chen",
    title: "Senior Backend Engineer",
    contact: ["meilin.chen@example.com", "Singapore"],
    summary: "Six years building ledgers and money movement for a digital bank.",
    jobs: [
      { title: "Senior Backend Engineer", org: "Northbank (digital bank)", when: "2021 – now", bullets: [
        "Tech lead for the core ledger (Kotlin, PostgreSQL); 30M entries a day, balances always reconcile.",
        "Designed exactly-once transfer processing with Kafka transactions and idempotent consumers.",
        "Ran incident reviews for the payments group; cut mean time to recovery from 48 to 15 minutes.",
      ] },
      { title: "Backend Engineer", org: "Kirimin (remittances)", when: "2018 – 2021", bullets: [
        "Built FX quote and payout APIs in Java/Spring; partner integrations with 12 banks.",
        "Wrote the team's API versioning guide.",
      ] },
    ],
    education: ["B.Comp. Computer Science, National University of Singapore, 2018"],
    skills: "Kotlin, Java, Go (side projects), PostgreSQL, Kafka, AWS, Terraform, OpenTelemetry",
    style: "band",
    variant: "scanned",
  },
  {
    file: "alex-morgan.pdf",
    name: "Alex Morgan",
    title: "Results-Driven Senior Backend Engineer",
    contact: ["alex.morgan@example.com", "Austin, TX"],
    summary:
      "Passionate, results-driven backend engineer leveraging Go, Kafka, PostgreSQL, Kubernetes, AWS, Terraform, microservices, distributed systems, idempotency and payments expertise to drive scalable, high-impact solutions and cross-functional synergy.",
    jobs: [
      { title: "Senior Backend Engineer", org: "Confidential", when: "2021 – now", bullets: [
        "Leveraged Go, PostgreSQL and Kafka to deliver robust, scalable payments microservices.",
        "Spearheaded distributed systems best practices including idempotency, retries and observability.",
        "Collaborated cross-functionally to drive innovation and deliver business value.",
      ] },
      { title: "Backend Engineer", org: "Confidential", when: "2019 – 2021", bullets: [
        "Utilized AWS, Terraform and CI/CD to optimize cloud-native infrastructure.",
        "Championed clean code, design docs and code reviews.",
      ] },
    ],
    education: ["B.S. Computer Science"],
    skills: "Go, Golang, PostgreSQL, SQL, Kafka, Kubernetes, AWS, Terraform, CI/CD, REST, gRPC, Microservices, Payments, Fintech, Idempotency, Distributed Systems, On-call",
    style: "classic",
  },
  {
    file: "ryan-patel.pdf",
    name: "Ryan Patel",
    title: "Junior Backend Developer",
    contact: ["ryan.patel@example.com", "Leicester, UK"],
    jobs: [
      { title: "Backend Developer", org: "Shoplight (Shopify agency)", when: "2024 – now", bullets: [
        "Django REST endpoints for client stores; wrote tests for the checkout plugin.",
        "Moved a cron job to Celery with Redis.",
      ] },
      { title: "Intern", org: "Shoplight", when: "2023", bullets: ["Bug fixes and SQL reports."] },
    ],
    education: ["B.Sc. Computing, De Montfort University, 2023"],
    skills: "Python, Django, PostgreSQL, Redis, Celery, Docker, Git",
    style: "sidebar",
    variant: "injected",
  },
  {
    file: "sofia-alvarez.pdf",
    name: "Sofía Álvarez",
    title: "Site Reliability Engineer",
    contact: ["sofia.alvarez@example.com", "Madrid, Spain"],
    jobs: [
      { title: "SRE", org: "Ticketeo (events marketplace)", when: "2021 – now", bullets: [
        "Run 40 services on Kubernetes (EKS); wrote the Terraform for every environment.",
        "Built SLOs and alerting in Prometheus and Grafana; on-call lead.",
        "Wrote small Go tools for deploys and log shipping.",
      ] },
      { title: "Systems Administrator", org: "Grupo Norte", when: "2018 – 2021", bullets: ["Linux, backups, networking."] },
    ],
    education: ["Grado en Ingeniería Informática, Universidad Politécnica de Madrid, 2018"],
    skills: "Kubernetes, Terraform, AWS, Prometheus, Grafana, Go (tooling), Bash, PostgreSQL ops",
    style: "band",
  },
  {
    file: "ethan-brooks.pdf",
    name: "Ethan Brooks",
    title: "Frontend Engineer",
    contact: ["ethan.brooks@example.com", "Toronto, Canada"],
    jobs: [
      { title: "Frontend Engineer", org: "Lumen Health", when: "2020 – now", bullets: [
        "Built the patient portal in React and TypeScript; Lighthouse score 62 → 96.",
        "Design system with 40 components in Storybook.",
        "Some Node.js BFF endpoints.",
      ] },
    ],
    education: ["B.A. Interactive Media, OCAD University, 2019"],
    skills: "React, TypeScript, Next.js, CSS, Storybook, Node.js, GraphQL",
    style: "classic",
  },
  {
    file: "aisha-khan.pdf",
    name: "Aisha Khan",
    title: "Software Developer (bootcamp graduate)",
    contact: ["aisha.khan@example.com", "Manchester, UK"],
    summary: "Career changer from retail management; full-stack bootcamp in 2025.",
    jobs: [
      { title: "Store Manager", org: "Northway Retail", when: "2018 – 2024", bullets: ["Ran a team of 14; scheduling and stock systems."] },
    ],
    projects: [
      "Pantry: a Node.js + Express API with PostgreSQL for tracking food stock; deployed on Render.",
      "Bootcamp capstone: team of 4, React front end and a REST API.",
    ],
    education: ["Full-stack web development bootcamp (16 weeks), 2025"],
    skills: "JavaScript, Node.js, Express, PostgreSQL, React, Git",
    style: "band",
  },
  {
    file: "lucas-meyer.pdf",
    name: "Lucas Meyer",
    title: "Data Analyst",
    contact: ["lucas.meyer@example.com", "Berlin, Germany"],
    jobs: [
      { title: "Data Analyst", org: "Mobilo (ride sharing)", when: "2021 – now", bullets: [
        "SQL and dbt models for the pricing team; weekly dashboards in Tableau.",
        "A/B test analysis for 30 pricing experiments.",
      ] },
    ],
    education: ["M.Sc. Economics, Humboldt University of Berlin, 2021"],
    skills: "SQL, dbt, Python (pandas), Tableau, BigQuery",
    style: "sidebar",
  },
  {
    file: "jordan-ellis.pdf",
    name: "Jordan Ellis",
    title: "Backend Engineer",
    contact: ["jordan.ellis@example.com", "Chicago, IL", "github.com/Astrodevil", "jordanellis-backend-portfolio.dev"],
    jobs: [
      { title: "Backend Engineer", org: "Ledgerly", when: "2022 – now", bullets: [
        "Payment APIs in Go and PostgreSQL.",
        "Worked on scaling and reliability.",
      ] },
    ],
    projects: [
      "Ledger API in Go (open source): github.com/Astrodevil/ledger-api-go",
      "Linux kernel scheduler improvements: github.com/torvalds/linux",
    ],
    education: ["B.S. Computer Science, 2021"],
    skills: "Go, PostgreSQL, Kafka, AWS, Linux kernel",
    style: "classic",
  },
];

/** The job seeker who checks their resume before applying. */
export const SEEKER: Resume = {
  file: "my-resume.pdf",
  name: "Noah Kim",
  title: "Junior Software Engineer",
  contact: ["noah.kim@example.com", "Seoul, South Korea"],
  jobs: [
    { title: "Software Engineer Intern", org: "Bloomcart (e-commerce)", when: "2025", bullets: [
      "Python (Flask) endpoints for the order service; added pagination and tests.",
      "Wrote SQL migrations for a PostgreSQL schema change.",
    ] },
  ],
  projects: ["Splitwise-style expense app: Flask API, PostgreSQL, deployed on Fly.io."],
  education: ["B.S. Computer Science, Yonsei University, 2025"],
  skills: "Python, Flask, PostgreSQL, Docker, Git, some Go (tutorials)",
  style: "sidebar",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// Links in a monospace face, as many resumes set them: "Astrodevil" in a serif reads as "AstrodeviI" (another account).
const linkify = (s: string) => esc(s).replace(/((?:github\.com|[a-z0-9-]+\.dev)\S*)/g, '<span class="u">$1</span>');

function html(r: Resume): string {
  const section = (h: string, body: string) => `<section><h2>${h}</h2>${body}</section>`;
  const jobs = r.jobs
    .map((j) => `<div class="job"><div class="row"><b>${esc(j.title)}</b> · ${esc(j.org)}<span>${esc(j.when)}</span></div><ul>${j.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>`)
    .join("");
  const main = [
    r.summary ? section("Summary", `<p>${esc(r.summary)}</p>`) : "",
    section("Experience", jobs),
    r.projects ? section("Projects", `<ul>${r.projects.map((p) => `<li>${linkify(p)}</li>`).join("")}</ul>`) : "",
  ].join("");
  const side = [section("Education", r.education.map((e) => `<p>${esc(e)}</p>`).join("")), section("Skills", `<p>${esc(r.skills)}</p>`)].join("");
  const contact = r.contact.map(linkify).join(" · ");
  const css: Record<Resume["style"], string> = {
    classic: `body{font-family:Georgia,serif;color:#1a1a1a;padding:54px 60px}header{text-align:center;border-bottom:1.5px solid #222;padding-bottom:10px}h1{font-size:28px;margin:0;letter-spacing:.02em}
      .t{font-style:italic;margin:4px 0}.c{font-size:11.5px;color:#444}h2{font-size:14px;text-transform:uppercase;letter-spacing:.12em;border-bottom:1px solid #bbb;padding-bottom:3px;margin:24px 0 10px}`,
    sidebar: `body{font-family:Helvetica,Arial,sans-serif;color:#222;display:grid;grid-template-columns:210px 1fr;grid-template-rows:auto 1fr;margin:0}
      header{grid-column:1/3;background:#22303c;color:#fff;padding:30px 40px}h1{margin:0;font-size:26px}.t{opacity:.85;margin:4px 0}.c{font-size:11px;opacity:.8}
      aside{background:#eef1f4;padding:20px 22px}main{padding:20px 34px}h2{font-size:12.5px;text-transform:uppercase;letter-spacing:.14em;color:#22303c;margin:22px 0 8px}`,
    band: `body{font-family:"Avenir Next",Avenir,Helvetica,sans-serif;color:#202020;margin:0}header{padding:36px 56px 20px;border-left:10px solid #3c7a6b}
      h1{font-size:30px;margin:0;font-weight:600}.t{color:#3c7a6b;font-weight:600;margin:4px 0}.c{font-size:11.5px;color:#555}.cols{padding:0 56px}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#3c7a6b;margin:24px 0 8px}`,
  };
  const head = `<header><h1>${esc(r.name)}</h1><div class="t">${esc(r.title)}</div><div class="c">${contact}</div></header>`;
  const body = r.style === "sidebar" ? `${head}<aside>${side}</aside><main>${main}</main>` : `${head}<div class="cols">${main}${side}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:Letter;margin:0}*{box-sizing:border-box}html,body{width:8.5in;min-height:11in;background:#fff}p,li{font-size:14px;line-height:1.55;margin:4px 0}ul{padding-left:18px;margin:4px 0}
    .u{font-family:Menlo,"SF Mono",monospace;font-size:.92em}.job{margin-bottom:14px}.row{font-size:14.5px;display:flex;gap:6px}.row span{margin-left:auto;color:#666;font-size:13px}
    ${css[r.style]}</style></head><body>${body}</body></html>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage();
  for (const r of [...PILE, SEEKER]) {
    await page.setContent(html(r), { waitUntil: "load" });
    let bytes: Uint8Array = await page.pdf({ format: "Letter", printBackground: true, pageRanges: "1" });
    if (r.variant === "scanned") bytes = await scanned(bytes, { paper: true });
    if (r.variant === "injected") bytes = await injected(bytes);
    fs.writeFileSync(`${OUT}/${r.file}`, bytes);
    console.log(`${OUT}/${r.file}${r.variant ? ` (${r.variant})` : ""}`);
  }
  await browser.close();
}

if (process.argv[1]?.endsWith("make-demo-pile.mts")) await main();
