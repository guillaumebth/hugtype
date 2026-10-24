import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
      }}
    >
      <svg width="104" height="86" viewBox="0 0 22.9062 19">
        <path
          d="M11.459 3.98242L15.4297 0.0126953L22.9062 7.49023L18.9365 11.46L19 11.5234L11.5234 19L11.46 18.9365L11.4082 18.9883L3.93164 11.5107L3.98242 11.459L0 7.47656L7.47656 0L11.459 3.98242Z"
          fill="#fff"
        />
      </svg>
    </div>,
    size
  )
}
