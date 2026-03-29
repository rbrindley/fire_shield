"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import HIZMap from "@/components/HIZMap";
import Link from "next/link";

function getSeasonalBanner(): { label: string; message: string; style: string } | null {
  const month = new Date().getMonth() + 1;
  if (month >= 6 && month <= 10) {
    return {
      label: "Fire Season",
      message: "June\u2013October is peak fire season in the Rogue Valley. Prioritize Layer 0 (vents, eaves) and Layer 1 (0\u20135 ft) actions now.",
      style: "bg-tertiary-container/15 text-on-tertiary-container",
    };
  }
  if (month >= 3 && month <= 5) {
    return {
      label: "Spring Prep Window",
      message: "Spring is the best time to thin trees, clear dead vegetation, and clean gutters before fire season begins.",
      style: "bg-primary-container/15 text-on-primary-container",
    };
  }
  if (month >= 11 || month <= 2) {
    return {
      label: "Winter Maintenance Window",
      message: "Good time for tree thinning and structural improvements. Fire risk is lower but planning ahead pays off.",
      style: "bg-secondary-container/30 text-on-secondary-container",
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

    if (profileId) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
      fetch(`${apiUrl}/api/jurisdiction/profile/${profileId}`)
        .then((r) => r.json())
        .then((data) => {
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
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-on-surface-variant font-body">
        Loading property\u2026
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-on-surface-variant mb-4 font-body">No property selected.</p>
        <Link href="/" className="text-primary underline font-headline font-semibold">
          Enter an address \u2192
        </Link>
      </div>
    );
  }

  const seasonalBanner = getSeasonalBanner();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Seasonal context banner */}
      {seasonalBanner && (
        <div className={`mb-4 px-4 py-3 rounded-2xl text-sm flex items-start gap-3 ${seasonalBanner.style}`}>
          <span className="font-headline font-bold flex-shrink-0">{seasonalBanner.label}:</span>
          <span className="font-body">{seasonalBanner.message}</span>
        </div>
      )}

      {/* Property header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-headline font-bold text-on-surface mb-0.5">
              {property.display_address}
            </h1>
            <p className="text-sm text-on-surface-variant font-body">{property.jurisdiction_display}</p>
            {property.geocode_failed && (
              <form onSubmit={handleCoordsSubmit} className="mt-2 bg-primary-container/10 rounded-xl px-4 py-3">
                <p className="text-xs text-on-primary-container mb-1.5 font-body">
                  Address could not be precisely located. Drop a pin in Google Maps, copy the coordinates, and paste them here:
                </p>
                <div className="flex gap-2">
                  <input
                    value={coordsInput}
                    onChange={(e) => setCoordsInput(e.target.value)}
                    placeholder="42.1946,-122.7095"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs text-on-primary rounded-lg font-headline font-bold transition-colors"
                    style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
                  >
                    Update location
                  </button>
                </div>
                {coordsError && <p className="text-xs text-error mt-1 font-body">{coordsError}</p>}
              </form>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href={`/chat?profile=${property.property_profile_id}`}
              className="px-4 py-2 text-on-primary rounded-xl text-sm font-headline font-bold hover:opacity-90 transition-all"
              style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
            >
              Ask a question \u2192
            </Link>
            <Link
              href={`/plants?jurisdiction=${property.jurisdiction_code}`}
              className="px-4 py-2 bg-surface-container-high text-on-surface rounded-xl text-sm font-headline font-medium hover:bg-surface-container transition-colors"
            >
              Plant search
            </Link>
          </div>
        </div>

        {/* Jurisdiction chain */}
        {property.jurisdiction_chain.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {property.jurisdiction_chain.map((j) => (
              <span
                key={j}
                className="text-xs bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-lg font-body"
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
      <div className="mt-4 p-4 bg-surface-container-low rounded-2xl text-sm text-on-surface-variant font-body">
        <span className="font-headline font-semibold text-on-surface">How to use:</span> Select a zone from the
        panel on the right to see prioritized actions. Start with Layer 0 (the
        house itself) &mdash; it&apos;s where most homes are lost.
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12 text-center text-on-surface-variant font-body">Loading map\u2026</div>}>
      <MapInner />
    </Suspense>
  );
}
