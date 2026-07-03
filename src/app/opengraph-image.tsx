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
          justifyContent: "center",
          background: "linear-gradient(160deg, #f7f9fc 0%, #e8f1ff 55%, #c3dbff 100%)",
          padding: 96,
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: "#0066ff", letterSpacing: 6, marginBottom: 28 }}>
          ENGINEER · AI BUILDER · FOUNDER
        </div>
        <div style={{ display: "flex", fontSize: 116, fontWeight: 800, color: "#0a0f1a", lineHeight: 1.02, letterSpacing: -3 }}>
          ELIEZER
        </div>
        <div style={{ display: "flex", fontSize: 116, fontWeight: 800, color: "#0a0f1a", lineHeight: 1.02, letterSpacing: -3 }}>
          RAPPEPORT
        </div>
      </div>
    ),
    { ...size },
  );
}
