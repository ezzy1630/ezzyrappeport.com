export const featuredSlugs = ["monkeyclaw", "flowe", "etch", "argyph"] as const;

/** Public project summaries verified against repository READMEs on 2026-09-06. */
export const additionalWork = [
  {
    name: "Downright",
    description:
      "A native Mac Markdown editor. Beautiful documents, exact source editing, and Finder previews.",
    category: "macOS · Open source",
    href: "https://downright.cc",
  },
  {
    name: "Terminus",
    description:
      "A coding-agent workspace with an inspectable runtime and a Rust execution kernel.",
    category: "Developer tools · In development",
    href: "https://github.com/ezzy1630/Terminus",
  },
  {
    name: "CoOps",
    description:
      "A workspace for company agent teams, with typed handoffs, human approvals, and traceable receipts.",
    category: "AI systems · In development",
    href: "https://github.com/ezzy1630/CoOps",
  },
  {
    name: "PlateFoward",
    description:
      "From donation photos to food-rescue offers and real-time recipient matching.",
    category: "Social impact · Prototype",
    href: "https://github.com/ezzy1630/PlateFoward",
  },
  {
    name: "FollowThrough",
    description:
      "Meeting notes become clear recaps, assigned actions, and follow-through.",
    category: "Productivity · Demo",
    href: "https://github.com/ezzy1630/FollowThrough",
  },
  {
    name: "ScoutSSD",
    description:
      "Scholarship discovery, eligibility filtering, and application preparation with human review.",
    category: "Education · Prototype",
    href: "https://github.com/ezzy1630/ScoutSSD",
  },
];

/** Gallery copy is drawn from the longer case studies in portfolio/content.ts. */
export const featuredPresentation = {
  monkeyclaw: {
    cover: "/projects/monkeyclaw/logo.webp",
    alt: "MonkeyClaw monkey and wordmark",
    mediaLabel: "Security tooling · Project identity",
    purpose:
      "A security agent that attacks a sandbox, reproduces findings, and checks that the defense actually noticed.",
    delivered:
      "A working CLI and seeded demo, with eight verification gates across the security loop.",
  },
  flowe: {
    cover: "/projects/flowe/structured-plan-campaign.webp",
    alt: "FlowE campaign artwork showing coursework arranged into a structured plan",
    mediaLabel: "iOS · Campaign visualization",
    purpose:
      "An iOS home for coursework, calendars, and focus. Messy thoughts become one clear next move.",
    delivered:
      "A native SwiftUI build with Canvas sync, real-time tasks, and offline retry.",
  },
  etch: {
    cover: "/projects/etch/intent-ui.webp",
    alt: "Etch workbench accepting a synchronous FIFO hardware requirement",
    mediaLabel: "Hardware design · Interface capture",
    purpose:
      "From a hardware requirement to a design you can inspect, with verification evidence at every step.",
    delivered:
      "A saved FIFO design run with simulation, bounded-formal checks, and a proof dossier. Physical signoff pending.",
  },
  argyph: {
    cover: "/projects/argyph/argyph-identity.webp",
    alt: "Argyph identity artwork showing its local code intelligence index",
    mediaLabel: "Developer tools · Project identity",
    purpose:
      "Useful codebase context for coding agents, through one local MCP server. No cloud account required.",
    delivered:
      "A released Rust CLI with 19 tools, distributed through npm, crates.io, and Homebrew.",
  },
};
