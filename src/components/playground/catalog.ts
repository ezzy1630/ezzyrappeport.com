export const featuredSlugs = ["downright", "monkeyclaw", "flowe", "etch", "argyph"] as const;

/** Public project summaries verified against repository READMEs on 2026-09-07. */
export const additionalWork = [
  {
    name: "Terminus",
    description:
      "A coding-agent workspace built around a Rust execution kernel, scoped tools, and verification. Still in development.",
    category: "Developer tools · In development",
    href: "https://github.com/ezzy1630/Terminus",
  },
  {
    name: "CoOps",
    description:
      "Department agents hand work across permission boundaries, with human approvals and traceable receipts.",
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
  downright: {
    cover: "/projects/downright/app-icon.png",
    alt: "Downright sculpted cream and blue app icon",
    mediaLabel: "macOS · Available now",
    purpose: "Markdown, treated like a Mac document.",
    delivered: "A native editor and reader for the files you already own. Exact source, thoughtful typography, and Finder previews.",
  },
  monkeyclaw: {
    cover: "/projects/marks/monkeyclaw.svg",
    alt: "MonkeyClaw geometric monkey mark",
    mediaLabel: "Agent security",
    purpose:
      "Tests agent sandboxes, reproduces failures, and checks that defenses leave evidence.",
    delivered:
      "A working CLI and seeded demo, with eight verification gates across the security loop.",
  },
  flowe: {
    cover: "/projects/flowe/app-icon.webp",
    alt: "FlowE sculpted silver app icon",
    mediaLabel: "iOS · Planning & focus",
    purpose:
      "Coursework, calendars, and focus in one iOS app. Start with a brain dump; leave with a plan for today.",
    delivered:
      "A native SwiftUI build with Canvas sync, real-time tasks, and offline retry.",
  },
  etch: {
    cover: "/projects/marks/etch.svg",
    alt: "Etch faceted silver pen-nib mark",
    mediaLabel: "Hardware design",
    purpose:
      "AI-assisted hardware design where generated RTL earns its way through verification.",
    delivered:
      "A saved FIFO design run with simulation, bounded-formal checks, and a proof dossier. Physical signoff pending.",
  },
  argyph: {
    cover: "/projects/marks/argyph.svg",
    alt: "Argyph faceted blue A mark",
    mediaLabel: "Developer tools",
    purpose:
      "Useful codebase context for coding agents, through one local MCP server. No cloud account required.",
    delivered:
      "A released Rust CLI with 19 tools, distributed through npm, crates.io, and Homebrew.",
  },
};
