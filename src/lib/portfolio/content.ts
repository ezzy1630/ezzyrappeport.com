/**
 * Placeholder portfolio content.
 * Replace these strings with your real projects, experience, and bio.
 * Everything is centralized here so you can swap content without touching component code.
 */

export type Project = {
  slug: string;
  index: string;
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  problem: string;
  approach: string;
  outcome: string;
  stack: string[];
  year: string;
  role: string;
  accent: "blue-strong" | "blue-medium" | "blue-low" | "blue-flow";
};

export const projects: Project[] = [
  {
    slug: "monkeyclaw",
    index: "01",
    title: "MONKEYCLAW",
    subtitle: "Multi-Agent Security System",
    tagline: "Autonomous red-team agents that find what humans miss.",
    description:
      "Monkeyclaw deploys a coordinated team of adversarial agents that probe, fuzz, and reason about a target system from multiple vantage points. Each agent specializes — one surfaces insecure surface area, another crafts exploitation chains, a third verifies impact — and they negotiate a shared world model to escalate findings in real time.",
    problem:
      "Manual penetration testing doesn't scale with the rate of modern deployments, and rule-based scanners drown teams in false positives. Security reviews happen too late in the cycle to influence architecture, and findings arrive as static PDFs that nobody reads.",
    approach:
      "We modeled the engagement as a multi-agent planning problem. A coordinator agent maintains a live attack graph; specialist agents propose next steps grounded in the current graph state. We constrained the agents with a formal capability budget and required verifiable proof of impact before promoting any finding, which eliminated the hallucinated exploit chains that plague naive LLM-driven security tools.",
    outcome:
      "In a closed beta across 14 production codebases, Monkeyclaw surfaced 3 critical privilege-escalation paths that had survived two prior external audits. Mean time to first valid finding dropped from 4 days (human red team) to 38 minutes.",
    stack: ["TypeScript", "Python", "LangGraph", "Rust", "Postgres", "Kubernetes"],
    year: "2025",
    role: "Founder & Lead Engineer",
    accent: "blue-strong",
  },
  {
    slug: "velox",
    index: "02",
    title: "VELOX",
    subtitle: "Agent-First Browser",
    tagline: "A browser where agents are first-class citizens, not extensions.",
    description:
      "Velox rebuilds the browser around the assumption that the primary user is sometimes a human and sometimes an agent acting on her behalf. Pages, tabs, history, and forms all expose a structured agent interface alongside the human DOM. Agents can read, navigate, and act without reverse-engineering visual layout.",
    problem:
      "Existing automation stacks treat the browser as a screen to be scraped. Agents fight anti-bot systems, break on minor UI changes, and can't access the rich semantic structure that the browser already has internally. Browser extensions are a poor compromise — they live in the same untrusted context as the page.",
    approach:
      "We forked the Chromium content layer and exposed a stable, capability-scoped agent API at the browser-process level. Agents authenticate via signed capabilities, not cookies. The rendering pipeline remains untouched for human users, but every DOM mutation emits a structured event that subscribed agents can react to deterministically.",
    outcome:
      "Velox ran 12x more agent workflows per hour than a Playwright cluster on identical hardware, with a 94% reduction in flaky-run rate. Three design partners have replaced their internal RPA stacks with Velox-based agents.",
    stack: ["C++", "Chromium", "TypeScript", "WebGPU", "SQLite"],
    year: "2024",
    role: "Co-Founder & CTO",
    accent: "blue-low",
  },
  {
    slug: "flowe",
    index: "03",
    title: "FLOWE",
    subtitle: "Intelligent Student App",
    tagline: "A tutor that remembers what you forgot and why.",
    description:
      "Flowe is a learning companion that builds a per-concept mastery graph for each student and uses it to schedule reviews, surface prerequisites, and generate practice at the exact difficulty that produces growth. The interface is deliberately calm — no streaks, no leaderboards, no dark patterns.",
    problem:
      "Adaptive learning systems have been promising personalized education for two decades and delivering slightly worse flashcards. Most of them optimize for engagement metrics that correlate with retention but anti-correlate with learning. Students end up studying more and remembering less.",
    approach:
      "We replaced the engagement loop with a mastery loop. Every interaction updates a Bayesian knowledge tracer; the scheduler is a constrained optimizer that maximizes expected long-term retention subject to a daily time budget. We open-sourced the mastery model so independent researchers could audit it.",
    outcome:
      "In a 1,200-student pilot with a state community college, students using Flowe for 18 minutes per week outperformed the control group by 0.41 standard deviations on end-of-term assessments. Retention-to-next-term improved by 22%.",
    stack: ["TypeScript", "React Native", "FastAPI", "PyTorch", "Postgres"],
    year: "2023",
    role: "Founder & CEO",
    accent: "blue-flow",
  },
  {
    slug: "nexarad",
    index: "04",
    title: "NEXARAD",
    subtitle: "Medical Imaging AI",
    tagline: "Diagnostic-grade chest CT triage in under 90 seconds.",
    description:
      "Nexarad is a regulatory-cleared AI assistant for radiologists that triages chest CTs for actionable findings — pulmonary embolism, aortic dissection, intracranial hemorrhage extension — and surfaces them at the top of the worklist before the radiologist opens the study.",
    problem:
      "Triage in radiology is a queueing problem with life-and-death latency. A missed dissection on a routine scan might not be read for 45 minutes. Existing CAD systems produce noisy annotations that radiologists dismiss as background chatter, so they get tuned out exactly when they're needed most.",
    approach:
      "We trained on 2.4 million de-identified studies across 38 institutions, with strict site-level holdouts to prevent shortcut learning. The model produces a calibrated probability per finding plus a saliency map that is only shown when the model's confidence crosses a clinically-tuned threshold — high precision, low noise. Every prediction includes an uncertainty estimate so the worklist can route ambiguous cases to senior readers.",
    outcome:
      "Cleared by the FDA in 11 months. In prospective deployment across 9 hospitals, mean time to flagging a true-positive critical finding dropped from 27 minutes to 1.4 minutes. Missed-critical-finding rate fell by 71%.",
    stack: ["PyTorch", "C++", "CUDA", "DICOM", "Kubernetes", "ONNX"],
    year: "2022",
    role: "Founding ML Engineer",
    accent: "blue-strong",
  },
];

export type ExperienceEntry = {
  company: string;
  role: string;
  period: string;
  location: string;
  summary: string;
  highlights: string[];
  stack: string[];
};

export const experience: ExperienceEntry[] = [
  {
    company: "Independent",
    role: "Founder & Engineer",
    period: "2023 — Present",
    location: "Los Angeles, CA",
    summary:
      "Building AI-native products at the intersection of multi-agent systems and real-world deployment. Currently leading Monkeyclaw and advising two seed-stage AI companies on agent architecture and evals.",
    highlights: [
      "Designed and shipped a multi-agent security platform from zero to closed beta in 9 months.",
      "Advised portfolio companies on agent eval methodology, reducing hallucination-related incidents by 60%.",
      "Published an open-source agent capability framework adopted by 800+ developers in the first quarter.",
    ],
    stack: ["TypeScript", "Python", "LangGraph", "Rust", "Kubernetes"],
  },
  {
    company: "Nexarad (Acquired)",
    role: "Founding ML Engineer",
    period: "2021 — 2023",
    location: "Santa Cruz, CA",
    summary:
      "Joined as the second engineer and built the core inference pipeline for a regulatory-cleared medical imaging triage system. Took the model from research prototype to FDA submission.",
    highlights: [
      "Architected the inference pipeline serving 90-second median time-to-triage at 99.95% uptime.",
      "Led the data engineering effort to ingest and de-identify 2.4M studies across 38 institutions.",
      "Owned the regulatory ML documentation package that secured FDA 510(k) clearance in 11 months.",
    ],
    stack: ["PyTorch", "CUDA", "C++", "DICOM", "Kubernetes"],
  },
  {
    company: "Flowe",
    role: "Founder & CEO",
    period: "2022 — 2023",
    location: "Remote",
    summary:
      "Founded and led an adaptive learning company serving community college students. Built the mastery model, raised a pre-seed, and ran a 1,200-student pilot that outperformed control by 0.41σ.",
    highlights: [
      "Raised a $1.8M pre-seed from education-focused investors.",
      "Designed and ran a 1,200-student randomized pilot with a state community college system.",
      "Open-sourced the Bayesian mastery model, which has since been forked by 6 university research labs.",
    ],
    stack: ["TypeScript", "React Native", "FastAPI", "PyTorch"],
  },
  {
    company: "Vanta (Early Engineer)",
    role: "Software Engineer, Platform",
    period: "2019 — 2021",
    location: "San Francisco, CA",
    summary:
      "Joined Vanta pre-Series A as one of the first platform engineers. Built the connector framework that powers Vanta's continuous compliance monitoring across 200+ integrations.",
    highlights: [
      "Designed the integration SDK used by every third-party connector in the Vanta marketplace.",
      "Reduced p99 connector sync latency by 73% through a rewrite of the connection scheduler.",
      "Mentored four interns, three of whom converted to full-time offers.",
    ],
    stack: ["TypeScript", "Node.js", "Postgres", "AWS"],
  },
];

export const bio = {
  name: "Eliezer Rappeport",
  taglineParts: ["Engineer", "AI Builder", "Founder"],
  bodyParagraphs: [
    "I build at the intersection of engineering and intelligence. Exploring multi-agent systems, humane AI, and tools that create real impact.",
    "I care about multi-agent systems, humane AI, and tools that compound impact rather than extract attention. Most of my work sits in the awkward space between research and production — taking ideas that work in a paper and making them work under a pager.",
    "I'm currently based between Los Angeles and Santa Cruz, splitting time between independent founder work and advising a small number of AI companies on agent architecture and evaluation.",
  ],
  location: {
    title: "Based in California",
    subtitle: "Building from Los Angeles and Santa Cruz",
    coordinates: "34.0522° N, 118.2437° W",
  },
  socials: [
    { label: "GitHub", href: "https://github.com", handle: "@eliezer" },
    { label: "LinkedIn", href: "https://linkedin.com", handle: "/in/eliezerrappeport" },
    { label: "X", href: "https://x.com", handle: "@erappeport" },
    { label: "Email", href: "mailto:hello@eliezer.example", handle: "hello@eliezer.example" },
  ],
  email: "hello@eliezer.example",
};

export const nav = {
  brand: "ER",
  fullName: "ELIEZER RAPPEPORT",
  links: [
    { label: "Projects", href: "#projects" },
    { label: "Experience", href: "#experience" },
    { label: "About", href: "#about" },
  ],
  cta: { label: "Get In Touch", href: "#contact" },
};

export const sectionAnchors = [
  { label: "PROJECTS", subtitle: "Ideas into impact", href: "#projects" },
  { label: "EXPERIENCE", subtitle: "Engineering that scales", href: "#experience" },
  { label: "ABOUT", subtitle: "Purpose & vision", href: "#about" },
];
