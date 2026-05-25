import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<Paw side={180} />, { ...size });
}

// Paw built from HTML/CSS divs (Satori renders these reliably; inline SVG
// path commands sometimes don't survive the conversion).
export function Paw({ side }: { side: number }) {
  // Helper to scale paw geometry to any canvas size
  const s = (n: number) => (n / 180) * side;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background:
          "linear-gradient(135deg, #F4BD53 0%, #E08A14 55%, #9A5B0C 100%)",
      }}
    >
      {/* Four toe pads — outer two slightly larger and lower, inner two higher */}
      <Pad x={s(20)}  y={s(50)} w={s(32)} h={s(40)} />
      <Pad x={s(56)}  y={s(28)} w={s(30)} h={s(38)} />
      <Pad x={s(94)}  y={s(28)} w={s(30)} h={s(38)} />
      <Pad x={s(128)} y={s(50)} w={s(32)} h={s(40)} />
      {/* Main palm pad */}
      <Pad x={s(40)} y={s(92)} w={s(100)} h={s(70)} />
    </div>
  );
}

function Pad({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: "50%",
        background: "#1C1610",
      }}
    />
  );
}
