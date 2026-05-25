import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #F4BD53 0%, #E08A14 50%, #9A5B0C 100%)",
          fontSize: 110,
        }}
      >
        🐾
      </div>
    ),
    { ...size },
  );
}
