"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const HELPER_EXAMPLES = [
  "What are the biggest bang-for-the-buck protection steps?",
  "What can I plant next to my house?",
  "I want to add a porch. What does city fire code say about that?",
  "Who can help me assess my home\u2019s fire risk?",
];

function looksLikeAddress(input: string): boolean {
  const latLng = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/;
  if (latLng.test(input.trim())) return true;
  const streetPattern = /\d+\s+\w+.*(st|ave|rd|dr|blvd|ln|way|ct|pl|street|avenue|road|drive|boulevard|lane|court|place)\b/i;
  return streetPattern.test(input.trim());
}

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "address"; value: string } | { type: "question"; value: string } | null>(null);

  // If logged in with an active session, redirect to /main
  useEffect(() => {
    const loggedIn = sessionStorage.getItem("fs_logged_in");
    const property = sessionStorage.getItem("property");
    if (loggedIn && property) {
      try {
        const p = JSON.parse(property);
        if (p.property_profile_id) {
          router.replace(`/main?profile=${p.property_profile_id}`);
        }
      } catch {
        // ignore
      }
    }
  }, [router]);

  async function resolveAndNavigate(value: string) {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
      const latLngMatch = value.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
      const res = await fetch(`${apiUrl}/api/jurisdiction/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          latLngMatch
            ? { address: value, lat: parseFloat(latLngMatch[1]), lng: parseFloat(latLngMatch[2]) }
            : { address: value }
        ),
      });
      if (!res.ok) throw new Error("resolve failed");
      const data = await res.json();
      sessionStorage.setItem("property", JSON.stringify(data));
      router.push(`/main?tab=map&profile=${data.property_profile_id}`);
    } catch {
      setError("Couldn\u2019t locate that address. Try a full street address or lat,lng.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;

    const isAddr = looksLikeAddress(value);

    // If not logged in, show login modal before proceeding
    const loggedIn = sessionStorage.getItem("fs_logged_in");
    if (!loggedIn) {
      setPendingAction(isAddr ? { type: "address", value } : { type: "question", value });
      setShowLoginModal(true);
      return;
    }

    if (isAddr) {
      await resolveAndNavigate(value);
    } else {
      router.push(`/main?q=${encodeURIComponent(value)}`);
    }
  }

  async function handleLoginModalChoice(choice: "login" | "guest") {
    if (choice === "login") {
      // Fake test user login: set logged-in flag
      sessionStorage.setItem("fs_logged_in", "true");
    }
    setShowLoginModal(false);

    // Continue with the pending action
    if (pendingAction) {
      if (pendingAction.type === "address") {
        await resolveAndNavigate(pendingAction.value);
      } else {
        router.push(`/main?q=${encodeURIComponent(pendingAction.value)}`);
      }
      setPendingAction(null);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 bg-surface overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-secondary-container opacity-20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary-container opacity-30 blur-[100px]" />

      <div className="relative flex flex-col items-center space-y-8 max-w-2xl w-full text-center">
        {/* Headline above logo */}
        <p className="text-sm md:text-base text-on-surface-variant font-headline font-semibold tracking-wide uppercase">
          AI Powered Fire Protection
        </p>

        {/* V3 Logo — large */}
        <Image
          src="/logo-v3.png"
          alt="Fire Shield"
          width={600}
          height={600}
          className="w-48 md:w-64 h-auto"
          priority
        />

        {/* Prompt area with helper text */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="bg-surface-container-lowest p-4 md:p-6 rounded-2xl shadow-[0_24px_48px_-12px_rgba(27,28,26,0.08)] ring-1 ring-outline-variant/15 space-y-4">
            {/* Input row */}
            <div className="flex flex-col md:flex-row items-stretch gap-2">
              <div className="flex-1 relative flex items-center">
                <svg className="absolute left-4 w-5 h-5 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question or enter your address..."
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-none bg-surface-container-low focus:ring-2 focus:ring-primary text-on-surface placeholder:text-outline/60 font-body text-lg outline-none"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-8 py-4 rounded-xl font-headline font-bold text-lg text-on-primary hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
              >
                {loading ? "Locating\u2026" : "Send \u2192"}
              </button>
            </div>

            {/* Helper text */}
            <div className="text-left px-2">
              <p className="text-sm text-on-surface-variant font-body leading-relaxed">
                Add an address for specific recommendations or ask questions like:
              </p>
              <ul className="mt-2 space-y-1.5">
                {HELPER_EXAMPLES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      onClick={() => setInput(example)}
                      className="text-sm text-on-surface-variant/80 font-body hover:text-primary transition-colors text-left"
                    >
                      <span className="text-outline mr-2">&ndash;</span>
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {error && (
            <p className="mt-3 text-sm text-error text-center">{error}</p>
          )}
        </form>
      </div>

      {/* Login modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm px-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_24px_48px_rgba(27,28,26,0.15)] max-w-md w-full p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="font-headline font-bold text-on-surface text-xl">Welcome to Fire Shield</h2>
              <p className="text-sm text-on-surface-variant font-body leading-relaxed">
                Log in to remember and resume your conversation next time.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleLoginModalChoice("login")}
                className="w-full px-6 py-3.5 rounded-xl font-headline font-bold text-on-primary hover:opacity-90 transition-all text-sm"
                style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
              >
                Log In
              </button>
              <button
                onClick={() => handleLoginModalChoice("guest")}
                className="w-full px-6 py-3.5 rounded-xl font-headline font-medium text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high transition-colors text-sm"
              >
                Continue as Guest
              </button>
            </div>

            <p className="text-xs text-outline text-center font-body">
              Guest sessions are not saved between visits.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
