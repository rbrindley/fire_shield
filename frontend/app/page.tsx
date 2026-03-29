"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SAMPLE_QUESTIONS = [
  "What's the single most important thing I can do this weekend?",
  "Are there grants available for defensible space in Ashland?",
  "What fire-resistant plants work near my house?",
  "How do I check if my vents are ember-resistant?",
];

export default function Home() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

      // Support direct lat,lng input (e.g. "42.1946,-122.7095")
      const latLngMatch = address.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);

      const res = await fetch(`${apiUrl}/api/jurisdiction/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          latLngMatch
            ? { address: address.trim(), lat: parseFloat(latLngMatch[1]), lng: parseFloat(latLngMatch[2]) }
            : { address: address.trim() }
        ),
      });
      if (!res.ok) throw new Error("Failed to resolve address");
      const data = await res.json();
      // Store in sessionStorage for use across pages
      sessionStorage.setItem("property", JSON.stringify(data));
      router.push(`/map?profile=${data.property_profile_id}`);
    } catch {
      setError("Couldn't locate that address. Try a full street address or lat,lng (e.g. 42.19,-122.71).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-16 pb-24">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-3">🔥</div>
        <h1 className="text-3xl font-bold text-stone-900 mb-3">
          What matters most around this house?
        </h1>
        <p className="text-stone-600 text-lg leading-relaxed">
          Enter your address and get a zone-based wildfire action plan — with
          cited evidence, fire-resistant plant guidance, and local rules for
          your city.
        </p>
      </div>

      {/* Address form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Ashland, OR 97520 — or lat,lng"
            className="flex-1 px-4 py-3 rounded-lg border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white shadow-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="px-5 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            {loading ? "Locating…" : "Go →"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </form>

      {/* Sample questions */}
      <div className="mb-10">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
          Or ask a question
        </p>
        <div className="grid gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => router.push(`/chat?q=${encodeURIComponent(q)}`)}
              className="text-left px-4 py-3 rounded-lg border border-stone-200 bg-white text-stone-700 text-sm hover:border-orange-300 hover:bg-orange-50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence strip */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
        <p className="text-sm font-semibold text-amber-900 mb-2">
          Why this matters for the Rogue Valley
        </p>
        <ul className="text-sm text-amber-800 space-y-1.5 leading-snug">
          <li>
            🏠 The 2020 Almeda Fire destroyed 2,600+ homes in Talent and Phoenix
            — 5 miles from Ashland
          </li>
          <li>
            🔬 90% of homes are destroyed by wind-blown embers, not direct
            flames — the house is the target
          </li>
          <li>
            📊 Homes with 4 hardening features survived at 54% vs 36% with 1
            — in the 2025 LA fires (IBHS)
          </li>
          <li>
            ✅ Ashland&apos;s 2025 CWPP goal: 90% wildfire-resistant homes by
            2036. Current: 15%
          </li>
        </ul>
      </div>
    </div>
  );
}
