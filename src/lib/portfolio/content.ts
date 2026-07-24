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

export type ProjectAccent = "blue-strong" | "blue-medium" | "blue-low" | "blue-flow";

export type DiagramNodeKind = "stage" | "gate" | "store" | "io";

export type DiagramNode = {
  id: string;
  label: string;
  /** SVG user-space origin for the node shell. */
  x: number;
  y: number;
  kind?: DiagramNodeKind;
  detail?: string;
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
  emphasis?: boolean;
};

export type ProjectDiagram = {
  title: string;
  caption?: string;
  width?: number;
  height?: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
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
  /** Sticky rail states: Problem / System / Evidence / Outcome. */
  system: string;
  evidence: string;
  constraints: string;
  stack: string[];
  year: string;
  role: string;
  accent: ProjectAccent;
  personality: ProjectSlug;
  status: string;
  proof: string;
  cautionLabel?: string;
  media: ProjectMedia;
  mediaPresentation: ProjectMediaPresentation;
  verifiedLinks: ProjectLink[];
  diagram: ProjectDiagram;
};

const projectRecords: Omit<Project, "mediaPresentation" | "diagram">[] = [
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
      "The repo ships a working CLI, seeded demo, live multi-panel dashboard on :8787, eight verifier gates, attack coverage tracking, Telegram alert paths, and a regression model that treats silent controls as incomplete defenses.",
    system:
      "Live multi-panel dashboard over an 18-zone attack map. Red to judge to repro to blue to purple loop with detection-as-pass gates.",
    evidence:
      "Attack-blocked / detection-fired matrix, zero-credential demo path, 8 verifier gates, 1,051 tracked test functions, README badge coverage for 18 zones.",
    constraints:
      "Multi-contributor project. Demo runs without model credentials; live LLM paths remain optional and environment-gated.",
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
      "The local app ships as a hackathon-ready alpha (v0.3.0) with predictive intent, visible agent tabs, live browsing evidence, cited answer generation, Markdown/JSON export, persisted session snapshots, and a one-command macOS boot path.",
    system:
      "Predictive omnibox to visible agent tabs to research canvas. Cerebras × Gemma 4 hackathon origin for low-latency drafting.",
    evidence:
      "Real browser UI as the hero surface; Playwright research runtime; no-key demo via DEMO_MODE_ENABLED; Markdown and JSON export endpoints.",
    constraints:
      "Product still evolving; agent actions remain user-initiated and inspectable. Live tab takeover is still listed as future work.",
    stack: ["Electron", "React", "TypeScript", "Express", "WebSocket", "Playwright"],
    year: "2026",
    role: "Co-Founder & CTO",
    accent: "blue-low",
    personality: "velox",
    status: "Public alpha · v0.3.0",
    proof: "Visible agent tabs · no-key demo · Markdown and JSON export",
    media: {
      cover: {
        src: "/projects/velox/velox-mark.svg",
        alt: "Velox predictive cursor mark",
        width: 96,
        height: 96,
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
      "FlowE is a SwiftUI productivity app for adults managing coursework and professional schedules. It combines task management, focus sessions, Canvas LMS sync, Apple Calendar integration, AI-driven planning, and lightweight gamification on top of a real-time Convex backend.",
    problem:
      "Coursework, personal tasks, calendars, and focus routines usually live in separate tools. People need one place that understands course context, deadlines, energy, and what can realistically fit into a day.",
    approach:
      "I built the iOS app with MVVM, dependency injection, offline mutation retry, Clerk auth, Canvas REST and ICS ingestion, EventKit, push notifications, analytics, and Convex schema/functions for tasks, events, Canvas data, wallets, and sync.",
    outcome:
      "The repo has a generated Xcode project, production-shaped config boundaries, local Convex workflows, Canvas sync validation, authentication paths, widgets and Live Activities targets, and simulator build commands for the current iOS app.",
    system:
      "Brain dump to structured plan to focus loop, surfaced through real iPhone frames and campaign footage.",
    evidence:
      "Native mobile frames and existing campaign videos where real footage exists; muted loops only. Canvas OAuth stays disabled at launch while ICS/REST sync paths ship.",
    constraints:
      "Calm operating system for tasks and focus, not a generic productivity collage.",
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
        src: "/projects/flowe/app-icon.webp",
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
      "The founder-ready walkthrough can boot the full local demo (`make up`), seed visible research-only studies and draft reports, rehearse uploads, and keep AI providers and PHI disabled by default (`ALLOW_PHI=false`).",
    system:
      "OHIF/product frame with synthetic DICOM evidence and report provenance across Orthanc and MinIO.",
    evidence:
      "Demo / Research / Not for Clinical Use labels stay visible near every relevant claim. Idempotent `make seed` path and synthetic CXR fixtures.",
    constraints:
      "Not for clinical use. Synthetic evidence only; no diagnostic claims.",
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
        src: "/projects/nexarad/app-icon.webp",
        alt: "NexaRad radiology app icon",
        width: 512,
        height: 512,
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
      "The saved vertical slice carries a synchronous FIFO through typed specs, three candidates, independent oracle artifacts, simulation and bounded-formal gates, Yosys 0.66 metrics, explicit missing-tool states, and Markdown/JSON proof dossiers. Physical signoff remains pending.",
    system:
      "FIFO to arbiter to AXI-lite to DMA to cache to RV32I to accelerator to SoC ladder with verification gates.",
    evidence:
      "Saved FIFO run dossier, Yosys 0.66 synth metrics, sim and bounded-formal pass records, and verification-gate sequence as the architecture story.",
    constraints:
      "Hardware proof is staged; claims track the verified ladder, not aspirational silicon.",
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
    system:
      "Three-tier local index behind one ask-first MCP endpoint. Lead claim: stop wiring six MCP servers.",
    evidence:
      "Tier-zero indexing under a second, benchmark evidence, 19 read-only tools (`ask` through `memory_forget`) across npm/crates/Homebrew.",
    constraints:
      "Local-first read-only tools; no write-path claims without explicit user action. `locate_smart` stays opt-in and disabled by default.",
    stack: ["Rust", "MCP", "Tree-sitter", "LanceDB", "ONNX Runtime", "SQLite"],
    year: "2026",
    role: "Creator & Engineer",
    accent: "blue-medium",
    personality: "argyph",
    status: "Public release · v1.0.4",
    proof: "19 read-only tools · tiered local index · npm, crates.io, and Homebrew",
    media: {
      cover: {
        src: "/projects/argyph/argyph-identity.webp",
        alt: "Argyph local-first code intelligence identity artwork",
        width: 1254,
        height: 1254,
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
      "The repository includes 613 curated Calc 1/2 problems (production banks around 600-760 per course), a native macOS build, diagnostic and practice loops, mastery and review systems, local homework analysis, ~246 unit tests, and ~26 end-to-end tests across 7 Playwright specs.",
    system:
      "Mastery graph plus diagnostic loop plus FSRS review plus symbolic checking in one native Mac cockpit.",
    evidence:
      "613 curated problems, ~246 unit tests, ~26 end-to-end tests, local SymPy checking, optional Codex via local CLI.",
    constraints:
      "Private local-first learning history; optional Codex uses local CLI, not an in-app API key.",
    stack: ["Tauri", "React", "TypeScript", "SQLite", "SymPy", "FSRS"],
    year: "2026",
    role: "Creator & Engineer",
    accent: "blue-flow",
    personality: "mathpilot",
    status: "Public repository · macOS app",
    proof: "613 curated problems · ~246 unit tests · ~26 end-to-end tests",
    media: {
      cover: {
        src: "/projects/mathpilot/app-icon.svg",
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
    scale: "0.72",
    position: "center",
    offsetY: "2%",
    wellColor: "#7ec9c4",
  },
  etch: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "0.86",
    position: "center",
    offsetY: "0%",
    wellColor: "#4a6fb0",
  },
  flowe: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "0.82",
    position: "center",
    offsetY: "0%",
    wellColor: "#3a8fc8",
  },
  velox: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "0.68",
    position: "center",
    offsetY: "0%",
    wellColor: "#6ea0d8",
  },
  argyph: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "0.84",
    position: "center",
    offsetY: "0%",
    wellColor: "#6a78c8",
  },
  nexarad: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "0.8",
    position: "center",
    offsetY: "0%",
    wellColor: "#6b92c8",
  },
  mathpilot: {
    aspectRatio: "1 / 1",
    fit: "contain",
    scale: "0.88",
    position: "center 44%",
    offsetY: "-2%",
    wellColor: "#4f9ad8",
  },
} satisfies Record<ProjectSlug, ProjectMediaPresentation>;

export const projectDiagrams: Record<ProjectSlug, ProjectDiagram> = {
  monkeyclaw: {
    title: "Continuous security loop",
    caption: "Red ideation across 18 zones feeds judge, repro, blue patches, and purple detection-as-pass gates.",
    width: 920,
    height: 360,
    nodes: [
      { id: "red", label: "Red team", x: 36, y: 48, kind: "stage", detail: "18 zones" },
      { id: "judge", label: "Judge", x: 236, y: 48, kind: "gate", detail: "dual axis" },
      { id: "repro", label: "Repro", x: 436, y: 48, kind: "stage", detail: "root cause" },
      { id: "blue", label: "Blue team", x: 636, y: 48, kind: "stage", detail: "8 gates" },
      { id: "purple", label: "Purple team", x: 436, y: 210, kind: "gate", detail: "detect" },
      { id: "dash", label: "Dashboard", x: 236, y: 210, kind: "io", detail: ":8787" },
    ],
    edges: [
      { from: "red", to: "judge", emphasis: true },
      { from: "judge", to: "repro", emphasis: true },
      { from: "repro", to: "blue", emphasis: true },
      { from: "blue", to: "purple", label: "patch" },
      { from: "purple", to: "dash", label: "telemetry" },
      { from: "dash", to: "red", label: "coverage" },
    ],
  },
  etch: {
    title: "Verification-first hardware path",
    caption: "Natural-language intent becomes typed specs, ranked candidates, and a proof dossier with explicit missing-tool states.",
    width: 920,
    height: 320,
    nodes: [
      { id: "intent", label: "Intent", x: 28, y: 120, kind: "io", detail: "NL req" },
      { id: "spec", label: "Typed spec", x: 196, y: 120, kind: "stage" },
      { id: "cands", label: "Candidates", x: 364, y: 120, kind: "stage", detail: "×3 FIFO" },
      { id: "gates", label: "EDA gates", x: 532, y: 120, kind: "gate", detail: "sim/formal" },
      { id: "dossier", label: "Proof dossier", x: 700, y: 120, kind: "store", detail: "MD/JSON" },
    ],
    edges: [
      { from: "intent", to: "spec", emphasis: true },
      { from: "spec", to: "cands", emphasis: true },
      { from: "cands", to: "gates", emphasis: true },
      { from: "gates", to: "dossier", label: "claims" },
    ],
  },
  flowe: {
    title: "Student operating loop",
    caption: "Brain dump becomes a course-aware plan, then a focus loop backed by Convex and Canvas sync.",
    width: 920,
    height: 300,
    nodes: [
      { id: "dump", label: "Brain dump", x: 40, y: 110, kind: "io" },
      { id: "plan", label: "Structured plan", x: 250, y: 110, kind: "stage", detail: "course-aware" },
      { id: "focus", label: "Focus loop", x: 460, y: 110, kind: "stage" },
      { id: "sync", label: "Canvas sync", x: 670, y: 40, kind: "store", detail: "ICS/REST" },
      { id: "convex", label: "Convex", x: 670, y: 180, kind: "store", detail: "realtime" },
    ],
    edges: [
      { from: "dump", to: "plan", emphasis: true },
      { from: "plan", to: "focus", emphasis: true },
      { from: "sync", to: "plan", label: "deadlines" },
      { from: "focus", to: "convex", label: "state" },
      { from: "convex", to: "plan" },
    ],
  },
  velox: {
    title: "Visible research flow",
    caption: "Predictive intent opens real Chromium tabs, then streams evidence into a cited answer canvas.",
    width: 920,
    height: 300,
    nodes: [
      { id: "predict", label: "Predict", x: 36, y: 110, kind: "stage", detail: "omnibox" },
      { id: "tabs", label: "Agent tabs", x: 220, y: 110, kind: "io", detail: "visible" },
      { id: "runtime", label: "Playwright", x: 404, y: 110, kind: "stage", detail: "Chromium" },
      { id: "canvas", label: "Answer canvas", x: 588, y: 110, kind: "store", detail: "citations" },
      { id: "export", label: "Export", x: 772, y: 110, kind: "io", detail: "MD/JSON" },
    ],
    edges: [
      { from: "predict", to: "tabs", emphasis: true },
      { from: "tabs", to: "runtime", emphasis: true },
      { from: "runtime", to: "canvas", emphasis: true },
      { from: "canvas", to: "export", label: "session" },
    ],
  },
  argyph: {
    title: "Ask-first local index",
    caption: "One read-only MCP endpoint over a three-tier index, nineteen tools, and bounded span results.",
    width: 920,
    height: 340,
    nodes: [
      { id: "t0", label: "Tier 0", x: 60, y: 40, kind: "store", detail: "<1s" },
      { id: "t1", label: "Tier 1", x: 60, y: 140, kind: "store", detail: "symbols" },
      { id: "t2", label: "Tier 2", x: 60, y: 240, kind: "store", detail: "embed" },
      { id: "ask", label: "ask router", x: 320, y: 140, kind: "gate", detail: "primary" },
      { id: "tools", label: "19 tools", x: 560, y: 140, kind: "stage", detail: "read-only" },
      { id: "span", label: "Bounded spans", x: 760, y: 140, kind: "io", detail: "coverage" },
    ],
    edges: [
      { from: "t0", to: "ask" },
      { from: "t1", to: "ask", emphasis: true },
      { from: "t2", to: "ask" },
      { from: "ask", to: "tools", emphasis: true },
      { from: "tools", to: "span", label: "evidence" },
    ],
  },
  nexarad: {
    title: "Non-clinical imaging stack",
    caption: "Browser clients call only the NexaRad API. PHI stays off; Orthanc and MinIO hold synthetic evidence.",
    width: 920,
    height: 320,
    nodes: [
      { id: "web", label: "Web app", x: 40, y: 120, kind: "io" },
      { id: "api", label: "NexaRad API", x: 230, y: 120, kind: "gate", detail: "only path" },
      { id: "ohif", label: "OHIF", x: 430, y: 40, kind: "stage" },
      { id: "orthanc", label: "Orthanc", x: 430, y: 200, kind: "store", detail: "DICOM" },
      { id: "minio", label: "MinIO", x: 640, y: 200, kind: "store" },
      { id: "report", label: "Reports", x: 640, y: 40, kind: "store", detail: "provenance" },
    ],
    edges: [
      { from: "web", to: "api", emphasis: true },
      { from: "api", to: "ohif" },
      { from: "api", to: "orthanc", emphasis: true },
      { from: "api", to: "minio" },
      { from: "api", to: "report", label: "draft" },
    ],
  },
  mathpilot: {
    title: "Private mastery cockpit",
    caption: "Diagnostics feed a prerequisite graph, FSRS review, and local SymPy checking on macOS.",
    width: 920,
    height: 300,
    nodes: [
      { id: "diag", label: "Diagnostic", x: 40, y: 110, kind: "io" },
      { id: "graph", label: "Mastery graph", x: 230, y: 110, kind: "store", detail: "prereqs" },
      { id: "practice", label: "Practice", x: 430, y: 110, kind: "stage", detail: "613" },
      { id: "fsrs", label: "FSRS review", x: 630, y: 40, kind: "stage" },
      { id: "sympy", label: "SymPy check", x: 630, y: 180, kind: "gate", detail: "local" },
    ],
    edges: [
      { from: "diag", to: "graph", emphasis: true },
      { from: "graph", to: "practice", emphasis: true },
      { from: "practice", to: "fsrs", label: "schedule" },
      { from: "practice", to: "sympy", label: "verify" },
      { from: "fsrs", to: "graph" },
      { from: "sympy", to: "graph" },
    ],
  },
};

export const projectOrder: ProjectSlug[] = ["monkeyclaw", "etch", "flowe", "velox", "argyph", "nexarad", "mathpilot"];

export const projects: Project[] = projectOrder.map((slug) => {
  const project = projectRecords.find((candidate) => candidate.slug === slug);
  if (!project) throw new Error(`Missing portfolio project: ${slug}`);
  const mediaPresentation = projectMediaPresentation[slug];
  if (!mediaPresentation) throw new Error(`Missing media presentation: ${slug}`);
  const diagram = projectDiagrams[slug];
  if (!diagram) throw new Error(`Missing project diagram: ${slug}`);
  return { ...project, mediaPresentation, diagram };
});

export const bio = {
  name: portfolioIdentity.name,
  taglineParts: ["Software Engineer", "AI Systems", "Founder"],
  heroSentence: "I build AI systems, developer tools, and product software.",
  quoteLines: [
    "I build at the intersection of engineering and intelligence.",
    "Then I stay for the hard part:",
    "making the system trustworthy, useful, and real.",
  ],
  bodyParagraphs: [
    "I build AI systems, developer tools, and product software, from multi-agent security to intelligent student workflows.",
    "I care about multi-agent systems, humane AI, and tools that compound impact rather than extract attention. My work lives between research and production: turning promising ideas into inspectable, dependable software.",
    "I'm based between Los Angeles and Santa Cruz, building across agent security, code intelligence, education, radiology research, and hardware design.",
  ],
  principles: [
    {
      title: "Systems over demos",
      description:
        "I care about the runtime, the failure modes, and the path from a promising prototype to dependable software.",
    },
    {
      title: "Evidence over theater",
      description:
        "The strongest product story is a working system with visible constraints, measured outcomes, and honest boundaries.",
    },
    {
      title: "Human agency first",
      description:
        "AI should make people more capable without making the decisions, provenance, or consequences harder to inspect.",
    },
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
    { label: "Email", href: `mailto:${portfolioIdentity.email}`, handle: portfolioIdentity.emailLabel },
  ],
  email: portfolioIdentity.email,
  emailLabel: portfolioIdentity.emailLabel,
};

/** Homepage project row layout families. */
export type ProjectLayoutFamily = "full-bleed" | "split" | "offset-rail" | "immersive";

export const projectLayoutFamily: Record<ProjectSlug, ProjectLayoutFamily> = {
  monkeyclaw: "split",
  etch: "split",
  flowe: "offset-rail",
  velox: "split",
  argyph: "split",
  nexarad: "offset-rail",
  mathpilot: "offset-rail",
};

export function projectDepthBand(slug: ProjectSlug): "shallow" | "mid" {
  const order = projectOrder.indexOf(slug);
  return order <= 3 ? "shallow" : "mid";
}

/** Shared case mooring depth - matches CASE_MOORING_DEPTH in world-state. */
export function caseMooringDepth(slug: ProjectSlug): number {
  void slug;
  return 0.22;
}

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
