import { portfolioIdentity } from "./identity";

export type ProjectSlug =
  | "monkeyclaw"
  | "etch"
  | "flowe"
  | "velox"
  | "argyph"
  | "nexarad"
  | "mathpilot";

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

export type ProjectMediaPresentation = {
  aspectRatio: string;
  fit: "contain" | "cover";
  scale: string;
  position: string;
  offsetY: string;
  wellColor: string;
};

export type ProjectLink = {
  kind: "source" | "site" | "releases";
  label: string;
  href: string;
};

export type Project = {
  slug: ProjectSlug;
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
  personality: ProjectSlug;
  status: string;
  proof: string;
  cautionLabel?: string;
  media: ProjectMedia;
  mediaPresentation: ProjectMediaPresentation;
  verifiedLinks: ProjectLink[];
};

const projectRecords: Omit<Project, "mediaPresentation">[] = [
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
    index: "04",
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
        src: "/projects/velox/velox-icon.png",
        alt: "Velox application icon on a pale background",
        width: 1024,
        height: 1024,
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
        src: "/projects/flowe/app-icon.png",
        alt: "FlowE app icon",
        width: 1024,
        height: 1024,
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
    index: "06",
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
    status: "Research foundation · non-clinical demo",
    proof: "Synthetic DICOM demo · PHI disabled · external AI off by default",
    cautionLabel: "Demo / Research / Not for Clinical Use",
    media: {
      cover: {
        src: "/projects/nexarad/app-icon.png",
        alt: "NexaRad radiology app icon",
        width: 512,
        height: 512,
      },
      gallery: [
        {
          src: "/projects/nexarad/app-icon.png",
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
    index: "02",
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
        src: "/projects/etch/logo.svg",
        alt: "Etch verification-first hardware design logo",
        width: 1024,
        height: 1024,
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
  {
    slug: "argyph",
    index: "05",
    title: "ARGYPH",
    subtitle: "Local-First Code Intelligence",
    tagline: "One read-only MCP server for grep, symbols, semantic search, and repo packing.",
    description:
      "Argyph is a local binary that gives coding agents bounded codebase context without cloud accounts or API keys. Its ask-first retrieval router combines text search, a tree-sitter symbol graph, semantic search, and token-budgeted repository packing behind one MCP endpoint.",
    problem:
      "Giving an agent useful repository context often means wiring together multiple servers, processes, and cloud services. That increases setup cost and can move proprietary source outside the developer's machine.",
    approach:
      "I built a tiered Rust index that becomes useful immediately: file inventory first, symbol and structural indexes next, then local embeddings in the background. Queries return bounded spans and disclose index coverage so the caller knows what evidence was available.",
    outcome:
      "Argyph ships as a read-only MCP server and CLI through npm, crates.io, Homebrew, and release binaries, with incremental indexing and nineteen tools across retrieval, symbols, packing, and local memory.",
    stack: ["Rust", "MCP", "Tree-sitter", "LanceDB", "ONNX Runtime", "SQLite"],
    year: "2026",
    role: "Creator & Engineer",
    accent: "blue-medium",
    personality: "argyph",
    status: "Public release · v1.0.4",
    proof: "19 read-only tools · tiered local index · npm, crates.io, and Homebrew",
    media: {
      cover: {
        src: "/projects/argyph/social-card.png",
        alt: "Argyph local-first code intelligence social card",
        width: 1280,
        height: 640,
      },
    },
    verifiedLinks: [
      { kind: "source", label: "View source", href: "https://github.com/Ezzy1630/argyph" },
      { kind: "releases", label: "View releases", href: "https://github.com/Ezzy1630/argyph/releases" },
    ],
  },
  {
    slug: "mathpilot",
    index: "07",
    title: "MATHPILOT",
    subtitle: "Private Calculus Mastery Engine",
    tagline: "A local-first macOS study cockpit for Calculus 1 and 2.",
    description:
      "MathPilot diagnoses a learner's level, tracks mastery on a prerequisite graph, recommends the next useful step, and keeps progress on the Mac. Practice, cumulative review, homework help, symbolic checking, and optional Codex coaching live in one native desktop workflow.",
    problem:
      "Calculus learners are often forced to assemble videos, generic chat, homework tools, and spaced repetition themselves. Those tools rarely share a mastery model or preserve a private, durable learning history.",
    approach:
      "I combined a Tauri desktop shell, React interface, SQLite persistence, FSRS review scheduling, MathLive typesetting, bundled Python and SymPy, Vision OCR, and deterministic offline fallbacks. Optional Codex features use the local CLI rather than an in-app API key.",
    outcome:
      "The repository includes more than 1,080 curated problems, a native macOS build, diagnostic and practice loops, mastery and review systems, local homework analysis, and automated unit and end-to-end coverage.",
    stack: ["Tauri", "React", "TypeScript", "SQLite", "SymPy", "FSRS"],
    year: "2026",
    role: "Creator & Engineer",
    accent: "blue-flow",
    personality: "mathpilot",
    status: "Public repository · macOS app",
    proof: "1,080+ curated problems · 171 unit tests · 15 end-to-end tests",
    media: {
      cover: {
        src: "/projects/mathpilot/mathpilot-icon-512.png",
        alt: "MathPilot integral and mastery-curve app icon",
        width: 512,
        height: 512,
      },
    },
    verifiedLinks: [
      { kind: "source", label: "View source", href: "https://github.com/ezzy1630/MathPilot" },
    ],
  },
];

export const projectMediaPresentation = {
  monkeyclaw: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "1",
    position: "center",
    offsetY: "0%",
    wellColor: "#dceceb",
  },
  etch: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "1",
    position: "center",
    offsetY: "0%",
    wellColor: "#030509",
  },
  flowe: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "1",
    position: "center",
    offsetY: "0%",
    wellColor: "#080b11",
  },
  velox: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "1",
    position: "center",
    offsetY: "0%",
    wellColor: "#ffffff",
  },
  argyph: {
    aspectRatio: "2 / 1",
    fit: "cover",
    scale: "1",
    position: "center",
    offsetY: "0%",
    wellColor: "#0a1424",
  },
  nexarad: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "1",
    position: "center",
    offsetY: "0%",
    wellColor: "#e4eef4",
  },
  mathpilot: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "1",
    position: "center 44%",
    offsetY: "-3%",
    wellColor: "#eaf1f7",
  },
} satisfies Record<ProjectSlug, ProjectMediaPresentation>;

export const projectOrder: ProjectSlug[] = ["monkeyclaw", "etch", "flowe", "velox", "argyph", "nexarad", "mathpilot"];

export const projects: Project[] = projectOrder.map((slug) => {
  const project = projectRecords.find((candidate) => candidate.slug === slug);
  if (!project) throw new Error(`Missing portfolio project: ${slug}`);
  const mediaPresentation = projectMediaPresentation[slug];
  if (!mediaPresentation) throw new Error(`Missing media presentation: ${slug}`);
  return { ...project, mediaPresentation };
});

export const bio = {
  name: portfolioIdentity.name,
  taglineParts: ["Software Engineer", "AI Systems", "Founder"],
  bodyParagraphs: [
    "I build AI systems, developer tools, and product software—from multi-agent security to intelligent student workflows.",
    "I care about multi-agent systems, humane AI, and tools that compound impact rather than extract attention. My work lives between research and production: turning promising ideas into inspectable, dependable software.",
    "I'm based between Los Angeles and Santa Cruz, building across agent security, code intelligence, education, radiology research, and hardware design.",
  ],
  location: {
    title: "Based in California",
    subtitle: "Los Angeles ↔ Santa Cruz",
    status: "Open to software and AI opportunities",
  },
  socials: [
    { label: "GitHub", href: "https://github.com/ezzy1630", handle: "@ezzy1630" },
    { label: "LinkedIn", href: "https://linkedin.com/in/ezzy-rappeport", handle: "/in/ezzy-rappeport" },
    { label: "X", href: "https://x.com/ezzy1630", handle: "@ezzy1630" },
    { label: "Instagram", href: "https://instagram.com/ezzy1630", handle: "@ezzy1630" },
    { label: "Email", href: `mailto:${portfolioIdentity.email}`, handle: portfolioIdentity.email },
  ],
  email: portfolioIdentity.email,
};

export const nav = {
  brand: "ER",
  fullName: portfolioIdentity.displayName,
  links: [
    { label: "Projects", href: "#projects" },
    { label: "About", href: "#about" },
  ],
  cta: { label: "Get In Touch", href: "#contact" },
};

export const sectionAnchors = [
  { label: "PROJECTS", subtitle: "Ideas into impact", href: "#projects" },
  { label: "ABOUT", subtitle: "Purpose & vision", href: "#about" },
];
