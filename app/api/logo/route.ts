import { getLogo } from "@/lib/logo";

// Public on purpose: the logo is printed on every customer-facing invoice.
export async function GET(request: Request) {
  const square = new URL(request.url).searchParams.get("shape") === "square";
  const logo = await getLogo(square ? "square" : "wide");
  return new Response(logo.bytes as BodyInit, {
    headers: {
      "Content-Type": logo.contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
