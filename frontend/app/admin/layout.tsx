"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/corpus", label: "Corpus" },
  { href: "/admin/plants", label: "Plants" },
  { href: "/admin/zones", label: "Zone Actions" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin") return <>{children}</>;

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="bg-surface-container-lowest border-b border-outline-variant/15 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-6">
          <span className="font-bold text-on-surface text-sm">Fire Shield Admin</span>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname.startsWith(n.href)
                    ? "bg-primary-container/20 text-on-primary-container"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <Link href="/" className="text-xs text-outline hover:text-on-surface-variant">
              ← Back to app
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
