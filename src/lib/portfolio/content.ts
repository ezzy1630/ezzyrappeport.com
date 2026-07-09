type ProjectCardPersonality = "monkeyclaw" | "velox" | "flowe" | "nexarad" | "etch";

export type ProjectMediaAsset = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
};

export type ProjectMedia = {
  cover: ProjectMediaAsset;
  gallery?: ProjectMediaAsset[];
};

export type ProjectLink = {
  kind: "source" | "site" | "releases";
  label: string;
  href: string;
};

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
  personality: ProjectCardPersonality;
  status: string;
  proof: string;
  cautionLabel?: string;
  media: ProjectMedia;
  verifiedLinks: ProjectLink[];
};

export const projects: Project[] = [
  {
    slug: "monkeyclaw",
    index: "01",
    title: "MONKEYCLAW",
    subtitle: "Multi-Agent Security System",
    tagline: "Continuous red, blue, and purple-team security testing for agent runtimes.",
    description:
      "MonkeyClaw is a continuous security agent for NemoClaw and OpenClaw deployments. It generates attack ideas, executes them against live or mocked sandboxes, judges the result, reproduces confirmed findings, proposes patches, and checks that the defense was observable in telemetry instead of silently passing.",
    problem:
      "Agent runtimes can read source, run shell commands, call tools, and touch the network. A one-time audit cannot keep up with changing prompts, skills, permissions, and sandbox behavior, and a blocked attack is still risky if no detection fired.",
    approach:
      "I built a five-stage loop: red-team ideation across 18 attack-surface zones, programmatic and semantic judging, repro and root-cause analysis, blue-team patch generation, and purple-team detection-as-pass verification. The demo path runs with zero model credentials against a planted victim.",
    outcome:
      "The repo now includes a working CLI, seeded demo, live dashboard, tiered verifier gates, attack coverage tracking, Telegram alert paths, and a growing regression model that treats silent controls as incomplete defenses.",
    stack: ["Python", "NVIDIA Nemotron", "SQLite", "FastAPI", "pytest", "OpenClaw"],
    year: "2026",
    role: "Lead Engineer & Contributor",
    accent: "blue-strong",
    personality: "monkeyclaw",
    status: "Public repository · working demo",
    proof: "18 seeded attack zones · 8 verifier gates · 1,051 tracked test functions",
    cautionLabel: "Multi-contributor project",
    media: {
      cover: {
        src: "/projects/monkeyclaw/logo.webp",
        alt: "Black MonkeyClaw monkey-and-wordmark logo",
        width: 1254,
        height: 1254,
      },
      gallery: [
        {
          src: "/projects/monkeyclaw/architecture.svg",
          alt: "MonkeyClaw red, judge, repro, blue, and purple-team architecture loop",
          width: 920,
          height: 472,
          caption: "The continuous security loop across 18 attack-surface zones.",
        },
        {
          src: "/projects/monkeyclaw/detection-as-pass.svg",
          alt: "Detection-as-pass prevention and observability matrix",
          width: 440,
          height: 318,
          caption: "A defense passes only when it blocks the attack and produces evidence.",
        },
      ],
    },
    verifiedLinks: [
      {
        kind: "source",
        label: "View source",
        href: "https://github.com/justin06lee/monkeyclaw",
      },
    ],
  },
  {
    slug: "velox",
    index: "02",
    title: "VELOX",
    subtitle: "Agent-First Browser",
    tagline: "A Chromium browser where research agents work in visible tabs.",
    description:
      "Velox is an Electron and Chromium-based desktop browser that turns web research into an inspectable agent workspace. It predicts intent while you type, launches bounded research sessions, opens real pages in visible tabs, and synthesizes cited answers into a visual canvas.",
    problem:
      "Most AI search tools hide the browsing process and only begin once a full query is submitted. Browser automation is also brittle when the user cannot see what the agent opened, read, skipped, or cited.",
    approach:
      "I built a desktop shell, React browser chrome, Express/WebSocket agent server, Playwright research runtime, source shelf, export path, and no-key demo mode. The research flow streams session state as agents navigate, capture evidence, and hand off to a synthesis agent.",
    outcome:
      "The local app ships as a hackathon-ready alpha with predictive intent, visible agent tabs, live browsing evidence, cited answer generation, Markdown/JSON export, persisted session snapshots, and a one-command macOS boot path.",
    stack: ["Electron", "React", "TypeScript", "Express", "WebSocket", "Playwright"],
    year: "2026",
    role: "Co-Founder & CTO",
    accent: "blue-low",
    personality: "velox",
    status: "Public alpha · v0.3.0",
    proof: "Visible agent tabs · no-key demo · Markdown and JSON export",
    media: {
      cover: {
        src: "/projects/velox/landing.webp",
        alt: "Velox browser new-tab page with its predictive research field",
        width: 3024,
        height: 1964,
      },
      gallery: [
        {
          src: "/projects/velox/predicting.webp",
          alt: "Velox predicting research intent while a query is typed",
          width: 3024,
          height: 1964,
          caption: "Bounded intent prediction starts before the query is submitted.",
        },
        {
          src: "/projects/velox/logo.svg",
          alt: "Velox predictive-cursor wordmark",
          width: 420,
          height: 112,
        },
      ],
    },
    verifiedLinks: [
      {
        kind: "source",
        label: "View source",
        href: "https://github.com/ezzy1630/Velox",
      },
      {
        kind: "releases",
        label: "View releases",
        href: "https://github.com/ezzy1630/Velox/releases",
      },
    ],
  },
  {
    slug: "flowe",
    index: "03",
    title: "FLOWE",
    subtitle: "Intelligent Student App",
    tagline: "A calm operating system for tasks, focus, Canvas, and daily planning.",
    description:
      "FlowE is a SwiftUI productivity app for students and professionals. It combines task management, focus sessions, Canvas LMS sync, Apple Calendar integration, AI-driven planning, and lightweight gamification on top of a real-time Convex backend.",
    problem:
      "School work, personal tasks, calendars, and focus routines usually live in separate tools. Students need one place that understands course context, deadlines, energy, and what can realistically fit into a day.",
    approach:
      "I built the iOS app with MVVM, dependency injection, offline mutation retry, Clerk auth, Canvas REST and ICS ingestion, EventKit, push notifications, analytics, and Convex schema/functions for tasks, events, Canvas data, wallets, and sync.",
    outcome:
      "The repo has a generated Xcode project, production-shaped config boundaries, local Convex workflows, Canvas sync validation, authentication paths, and simulator build commands for the current iOS app.",
    stack: ["SwiftUI", "Convex", "TypeScript", "Clerk", "Canvas LMS", "EventKit"],
    year: "2026",
    role: "Founder & CEO",
    accent: "blue-flow",
    personality: "flowe",
    status: "Private build · public site",
    proof: "SwiftUI client · Convex backend · Canvas sync · offline retry",
    cautionLabel: "Campaign visualization",
    media: {
      cover: {
        src: "/projects/flowe/brain-dump-campaign.webp",
        alt: "FlowE campaign visualization of the Brain Dump planning interface",
        width: 1080,
        height: 1920,
        caption: "Project-authored campaign visualization, not a raw runtime capture.",
      },
      gallery: [
        {
          src: "/projects/flowe/structured-plan-campaign.webp",
          alt: "FlowE campaign visualization of a course-aware structured plan",
          width: 1080,
          height: 1920,
          caption: "A course-aware plan composed from deadlines and study context.",
        },
        {
          src: "/projects/flowe/app-icon.webp",
          alt: "FlowE app icon",
          width: 1024,
          height: 1024,
        },
      ],
    },
    verifiedLinks: [
      {
        kind: "site",
        label: "Visit site",
        href: "https://flowe.cc",
      },
    ],
  },
  {
    slug: "nexarad",
    index: "04",
    title: "NEXARAD",
    subtitle: "Evidence-Linked Radiology",
    tagline: "Evidence-linked imaging workflows with strict non-clinical demo boundaries.",
    description:
      "NexaRad is a production-shaped foundation for radiology workflow software: backend-owned auth, tenant isolation, local DICOM services, object storage, structured findings, verifier-gated reports, and AWS-first infrastructure boundaries.",
    problem:
      "Medical imaging demos often skip the hard parts: PHI boundaries, DICOM plumbing, tenant isolation, object storage, report provenance, and clear labeling when something is research-only rather than clinical software.",
    approach:
      "I built a local stack with web, API, OHIF, Orthanc, MinIO, Alembic migrations, seeded non-PHI studies, synthetic upload smoke tests, demo/research safety defaults, and a rule that browser clients only call the NexaRad API.",
    outcome:
      "The founder-ready walkthrough can boot the full local demo, seed visible research-only studies and draft reports, rehearse uploads, and keep AI providers and PHI disabled by default.",
    stack: ["Next.js", "FastAPI", "DICOM", "OHIF", "Orthanc", "MinIO"],
    year: "2026",
    role: "Founder & Engineer",
    accent: "blue-strong",
    personality: "nexarad",
    status: "Private build · non-clinical research demo",
    proof: "Synthetic DICOM demo · PHI disabled · external AI off by default",
    cautionLabel: "Demo / Research / Not for Clinical Use",
    media: {
      cover: {
        src: "/projects/nexarad/research-overview.webp",
        alt: "NexaRad research overview for evidence-linked chest X-ray review",
        width: 1200,
        height: 630,
        caption: "Public demo posture with explicit non-clinical boundaries.",
      },
      gallery: [
        {
          src: "/projects/nexarad/app-icon.webp",
          alt: "NexaRad radiology app icon",
          width: 512,
          height: 512,
        },
        {
          src: "/projects/nexarad/synthetic-cxr-evidence.webp",
          alt: "Synthetic non-clinical chest X-ray evidence fixture",
          width: 160,
          height: 120,
          caption: "Synthetic validation fixture; no patient data or clinical-performance claim.",
        },
      ],
    },
    verifiedLinks: [
      {
        kind: "site",
        label: "Visit research site",
        href: "https://nexarad.org",
      },
    ],
  },
  {
    slug: "etch",
    index: "05",
    title: "ETCH",
    subtitle: "Verification-First Hardware Design",
    tagline: "From natural-language intent to RTL evidence, gates, and proof dossiers.",
    description:
      "Etch is a local hardware-design cockpit that turns a natural-language requirement into a typed design spec, candidate RTL, independent verification artifacts, EDA gate results, correctness-first ranking, physical readiness records, and a proof dossier.",
    problem:
      "AI can generate RTL, but generation alone does not prove a chip design should be trusted. Hardware workflows need durable evidence: what passed, what failed, which tools were missing, and which claims are still out of bounds.",
    approach:
      "I built a FastAPI backend, React/Vite workbench, Electron shell, file-backed run workspace, deterministic FIFO demo, optional LLM proposal path, simulation/formal/synthesis adapters, claims ledger, and status-aware cockpit views for trust and diagnostics.",
    outcome:
      "The saved vertical slice carries a synchronous FIFO through typed specs, three candidates, independent oracle artifacts, simulation and bounded-formal gates, Yosys metrics, explicit missing-tool states, and Markdown/JSON proof dossiers. Physical signoff remains pending.",
    stack: ["Python", "FastAPI", "React", "Electron", "Yosys", "Verilator"],
    year: "2026",
    role: "Founder & Engineer",
    accent: "blue-medium",
    personality: "etch",
    status: "Public repository · local vertical slice",
    proof: "Saved FIFO run · simulation pass · bounded-formal pass · signoff pending",
    cautionLabel: "Physical signoff pending",
    media: {
      cover: {
        src: "/projects/etch/correctness-ranking.webp",
        alt: "Etch correctness-first ranking of three FIFO candidates",
        width: 1920,
        height: 1080,
        caption: "Candidate A wins on verified correctness and area among valid candidates.",
      },
      gallery: [
        {
          src: "/projects/etch/intent-ui.webp",
          alt: "Etch interface accepting a natural-language synchronous FIFO requirement",
          width: 1920,
          height: 1080,
          caption: "A typed hardware-design run begins from a bounded natural-language intent.",
        },
        {
          src: "/projects/etch/physical-proxy.webp",
          alt: "Etch physical proxy evidence with signoff explicitly marked pending",
          width: 1920,
          height: 1080,
          caption: "Physical evidence stays separate from foundry signoff claims.",
        },
      ],
    },
    verifiedLinks: [
      {
        kind: "source",
        label: "View source",
        href: "https://github.com/ezzy1630/Etch",
      },
    ],
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
    { label: "GitHub", href: "https://github.com/ezzyrappeport", handle: "@ezzyrappeport" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/eliezerrappeport", handle: "/in/eliezerrappeport" },
    { label: "X", href: "https://x.com/ezzyrappeport", handle: "@ezzyrappeport" },
    { label: "Email", href: "mailto:hello@eliezerrappeport.com", handle: "hello@eliezerrappeport.com" },
  ],
  email: "hello@eliezerrappeport.com",
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
