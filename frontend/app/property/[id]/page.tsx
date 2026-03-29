"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import ZoneCard from "@/components/ZoneCard";

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

interface ZoneAction {
  id: string;
  layer: number;
  layer_name: string;
  action_title: string;
  action_detail: string;
  why_it_matters: string;
  evidence_citation: string;
  effort_level: string;
  cost_estimate: string;
  time_estimate: string;
  is_seasonal_peak: boolean;
  effective_priority: number;
}

interface ZoneLayer {
  layer: number;
  layer_name: string;
  layer_description: string;
  actions: ZoneAction[];
}

interface ZoneData {
  layers: ZoneLayer[];
  neighbor_note: string;
  current_season: string;
  current_month: string;
}

const SEASON_BANNERS: Record<string, { label: string; message: string; color: string }> = {
  summer: {
    label: "Fire Season Active",
    message: "Peak fire risk. Focus on Layer 0 (structure) and Layer 1 (0–5 ft) actions immediately.",
    color: "bg-red-50 border-red-300 text-red-800",
  },
  spring: {
    label: "Spring Prep Window",
    message: "Ideal time to thin vegetation, clean gutters, and install vent screens before fire season.",
    color: "bg-amber-50 border-amber-300 text-amber-800",
  },
  fall: {
    label: "Post-Season Review",
    message: "Good time to assess what worked, clear remaining dead vegetation, and plan winter projects.",
    color: "bg-yellow-50 border-yellow-300 text-yellow-700",
  },
  winter: {
    label: "Winter Maintenance Window",
    message: "Lower fire risk — good time for tree work, structural improvements, and planning.",
    color: "bg-blue-50 border-blue-300 text-blue-800",
  },
};

export default function PropertyOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [zoneData, setZoneData] = useState<ZoneData | null>(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    // Try sessionStorage first
    const stored = sessionStorage.getItem("property");
    let resolved = false;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PropertyData;
        if (parsed.property_profile_id === id) {
          setProperty(parsed);
          resolved = true;
        }
      } catch {
        // ignore
      }
    }

    // Fetch from API if not in session
    if (!resolved) {
      fetch(`${apiUrl}/api/jurisdiction/profile/${id}`)
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
        .catch(console.error);
    }

    // Load zone actions
    fetch(`${apiUrl}/api/zones/`)
      .then((r) => r.json())
      .then(setZoneData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, apiUrl]);

  if (loading && !property) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-stone-400">
        Loading property…
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-stone-600 mb-4">Property not found.</p>
        <Link href="/" className="text-orange-600 underline">← Enter an address</Link>
      </div>
    );
  }

  const season = zoneData?.current_season ?? "spring";
  const seasonBanner = SEASON_BANNERS[season];

  // Top priority layers: Layer 0 + Layer 1 always shown; others by season
  const priorityLayers = zoneData?.layers.filter((l) =>
    season === "summer" ? l.layer <= 1 : l.layer <= 2
  ) ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Seasonal banner */}
      {seasonBanner && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm flex items-start gap-2 ${seasonBanner.color}`}>
          <span className="font-semibold flex-shrink-0">{seasonBanner.label}:</span>
          <span>{seasonBanner.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900 mb-0.5">
            {property.display_address}
          </h1>
          <p className="text-sm text-stone-500">{property.jurisdiction_display}</p>
          {property.jurisdiction_chain.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {property.jurisdiction_chain.map((j) => (
                <span key={j} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">
                  {j}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href={`/map?profile=${property.property_profile_id}`}
            className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
          >
            View map →
          </Link>
          <Link
            href={`/chat?profile=${property.property_profile_id}`}
            className="px-3 py-1.5 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Ask a question
          </Link>
          <Link
            href={`/plants?jurisdiction=${property.jurisdiction_code}`}
            className="px-3 py-1.5 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Plants
          </Link>
        </div>
      </div>

      {/* Priority zone cards */}
      {loading ? (
        <div className="text-center text-stone-400 py-12">Loading zone actions…</div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">
            {season === "summer" ? "Priority Actions — Fire Season" : "Priority Actions"}
          </h2>
          {priorityLayers.map((layer) => (
            <ZoneCard
              key={layer.layer}
              layer={layer}
              neighborNote={layer.layer === 2 ? zoneData?.neighbor_note : undefined}
              currentSeason={season}
            />
          ))}
          {zoneData && priorityLayers.length < zoneData.layers.length && (
            <Link
              href={`/map?profile=${property.property_profile_id}`}
              className="block text-center text-sm text-orange-600 underline py-2"
            >
              See all zones on the map →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
