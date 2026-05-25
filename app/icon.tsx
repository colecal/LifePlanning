import { ImageResponse } from "next/og";
import { Paw } from "./apple-icon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<Paw side={512} />, { ...size });
}
