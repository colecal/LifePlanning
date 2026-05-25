import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 320,
        }}
      >
        🐾
      </div>
    ),
    { ...size },
  );
}
