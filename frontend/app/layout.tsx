import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const geist = Geist({
  variable: "--font-geist-sans",
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
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-stone-200 bg-white py-4 text-center text-xs text-stone-500">
          Fire Shield — Open source wildfire prevention for the Rogue Valley.{" "}
          <a
            href="/llms.txt"
            className="underline hover:text-stone-700"
            target="_blank"
          >
            llms.txt
          </a>
        </footer>
      </body>
    </html>
  );
}
