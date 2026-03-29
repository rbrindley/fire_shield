"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SUGGESTION_CHIPS = [
  { icon: "!", label: "What should I do first?" },
  { icon: "\u2698", label: "What can I plant near my house?" },
  { icon: "$", label: "Am I eligible for grants?" },
];

const FEATURES = [
  {
    span: 2,
    label: "Ecosystem Safety",
    title: "The 30-Foot Shield",
    desc: "Learn how to create a defensible space that harmonizes with local flora while significantly reducing ignition risks.",
    style: "hero",
  },
  {
    span: 1,
    icon: "\u2611",
    title: "Certified Prep",
    desc: "Get a documented certificate of preparedness to share with insurance providers.",
    style: "primary",
  },
  {
    span: 1,
    icon: "\u2709",
    title: "Expert Advice",
    desc: "Real-time chat with certified fire safety arborists for complex property questions.",
    style: "white",
  },
  {
    span: 2,
    title: "Community Resilience",
    desc: "Join 4,000+ neighbors in the Redwood Valley zone who have already unified their fire-shield strategies.",
    style: "dark",
  },
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
      sessionStorage.setItem("property", JSON.stringify(data));
      router.push(`/map?profile=${data.property_profile_id}`);
    } catch {
      setError("Couldn\u2019t locate that address. Try a full street address or lat,lng (e.g. 42.19,-122.71).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-secondary-container opacity-20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary-container opacity-30 blur-[100px]" />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center pt-24 pb-16 px-4">
        <div className="flex flex-col items-center space-y-8 max-w-3xl text-center">
          {/* Badge */}
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary-container/15 text-primary text-xs font-semibold tracking-widest uppercase font-headline">
            Your Digital Arborist
          </span>

          {/* Heading */}
          <h1 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-on-surface">
            What matters most<br />
            <span className="italic text-primary">around your house</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-on-surface-variant leading-relaxed max-w-2xl font-body">
            Personalized wildfire protection and environmental stewardship for
            homeowners who value proactive resilience.
          </p>

          {/* Address input */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl">
            <div className="bg-surface-container-lowest p-2 md:p-3 rounded-2xl shadow-[0_24px_48px_-12px_rgba(27,28,26,0.08)] ring-1 ring-outline-variant/15">
              <div className="flex flex-col md:flex-row items-stretch gap-2">
                <div className="flex-1 relative flex items-center">
                  <svg className="absolute left-4 w-5 h-5 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter your home address..."
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-none bg-surface-container-low focus:ring-2 focus:ring-primary text-on-surface placeholder:text-outline/60 font-body text-lg outline-none"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !address.trim()}
                  className="px-8 py-4 rounded-xl font-headline font-bold text-lg text-on-primary hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
                >
                  {loading ? "Locating\u2026" : "Assess Risk \u2192"}
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-3 text-sm text-error text-center">{error}</p>
            )}
          </form>

          {/* Suggestion chips */}
          <div className="flex flex-wrap justify-center gap-3">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => router.push(`/chat?q=${encodeURIComponent(chip.label)}`)}
                className="px-5 py-2.5 rounded-full bg-surface-container-low text-on-surface-variant font-body text-sm hover:bg-surface-container-high hover:text-primary transition-all border border-outline-variant/20 flex items-center gap-2"
              >
                <span className="text-lg leading-none">{chip.icon}</span>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Bento grid */}
      <section className="relative max-w-6xl w-full mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: The 30-Foot Shield */}
          <div className="md:col-span-2 bg-surface-container-low rounded-3xl p-8 min-h-[320px] flex flex-col justify-end relative overflow-hidden">
            <div className="space-y-2">
              <span className="text-secondary font-body text-xs font-bold tracking-widest uppercase">
                Ecosystem Safety
              </span>
              <h3 className="font-headline text-2xl font-bold text-on-surface">The 30-Foot Shield</h3>
              <p className="text-on-surface-variant max-w-md font-body">
                Learn how to create a defensible space that harmonizes with local flora while significantly reducing ignition risks.
              </p>
            </div>
          </div>

          {/* Card 2: Certified Prep */}
          <div className="bg-primary-container/10 rounded-3xl p-8 flex flex-col justify-between border border-primary-container/20 min-h-[240px]">
            <div className="bg-primary-container w-12 h-12 rounded-xl flex items-center justify-center text-on-primary-container">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="space-y-1 mt-6">
              <h3 className="font-headline text-xl font-bold text-on-surface">Certified Prep</h3>
              <p className="text-sm text-on-surface-variant font-body">
                Get a documented certificate of preparedness to share with insurance providers.
              </p>
            </div>
          </div>

          {/* Card 3: Expert Advice */}
          <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-sm ring-1 ring-outline-variant/15 flex flex-col justify-between min-h-[240px]">
            <div className="bg-secondary-container w-12 h-12 rounded-xl flex items-center justify-center text-on-secondary-container">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="space-y-1 mt-6">
              <h3 className="font-headline text-xl font-bold text-on-surface">Expert Advice</h3>
              <p className="text-sm text-on-surface-variant font-body">
                Real-time chat with certified fire safety arborists for complex property questions.
              </p>
            </div>
          </div>

          {/* Card 4: Community Resilience (dark) */}
          <div className="md:col-span-2 bg-inverse-surface text-inverse-on-surface rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-4">
              <h3 className="font-headline text-2xl font-bold">Community Resilience</h3>
              <p className="text-inverse-on-surface/80 font-body">
                Join 4,000+ neighbors in the Redwood Valley zone who have already unified their fire-shield strategies.
              </p>
              <button
                onClick={() => router.push("/map")}
                className="px-6 py-2.5 rounded-lg bg-primary font-headline font-bold hover:bg-primary-container transition-colors text-white"
              >
                View Community Map
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
