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
  roof_type?: string | null;
  siding_type?: string | null;
  has_deck?: boolean | null;
  has_attached_fence?: boolean | null;
  slope_category?: string | null;
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

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
            roof_type: data.roof_type ?? null,
            siding_type: data.siding_type ?? null,
            has_deck: data.has_deck ? true : data.has_deck === 0 ? false : null,
            has_attached_fence: data.has_attached_fence ? true : data.has_attached_fence === 0 ? false : null,
            slope_category: data.slope_category ?? null,
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

      {/* Property profile */}
      <div className="mb-6 border border-stone-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setProfileOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-stone-50 hover:bg-stone-100 transition-colors text-sm font-medium text-stone-700"
        >
          <span>About your property</span>
          <span className="text-stone-400">{profileOpen ? "−" : "+"}</span>
        </button>
        {profileOpen && (
          <form
            className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!property) return;
              setSaving(true);
              const form = e.currentTarget;
              const body: Record<string, unknown> = {};
              const roofVal = (form.elements.namedItem("roof_type") as HTMLSelectElement).value;
              const sidingVal = (form.elements.namedItem("siding_type") as HTMLSelectElement).value;
              const slopeVal = (form.elements.namedItem("slope_category") as HTMLSelectElement).value;
              const deckVal = (form.elements.namedItem("has_deck") as HTMLInputElement).checked;
              const fenceVal = (form.elements.namedItem("has_attached_fence") as HTMLInputElement).checked;
              if (roofVal) body.roof_type = roofVal;
              if (sidingVal) body.siding_type = sidingVal;
              if (slopeVal) body.slope_category = slopeVal;
              body.has_deck = deckVal;
              body.has_attached_fence = fenceVal;
              try {
                const res = await fetch(
                  `${apiUrl}/api/jurisdiction/profile/${property.property_profile_id}`,
                  { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
                );
                if (res.ok) {
                  const data = await res.json();
                  setProperty((p) => p ? { ...p, roof_type: data.roof_type, siding_type: data.siding_type, has_deck: !!data.has_deck, has_attached_fence: !!data.has_attached_fence, slope_category: data.slope_category } : p);
                }
              } catch { /* ignore */ }
              setSaving(false);
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-stone-600">Roof type</span>
              <select name="roof_type" defaultValue={property.roof_type ?? ""} className="border border-stone-300 rounded px-2 py-1.5 bg-white">
                <option value="">Unknown</option>
                <option value="asphalt_shingle">Asphalt shingle</option>
                <option value="metal">Metal</option>
                <option value="tile">Tile / clay</option>
                <option value="wood_shake">Wood shake</option>
                <option value="slate">Slate</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-stone-600">Siding type</span>
              <select name="siding_type" defaultValue={property.siding_type ?? ""} className="border border-stone-300 rounded px-2 py-1.5 bg-white">
                <option value="">Unknown</option>
                <option value="fiber_cement">Fiber cement</option>
                <option value="stucco">Stucco</option>
                <option value="brick">Brick / stone</option>
                <option value="vinyl">Vinyl</option>
                <option value="wood">Wood</option>
                <option value="metal">Metal</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-stone-600">Slope category</span>
              <select name="slope_category" defaultValue={property.slope_category ?? ""} className="border border-stone-300 rounded px-2 py-1.5 bg-white">
                <option value="">Unknown</option>
                <option value="flat">Flat (0–5%)</option>
                <option value="moderate">Moderate (5–20%)</option>
                <option value="steep">Steep (20–40%)</option>
                <option value="very_steep">Very steep (40%+)</option>
              </select>
            </label>
            <div className="flex flex-col gap-2 justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="has_deck" defaultChecked={!!property.has_deck} className="rounded border-stone-300" />
                <span className="text-stone-600">Has attached deck</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="has_attached_fence" defaultChecked={!!property.has_attached_fence} className="rounded border-stone-300" />
                <span className="text-stone-600">Has attached fence</span>
              </label>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        )}
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
              neighborNote={layer.layer === 2 || layer.layer === 3 ? zoneData?.neighbor_note : undefined}
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
