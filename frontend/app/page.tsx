"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
}

const HELPER_EXAMPLES = [
  "What are the biggest bang-for-the-buck protection steps?",
  "What can I plant next to my house?",
  "I want to add a porch. What does city fire code say about that?",
  "Who can help me assess my home\u2019s fire risk?",
];

function looksLikePureAddress(input: string): boolean {
  const trimmed = input.trim();
  // Lat,lng is always a pure address
  const latLng = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/;
  if (latLng.test(trimmed)) return true;
  // If it contains question words or is long with non-address text, it's a question
  // that happens to mention an address — let the backend classifier handle it
  if (/\b(what|how|can|should|do|does|is|are|help|protect|plant|screen|vent|roof|zone)\b/i.test(trimmed)) return false;
  if (trimmed.length > 80) return false;
  // Short input that looks like a street address
  const streetPattern = /\d+\s+\w+.*(st|ave|rd|dr|blvd|ln|way|ct|pl|street|avenue|road|drive|boulevard|lane|court|place)\b/i;
  return streetPattern.test(trimmed);
}

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "address"; value: string } | { type: "question"; value: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const toggleMic = useCallback(() => {
    if (listening && recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
      setListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition: SpeechRecognitionInstance = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if ((result as unknown as { isFinal: boolean }).isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInput(final + interim);
    };
    recognition.onend = () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { setListening(false); }
      }
    };
    recognition.onerror = (event: Event & { error: string }) => {
      if (event.error === "no-speech") return;
      setListening(false);
    };

    try {
      recognition.start();
      console.log("[Mic] recognition.start() called successfully");
      setListening(true);
    } catch (e) {
      console.error("[Mic] recognition.start() threw:", e);
    }
  }, [listening]);

  // Validate session on mount — clear stale tokens silently
  useEffect(() => {
    const loggedIn = sessionStorage.getItem("fs_logged_in");
    if (!loggedIn) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
    const token = sessionStorage.getItem("fs_token");
    fetch(`${apiUrl}/api/auth/check`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) {
          // Token is stale (backend redeployed) — clear silently
          sessionStorage.removeItem("fs_logged_in");
          sessionStorage.removeItem("fs_token");
          return;
        }
        // Session valid — redirect if property is set
        const property = sessionStorage.getItem("property");
        if (property) {
          try {
            const p = JSON.parse(property);
            if (p.property_profile_id) {
              router.replace(`/main?profile=${p.property_profile_id}`);
            }
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // Network error — clear stale session to be safe
        sessionStorage.removeItem("fs_logged_in");
        sessionStorage.removeItem("fs_token");
      });
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

    const isAddr = looksLikePureAddress(value);

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.detail || "Login failed");
        setLoginLoading(false);
        return;
      }
      // Store token for API calls
      sessionStorage.setItem("fs_logged_in", "true");
      if (data.token) sessionStorage.setItem("fs_token", data.token);
      setShowLoginModal(false);
      setLoginUsername("");
      setLoginPassword("");

      // Continue with the pending action
      if (pendingAction) {
        if (pendingAction.type === "address") {
          await resolveAndNavigate(pendingAction.value);
        } else {
          router.push(`/main?q=${encodeURIComponent(pendingAction.value)}`);
        }
        setPendingAction(null);
      }
    } catch {
      setLoginError("Connection failed. Try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleGuestContinue() {
    setShowLoginModal(false);
    // Guests can browse but won't be able to use chat (query endpoint requires auth)
    if (pendingAction) {
      if (pendingAction.type === "address") {
        resolveAndNavigate(pendingAction.value);
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

      <div className="relative flex flex-col items-center max-w-2xl w-full text-center">
        {/* Headline above logo */}
        <p className="text-sm md:text-base text-on-surface-variant font-headline font-semibold tracking-wide uppercase">
          AI Powered Fire Protection
        </p>

        {/* V3 Logo — large, negative margins to crop built-in padding in image */}
        <div className="overflow-hidden -my-8 md:-my-12">
          <Image
            src="/logo-v3.png"
            alt="Fire Shield"
            width={1200}
            height={1200}
            className="w-[720px] md:w-[1080px] max-w-[90vw] h-auto"
            priority
          />
        </div>

        {/* Prompt area with helper text */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="bg-surface-container-lowest p-4 md:p-6 rounded-2xl shadow-[0_24px_48px_-12px_rgba(27,28,26,0.08)] ring-1 ring-outline-variant/15 space-y-4">
            {/* Input area */}
            <div className="relative">
              <svg className="absolute left-4 top-4 w-5 h-5 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) {
                      const form = e.currentTarget.closest("form");
                      form?.requestSubmit();
                    }
                  }
                }}
                placeholder="Ask a question or enter your address..."
                rows={4}
                className="w-full pl-12 pr-12 py-4 rounded-xl border-none bg-surface-container-low focus:ring-2 focus:ring-primary text-on-surface placeholder:text-outline/60 font-body text-lg outline-none resize-none"
                disabled={loading}
              />
              <button
                type="button"
                onClick={toggleMic}
                className={`absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  listening
                    ? "bg-tertiary text-on-tertiary animate-pulse"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
                }`}
                title={listening ? "Stop listening" : "Voice input"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-full px-8 py-4 rounded-xl font-headline font-bold text-lg text-on-primary hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
            >
              {loading ? "Locating\u2026" : "Send \u2192"}
            </button>

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
                Log in to access the wildfire advisor.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-body placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-body placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {loginError && (
                <div className="space-y-2 text-center">
                  <p className="text-xs text-tertiary font-body">{loginError}</p>
                  <button
                    type="button"
                    onClick={() => { setLoginError(null); setLoginPassword(""); }}
                    className="text-xs text-primary underline underline-offset-2 font-body hover:opacity-80"
                  >
                    Try again
                  </button>
                  <p className="text-xs text-on-surface-variant font-body">
                    or contact Richard Brindley for access
                  </p>
                </div>
              )}
              {!loginError && (
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full px-6 py-3.5 rounded-xl font-headline font-bold text-on-primary hover:opacity-90 transition-all text-sm disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
                >
                  {loginLoading ? "Logging in..." : "Log In"}
                </button>
              )}
              <p className="text-xs text-red-600 text-center font-body">*Login Required for Testing</p>
              <button
                type="button"
                disabled
                className="w-full px-6 py-3.5 rounded-xl font-headline font-medium text-on-surface-variant/40 bg-surface-container-low cursor-not-allowed text-sm"
              >
                Continue as Guest
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
