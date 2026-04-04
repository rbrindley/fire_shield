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
      </body>
    </html>
  );
}
