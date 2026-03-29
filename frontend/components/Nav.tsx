"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const links = [
  { href: "/main", label: "Dashboard" },
  { href: "/teachers", label: "For Teachers" },
  { href: "/agents", label: "For Agents" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check login state on mount and when menu opens
  useEffect(() => {
    setIsLoggedIn(sessionStorage.getItem("fs_logged_in") === "true");
  }, [menuOpen]);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmReset(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleLogoClick(e: React.MouseEvent) {
    e.preventDefault();
    const loggedIn = sessionStorage.getItem("fs_logged_in");
    const property = sessionStorage.getItem("property");
    if (loggedIn && property) {
      try {
        const p = JSON.parse(property);
        if (p.property_profile_id) {
          router.push(`/main?profile=${p.property_profile_id}`);
          return;
        }
      } catch {
        // fall through
      }
    }
    router.push("/");
  }

  function handleLogin() {
    sessionStorage.setItem("fs_logged_in", "true");
    setIsLoggedIn(true);
    setMenuOpen(false);
  }

  function handleLogout() {
    sessionStorage.removeItem("fs_logged_in");
    setIsLoggedIn(false);
    setMenuOpen(false);
    // Keep property data but redirect to landing
    router.push("/");
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    // Clear all user state
    sessionStorage.removeItem("property");
    sessionStorage.removeItem("fs_logged_in");
    sessionStorage.clear();
    setIsLoggedIn(false);
    setMenuOpen(false);
    setConfirmReset(false);
    router.push("/");
  }

  function isActiveLink(href: string) {
    if (href.includes("?")) {
      const [path, qs] = href.split("?");
      return pathname === path && typeof window !== "undefined" && window.location.search === "?" + qs;
    }
    return pathname === href;
  }

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <a href="/" onClick={handleLogoClick} className="flex items-center">
          <Image src="/logo.png" alt="Fire Shield" width={160} height={40} className="h-9 w-auto" priority />
        </a>

        <div className="flex items-center gap-1">
          <nav className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActiveLink(l.href)
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* User menu */}
          <div className="relative ml-2" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen(!menuOpen); setConfirmReset(false); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isLoggedIn
                  ? "bg-primary/15 text-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
              }`}
              aria-label="User menu"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(27,28,26,0.12)] py-2 z-50">
                {isLoggedIn ? (
                  <>
                    <div className="px-4 py-2 border-b border-outline-variant/15 mb-1">
                      <p className="text-xs text-on-surface-variant font-body">Logged in as</p>
                      <p className="text-sm font-medium text-on-surface font-body">Test User</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm font-body text-on-surface-variant hover:bg-surface-container-low transition-colors"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="w-full text-left px-4 py-2.5 text-sm font-body text-on-surface hover:bg-surface-container-low transition-colors"
                  >
                    Log in
                  </button>
                )}
                <div className="my-1 border-t border-outline-variant/15" />
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-left px-4 py-2.5 text-sm font-body text-on-surface hover:bg-surface-container-low transition-colors"
                >
                  Admin
                </Link>
                <div className="my-1 border-t border-outline-variant/15" />
                <button
                  onClick={handleReset}
                  className={`w-full text-left px-4 py-2.5 text-sm font-body transition-colors ${
                    confirmReset
                      ? "bg-error/10 text-error font-semibold"
                      : "text-tertiary hover:bg-surface-container-low"
                  }`}
                >
                  {confirmReset ? "Confirm: erase all test data?" : "Reset Test User"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
