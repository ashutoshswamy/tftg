import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ui } from "@clerk/ui";
import "./globals.css";

// DM Sans is the only typeface in the product.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Too Far To Go",
  description: "Internal transportation management system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      ui={ui}
      afterSignOutUrl="/login"
      localization={{
        signIn: { start: { title: "Sign in to Too Far To Go" } },
        signUp: { start: { title: "Create your Too Far To Go account" } },
      }}
      appearance={{
        variables: {
          colorPrimary: "#ff7a00",
          colorPrimaryForeground: "#0d1829",
          colorForeground: "#0d1829",
          colorBackground: "#ffffff",
          colorInput: "#ffffff",
          borderRadius: "8px",
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        },
      }}
    >
      <html
        lang="en"
        className={`${dmSans.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
