import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Main app icon (manifest + favicon). Hand-drawn SVG paw — emoji-free.
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
          background:
            "linear-gradient(135deg, #F4BD53 0%, #E08A14 55%, #9A5B0C 100%)",
        }}
      >
        <PawSVG size={340} color="#1C1610" />
      </div>
    ),
    { ...size },
  );
}

function PawSVG({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="33" cy="42" rx="11" ry="14" fill={color} />
      <ellipse cx="50" cy="28" rx="10" ry="13" fill={color} />
      <ellipse cx="70" cy="28" rx="10" ry="13" fill={color} />
      <ellipse cx="87" cy="42" rx="11" ry="14" fill={color} />
      <path
        d="M60 56
           C 76 56, 90 68, 90 84
           C 90 96, 78 102, 70 102
           C 65 102, 63 99, 60 99
           C 57 99, 55 102, 50 102
           C 42 102, 30 96, 30 84
           C 30 68, 44 56, 60 56 Z"
        fill={color}
      />
    </svg>
  );
}
