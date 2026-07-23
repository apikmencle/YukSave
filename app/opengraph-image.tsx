import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#EDEDE7",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#1B2430",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "#FF4B3E",
                position: "absolute",
                top: 14,
                left: 14,
              }}
            />
          </div>
          <span style={{ fontSize: 56, fontWeight: 700, color: "#1B2430" }}>
            YukSave
          </span>
        </div>
        <span style={{ fontSize: 30, color: "#4A5568" }}>
          Download video TikTok tanpa watermark
        </span>
      </div>
    ),
    { ...size }
  );
}
