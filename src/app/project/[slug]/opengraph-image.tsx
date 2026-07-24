import { ImageResponse } from "next/og";
import { projects, type ProjectSlug } from "@/lib/portfolio/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

function gradientForIndex(index: string) {
  const n = Number(index);
  return n <= 4
    ? "linear-gradient(180deg, #d7eef8 0%, #7eb8d8 55%, #2a6a98 100%)"
    : "linear-gradient(180deg, #9ec4dc 0%, #3a6a98 50%, #0a2848 100%)";
}

/** Geometric stand-ins for the site's 2.5D project identity family. */
function IdentMark({ slug, deep }: { slug: ProjectSlug; deep: boolean }) {
  const ink = deep ? "#d8ecff" : "#0a2a48";
  const accent = deep ? "#7ec8ff" : "#1a5a9a";
  switch (slug) {
    case "velox":
      return (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {[0.55, 0.78, 1].map((scale, i) => (
            <div
              key={i}
              style={{
                width: 28 * scale,
                height: 72 * scale,
                background: i === 2 ? accent : ink,
                opacity: 0.35 + i * 0.3,
                clipPath: "polygon(0% 0%, 100% 50%, 0% 100%, 28% 50%)",
              }}
            />
          ))}
        </div>
      );
    case "etch":
      return (
        <div
          style={{
            width: 36,
            height: 88,
            background: `linear-gradient(180deg, ${ink}, ${accent})`,
            clipPath: "polygon(35% 0%, 65% 0%, 100% 78%, 50% 100%, 0% 78%)",
          }}
        />
      );
    case "mathpilot":
      return (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 72 }}>
          <div style={{ width: 10, height: 64, borderRadius: 999, background: accent }} />
          <div style={{ width: 64, height: 8, borderRadius: 999, background: ink, marginBottom: 18, transform: "rotate(-18deg)" }} />
        </div>
      );
    case "monkeyclaw":
      return <div style={{ width: 78, height: 78, borderRadius: "46% 46% 40% 40%", background: accent, opacity: 0.9 }} />;
    case "flowe":
      return <div style={{ width: 70, height: 70, borderRadius: "42% 58% 48% 52%", background: `linear-gradient(135deg, ${ink}, ${accent})` }} />;
    case "argyph":
      return (
        <div
          style={{
            width: 70,
            height: 78,
            background: accent,
            clipPath: "polygon(50% 0%, 100% 28%, 82% 100%, 18% 100%, 0% 28%)",
          }}
        />
      );
    case "nexarad":
    default:
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[56, 70, 56].map((w, i) => (
            <div key={i} style={{ width: w, height: 10, borderRadius: 999, background: i === 1 ? accent : ink, opacity: 0.75 }} />
          ))}
        </div>
      );
  }
}

export default async function ProjectOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projects.find((entry) => entry.slug === slug) ?? projects[0];
  const deep = Number(project.index) > 4;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: gradientForIndex(project.index),
          padding: "72px 88px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: deep
              ? "radial-gradient(ellipse at 28% 20%, rgba(120,190,255,0.35) 0%, transparent 45%)"
              : "radial-gradient(ellipse at 30% 18%, rgba(255,255,255,0.5) 0%, transparent 42%)",
          }}
        />
        <div style={{ position: "absolute", top: 72, right: 88, display: "flex" }}>
          <IdentMark slug={project.slug} deep={deep} />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: deep ? "#cfe6ff" : "#0a3a5c",
            letterSpacing: 5,
            marginBottom: 18,
          }}
        >
          {project.index} · {project.year}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 700,
            color: deep ? "#f4f9ff" : "#071824",
            lineHeight: 0.95,
            letterSpacing: -2,
          }}
        >
          {project.title}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 28,
            color: deep ? "#9fd0ff" : "#1a4a6a",
            maxWidth: 820,
            lineHeight: 1.25,
          }}
        >
          {project.tagline}
        </div>
      </div>
    ),
    { ...size },
  );
}
