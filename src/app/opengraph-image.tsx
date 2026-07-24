import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "linear-gradient(180deg, #dceef4 0%, #9ec8e0 42%, #1a4a78 78%, #021428 100%)",
          padding: "72px 88px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 30% 18%, rgba(255,255,255,0.55) 0%, transparent 42%), radial-gradient(ellipse at 70% 60%, rgba(0,140,255,0.28) 0%, transparent 50%)",
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#e8f4ff",
            letterSpacing: 5,
            marginBottom: 22,
            opacity: 0.9,
          }}
        >
          SOFTWARE ENGINEER · AI SYSTEMS · FOUNDER
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            color: "#f7fbff",
            lineHeight: 0.95,
            letterSpacing: -2.5,
          }}
        >
          EZZY RAPPEPORT
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 28,
            color: "#9fd0ff",
            letterSpacing: -0.4,
            maxWidth: 760,
          }}
        >
          Descend into the work.
        </div>
      </div>
    ),
    { ...size },
  );
}
