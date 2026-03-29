"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import HIZMap from "@/components/HIZMap";
import Link from "next/link";

// Derived at render time — no API call needed
function getSeasonalBanner(): { label: string; message: string; color: string } | null {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 6 && month <= 10) {
    return {
      label: "Fire Season",
      message: "June–October is peak fire season in the Rogue Valley. Prioritize Layer 0 (vents, eaves) and Layer 1 (0–5 ft) actions now.",
      color: "bg-red-50 border-red-300 text-red-800",
    };
  }
  if (month >= 3 && month <= 5) {
    return {
      label: "Spring Prep Window",
      message: "Spring is the best time to thin trees, clear dead vegetation, and clean gutters before fire season begins.",
      color: "bg-amber-50 border-amber-300 text-amber-800",
    };
  }
  if (month >= 11 || month <= 2) {
    return {
      label: "Winter Maintenance Window",
      message: "Good time for tree thinning and structural improvements. Fire risk is lower but planning ahead pays off.",
      color: "bg-blue-50 border-blue-300 text-blue-800",
    };
  }
  return null;
}

interface PropertyData {
  lat: number;
  lng: number;
  display_address: string;
  jurisdiction_code: string;
  jurisdiction_display: string;
  jurisdiction_chain: string[];
  property_profile_id: string;
  geocode_failed?: boolean;
}

function MapInner() {
  const searchParams = useSearchParams();
  const profileId = searchParams.get("profile");
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [coordsInput, setCoordsInput] = useState("");
  const [coordsError, setCoordsError] = useState("");

  useEffect(() => {
    // Try sessionStorage first
    const stored = sessionStorage.getItem("property");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PropertyData;
        if (!profileId || parsed.property_profile_id === profileId) {
          setProperty({
            ...parsed,
            lat: parsed.lat ?? 42.1946,
            lng: parsed.lng ?? -122.7095,
          });
          setLoading(false);
          return;
        }
      } catch {
        // ignore parse errors
      }
    }

    // Fetch from API if profile ID provided
    if (profileId) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
      fetch(`${apiUrl}/api/jurisdiction/profile/${profileId}`)
        .then((r) => r.json())
        .then((data) => {
          // Profile row doesn't have all fields — minimal display
          setProperty({
            lat: data.lat ?? 42.1946,
            lng: data.lng ?? -122.7095,
            display_address: data.address,
            jurisdiction_code: data.jurisdiction_code ?? "jackson_county",
            jurisdiction_display: data.jurisdiction_code ?? "Jackson County, OR",
            jurisdiction_chain: [],
            property_profile_id: data.id,
          });
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [profileId]);

  async function handleCoordsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCoordsError("");
    const match = coordsInput.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (!match) {
      setCoordsError("Enter coordinates as lat,lng (e.g. 42.1946,-122.7095)");
      return;
    }
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCoordsError("Latitude must be -90 to 90, longitude -180 to 180");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
    try {
      const res = await fetch(`${apiUrl}/api/jurisdiction/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: property?.display_address ?? coordsInput.trim(),
          lat,
          lng,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      sessionStorage.setItem("property", JSON.stringify(data));
      setProperty({
        ...data,
        lat: data.lat ?? lat,
        lng: data.lng ?? lng,
        property_profile_id: data.property_profile_id,
      });
    } catch {
      setCoordsError("Failed to resolve location. Try again.");
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-stone-500">
        Loading property…
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-stone-600 mb-4">No property selected.</p>
        <Link href="/" className="text-orange-600 underline">
          Enter an address →
        </Link>
      </div>
    );
  }

  const seasonalBanner = getSeasonalBanner();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Seasonal context banner */}
      {seasonalBanner && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm flex items-start gap-2 ${seasonalBanner.color}`}>
          <span className="font-semibold flex-shrink-0">{seasonalBanner.label}:</span>
          <span>{seasonalBanner.message}</span>
        </div>
      )}

      {/* Property header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-stone-900 mb-0.5">
              {property.display_address}
            </h1>
            <p className="text-sm text-stone-500">{property.jurisdiction_display}</p>
            {property.geocode_failed && (
              <form onSubmit={handleCoordsSubmit} className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-800 mb-1.5">
                  Address could not be precisely located. Drop a pin in Google Maps, copy the coordinates, and paste them here:
                </p>
                <div className="flex gap-2">
                  <input
                    value={coordsInput}
                    onChange={(e) => setCoordsInput(e.target.value)}
                    placeholder="42.1946,-122.7095"
                    className="flex-1 px-2 py-1 text-xs rounded border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs bg-orange-600 text-white rounded font-medium hover:bg-orange-700 transition-colors"
                  >
                    Update location
                  </button>
                </div>
                {coordsError && <p className="text-xs text-red-600 mt-1">{coordsError}</p>}
              </form>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href={`/chat?profile=${property.property_profile_id}`}
              className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
            >
              Ask a question →
            </Link>
            <Link
              href={`/plants?jurisdiction=${property.jurisdiction_code}`}
              className="px-3 py-1.5 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
            >
              Plant search
            </Link>
          </div>
        </div>

        {/* Jurisdiction chain display */}
        {property.jurisdiction_chain.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {property.jurisdiction_chain.map((j) => (
              <span
                key={j}
                className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200"
              >
                {j}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <HIZMap
        lat={property.lat}
        lng={property.lng}
        jurisdictionDisplay={property.jurisdiction_display}
        profileId={property.property_profile_id}
      />

      {/* Instructions */}
      <div className="mt-4 p-4 bg-stone-100 rounded-lg text-sm text-stone-600">
        <span className="font-medium">How to use:</span> Select a zone from the
        panel on the right to see prioritized actions. Start with Layer 0 (the
        house itself) — it&apos;s where most homes are lost.
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12 text-center text-stone-400">Loading map…</div>}>
      <MapInner />
    </Suspense>
  );
}
