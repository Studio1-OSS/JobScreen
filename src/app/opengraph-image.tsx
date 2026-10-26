import { ImageResponse } from "next/og";
import { site } from "@/config/site";

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#b8a4ed"/><rect x="12" y="10" width="29" height="38" rx="7" fill="#fffaf0"/><rect x="18.5" y="18" width="16" height="4.5" rx="2.25" fill="#0a0a0a"/><rect x="18.5" y="26.5" width="11" height="4.5" rx="2.25" fill="#ff4d8b"/><rect x="18.5" y="35" width="13" height="4.5" rx="2.25" fill="#0a0a0a" fill-opacity="0.28"/><path d="M47.5 47.5 54 54" stroke="#0a0a0a" stroke-width="6.5" stroke-linecap="round"/><circle cx="40" cy="40" r="10.5" fill="#fffaf0" fill-opacity="0.55" stroke="#0a0a0a" stroke-width="5"/></svg>`;

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fffaf0", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img width={64} height={64} alt="" src={`data:image/svg+xml;base64,${Buffer.from(LOGO).toString("base64")}`} />
          <div style={{ fontSize: 40, color: "#0a0a0a" }}>{site.name}</div>
        </div>
        <div style={{ fontSize: 76, lineHeight: 1.04, letterSpacing: -3, color: "#0a0a0a", maxWidth: 940 }}>{site.tagline}</div>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            ["#1a3a3a", "#ffffff", "Recruiters: rank applicants, read the best first"],
            ["#b8a4ed", "#0a0a0a", "Job seekers: your score before you apply"],
          ].map(([bg, fg, label]) => (
            <div key={label} style={{ background: bg, color: fg, borderRadius: 24, padding: "18px 28px", fontSize: 28 }}>{label}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
