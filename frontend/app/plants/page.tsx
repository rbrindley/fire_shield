"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import CitationLink from "@/components/CitationLink";
import type { jsPDF as JsPDFType } from "jspdf";

interface Plant {
  id: string;
  common_name: string;
  scientific_name?: string;
  plant_type?: string;
  zone_0_5ft: boolean;
  zone_5_30ft: boolean;
  zone_30_100ft: boolean;
  zone_100ft_plus: boolean;
  water_need?: string;
  is_native: boolean;
  deer_resistant: boolean;
  pollinator_support: boolean;
  sun?: string;
  mature_height_min_ft?: number;
  mature_height_max_ft?: number;
  fire_behavior_notes?: string;
  placement_notes?: string;
  ashland_restricted: boolean;
  ashland_restriction_type?: string;
  is_noxious_weed: boolean;
  primary_image_url?: string;
  source_url?: string;
}

const ZONE_LABELS: Record<string, string> = {
  zone_0_5ft: "0–5 ft",
  zone_5_30ft: "5–30 ft",
  zone_30_100ft: "30–100 ft",
  zone_100ft_plus: "100+ ft",
};

const WATER_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-sky-100 text-sky-800",
};

function PlantsInner() {
  const searchParams = useSearchParams();
  const jurisdictionFromUrl = searchParams.get("jurisdiction") ?? "";

  const [query, setQuery] = useState("");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const [filterZone, setFilterZone] = useState("");
  const [filterNative, setFilterNative] = useState(false);
  const [filterDeer, setFilterDeer] = useState(false);
  const [filterPollinator, setFilterPollinator] = useState(false);

  async function search() {
    setLoading(true);
    setHasSearched(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (filterZone) params.set("zone", filterZone);
    if (filterNative) params.set("native", "true");
    if (filterDeer) params.set("deer_resistant", "true");
    if (filterPollinator) params.set("pollinator_support", "true");
    params.set("limit", "20");

    try {
      const res = await fetch(`${apiUrl}/api/plants/search?${params}`);
      const data = await res.json();
      setPlants(data.plants ?? []);
    } catch {
      setPlants([]);
    } finally {
      setLoading(false);
    }
  }

  // Load all on mount
  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoneKeys = ["zone_0_5ft", "zone_5_30ft", "zone_30_100ft", "zone_100ft_plus"] as const;

  const getZones = useCallback((p: Plant) => {
    return zoneKeys.filter((k) => p[k]).map((k) => ZONE_LABELS[k]).join(", ");
  }, []);

  function exportCSV() {
    const header = "Common Name,Scientific Name,Type,Zones,Water Need,Native,Deer Resistant,Fire Behavior Notes\n";
    const rows = plants
      .map((p) =>
        [
          `"${p.common_name}"`,
          `"${p.scientific_name ?? ""}"`,
          p.plant_type ?? "",
          `"${getZones(p)}"`,
          p.water_need ?? "",
          p.is_native ? "Yes" : "No",
          p.deer_resistant ? "Yes" : "No",
          `"${(p.fire_behavior_notes ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fire-shield-plants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" }) as JsPDFType & { lastAutoTable: { finalY: number } };
    doc.setFontSize(18);
    doc.text("Fire Shield — Fire-Resistant Plants", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated ${new Date().toLocaleDateString()}${jurisdictionFromUrl ? ` · ${jurisdictionFromUrl}` : ""}`, 14, 25);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 30,
      head: [["Common Name", "Scientific Name", "Type", "Zones", "Water", "Native", "Deer Res.", "Fire Notes"]],
      body: plants.map((p) => [
        p.common_name,
        p.scientific_name ?? "",
        p.plant_type ?? "",
        getZones(p),
        p.water_need ?? "",
        p.is_native ? "Yes" : "",
        p.deer_resistant ? "Yes" : "",
        (p.fire_behavior_notes ?? "").slice(0, 80) + ((p.fire_behavior_notes?.length ?? 0) > 80 ? "…" : ""),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [234, 88, 12] },
    });

    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      "Source: Living with Fire plant database. Consult a local nursery for site-specific advice.",
      14,
      doc.lastAutoTable.finalY + 8,
    );

    doc.save(`fire-shield-plants-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Fire-Resistant Plants</h1>
      <p className="text-stone-500 text-sm mb-5">
        Sourced from the Living with Fire plant database. Tap a plant for zone guidance.
        {jurisdictionFromUrl && (
          <span className="ml-1 text-stone-400">· Jurisdiction: {jurisdictionFromUrl}</span>
        )}
      </p>

      {/* Search and filters */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 mb-5">
        <div className="flex gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder='Try "natives near the house" or "low water shrub"'
            className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={search}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">All zones</option>
            {Object.entries(ZONE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {[
            { key: "native", label: "Oregon native", state: filterNative, set: setFilterNative },
            { key: "deer", label: "Deer resistant", state: filterDeer, set: setFilterDeer },
            { key: "pollinator", label: "Pollinator support", state: filterPollinator, set: setFilterPollinator },
          ].map(({ key, label, state, set }) => (
            <button
              key={key}
              onClick={() => set(!state)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                state
                  ? "bg-orange-600 text-white border-orange-600"
                  : "border-stone-300 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Export buttons */}
      {plants.length > 0 && !loading && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 text-sm border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="px-3 py-1.5 text-sm border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Export PDF
          </button>
          <span className="text-xs text-stone-400 self-center">{plants.length} plants</span>
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="text-center text-stone-400 py-12">Loading plants…</div>
      )}

      {!loading && hasSearched && plants.length === 0 && (
        <div className="text-center text-stone-400 py-12">
          No plants found. Try removing some filters.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {plants.map((plant) => (
          <div
            key={plant.id}
            className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 hover:border-orange-300 transition-colors"
          >
            {/* Name + type */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-semibold text-stone-900">{plant.common_name}</h3>
                {plant.scientific_name && (
                  <p className="text-xs text-stone-500 italic">{plant.scientific_name}</p>
                )}
              </div>
              {plant.plant_type && (
                <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded capitalize flex-shrink-0">
                  {plant.plant_type}
                </span>
              )}
            </div>

            {/* Zone eligibility */}
            <div className="flex flex-wrap gap-1 mb-2">
              {zoneKeys.map((k) => (
                plant[k] ? (
                  <span
                    key={k}
                    className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-medium"
                  >
                    {ZONE_LABELS[k]}
                  </span>
                ) : null
              ))}
            </div>

            {/* Traits row */}
            <div className="flex flex-wrap gap-1 mb-2">
              {plant.water_need && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${WATER_COLORS[plant.water_need] ?? "bg-stone-100 text-stone-600"}`}>
                  💧 {plant.water_need}
                </span>
              )}
              {plant.is_native && (
                <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                  🌿 OR native
                </span>
              )}
              {plant.deer_resistant && (
                <span className="text-xs bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded">
                  🦌 Deer resistant
                </span>
              )}
              {plant.pollinator_support && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                  🐝 Pollinator
                </span>
              )}
              {plant.sun && (
                <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded capitalize">
                  ☀ {plant.sun}
                </span>
              )}
            </div>

            {/* Warnings */}
            {plant.ashland_restricted && (
              <div className="mb-2 text-xs bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded">
                ⚠ Ashland restricted
                {plant.ashland_restriction_type && ` (${plant.ashland_restriction_type})`}
              </div>
            )}
            {plant.is_noxious_weed && (
              <div className="mb-2 text-xs bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded">
                🚫 Oregon noxious weed — do not plant
              </div>
            )}

            {/* Fire notes */}
            {plant.fire_behavior_notes && (
              <p className="text-xs text-stone-600 mb-2 leading-relaxed">
                {plant.fire_behavior_notes}
              </p>
            )}

            {/* Height */}
            {plant.mature_height_max_ft && (
              <p className="text-xs text-stone-400">
                Height: {plant.mature_height_min_ft ?? "?"} – {plant.mature_height_max_ft} ft
              </p>
            )}

            {/* Links */}
            <div className="mt-2 flex items-center gap-2">
              {plant.source_url && (
                <CitationLink
                  citation="Living with Fire"
                  type="structured_data"
                  url={plant.source_url}
                />
              )}
              <a
                href={`https://www.naturehills.com/catalogsearch/result/?q=${encodeURIComponent(plant.common_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded hover:bg-green-100 transition-colors"
              >
                Find at nursery
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlantsPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12 text-center text-stone-400">Loading plants…</div>}>
      <PlantsInner />
    </Suspense>
  );
}
