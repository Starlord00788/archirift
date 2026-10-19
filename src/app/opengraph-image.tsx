import { ImageResponse } from "next/og";

// Generated once at build time; the static export check (Milestone 0) depends on this working.
export const dynamic = "force-static";
export const alt = "Archirift: build it, break it, scale it";
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
          padding: 80,
          background: "#0b1220",
          color: "#e6edf7",
          backgroundImage:
            "linear-gradient(rgba(120,160,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,255,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div style={{ fontSize: 36, color: "#38e1ff" }}>Build it. Break it. Scale it.</div>
        <div style={{ fontSize: 120, fontWeight: 700, marginTop: 12 }}>Archirift</div>
        <div style={{ fontSize: 36, color: "#93a3bf", marginTop: 12 }}>
          System design you learn by breaking things
        </div>
      </div>
    ),
    size,
  );
}
