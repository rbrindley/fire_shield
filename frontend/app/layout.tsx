import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const manrope = Manrope({
  variable: "--font-headline",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fire Shield — Wildfire Prevention for the Rogue Valley",
  description:
    "Property-specific wildfire action plan with cited recommendations, zone-based guidance, and fire-resistant plant selection for Southern Oregon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface text-on-surface font-body">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="bg-surface-container-low py-6 text-center text-xs text-on-surface-variant">
          Fire Shield — Open source wildfire prevention for the Rogue Valley.{" "}
          <a
            href="/llms.txt"
            className="underline hover:text-on-surface"
            target="_blank"
          >
            llms.txt
          </a>
        </footer>
      </body>
    </html>
  );
}
