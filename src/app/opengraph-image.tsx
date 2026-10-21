import { ImageResponse } from "next/og";

// Generated once at build time; the static export check (Milestone 0) depends on this working.
export const dynamic = "force-static";
export const alt = "Archirift: learn system design like it's a game. Fix what breaks, remember it, watch your city grow.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#f2f0e8";
const QUIET = "#a3a199";
const YELLOW = "#ffd84d";
const BG = "#0b0b0a";

/** The skyline: built towers are lit, unbuilt ones are outlines waiting for you. */
const TOWERS: { h: number; w: number; built: boolean }[] = [
  { h: 160, w: 64, built: true },
  { h: 260, w: 76, built: true },
  { h: 200, w: 64, built: true },
  { h: 350, w: 88, built: true },
  { h: 230, w: 70, built: false },
  { h: 300, w: 76, built: false },
];

function Tower({ h, w, built }: { h: number; w: number; built: boolean }) {
  const rows = Math.floor((h - 24) / 30);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignContent: "flex-start",
        gap: 10,
        padding: 12,
        width: w,
        height: h,
        background: built ? "#1c1b18" : "transparent",
        border: built ? `2px solid ${INK}` : "2px dashed #4a4943",
        borderBottom: "none",
      }}
    >
      {built &&
        Array.from({ length: rows * 2 }, (_, i) => (
          <div
            key={i}
            style={{
              width: Math.floor((w - 12 * 2 - 4 - 10) / 2) - 1,
              height: 18,
              background: (i * 7) % 5 < 3 ? YELLOW : "#3a3830",
            }}
          />
        ))}
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, color: INK, padding: "64px 56px 0 72px" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 580, flexShrink: 0, paddingBottom: 64 }}>
          <div style={{ display: "flex", fontSize: 28, color: YELLOW, letterSpacing: 4, textTransform: "uppercase" }}>Archirift</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 78, fontWeight: 700, lineHeight: 1.02, marginTop: 24, letterSpacing: -2 }}>
            <span>Learn system</span>
            <span>design like it&apos;s</span>
            <span style={{ color: YELLOW }}>a game.</span>
          </div>
          <div style={{ display: "flex", fontSize: 32, color: QUIET, marginTop: 28, lineHeight: 1.3 }}>
            Fix what breaks. Remember it. Watch your city grow.
          </div>
          <div style={{ display: "flex", marginTop: "auto", gap: 16, fontSize: 26 }}>
            <div style={{ display: "flex", padding: "10px 22px", background: YELLOW, color: BG, fontWeight: 700, borderRadius: 999 }}>
              Free · no sign-up
            </div>
            <div style={{ display: "flex", padding: "10px 22px", border: `2px solid #4a4943`, borderRadius: 999, color: INK }}>
              archirift.vercel.app
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "center", gap: 12, marginLeft: 24, borderBottom: `3px solid ${INK}`, marginBottom: 0 }}>
          {TOWERS.map((t, i) => (
            <Tower key={i} {...t} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
