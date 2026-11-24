import Image from "next/image";

// The TFTG logo (public/tftg-logo.png). `size` is the logo height in px.
// `tone` is kept so existing callers compile; the logo's navy and orange
// read on every background the site uses (white, light grey, soft orange).
export function Brand({
  size = 28,
}: {
  tone?: "on-light" | "on-ink";
  size?: number;
}) {
  return (
    <Image
      src="/tftg-logo.png"
      alt="Too Far To Go"
      width={Math.round(size * 4.84)}
      height={size}
      priority
      unoptimized
      className="h-auto w-auto"
      style={{ height: size, width: "auto" }}
    />
  );
}
