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
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-6">
          <span className="font-bold text-stone-900 text-sm">Fire Shield Admin</span>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname.startsWith(n.href)
                    ? "bg-orange-100 text-orange-800"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <Link href="/" className="text-xs text-stone-400 hover:text-stone-600">
              ← Back to app
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
