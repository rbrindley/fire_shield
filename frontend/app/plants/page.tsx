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
  zone_0_5ft: "0\u20135 ft",
  zone_5_30ft: "5\u201330 ft",
  zone_30_100ft: "30\u2013100 ft",
  zone_100ft_plus: "100+ ft",
};

const WATER_COLORS: Record<string, string> = {
  low: "bg-secondary-container text-on-secondary-container",
  medium: "bg-surface-container-high text-on-surface-variant",
  high: "bg-primary-container/20 text-on-primary-container",
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
    doc.text("Fire Shield \u2014 Fire-Resistant Plants", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated ${new Date().toLocaleDateString()}${jurisdictionFromUrl ? ` \u00b7 ${jurisdictionFromUrl}` : ""}`, 14, 25);
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
        (p.fire_behavior_notes ?? "").slice(0, 80) + ((p.fire_behavior_notes?.length ?? 0) > 80 ? "\u2026" : ""),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [121, 89, 0] },
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-secondary font-body text-xs font-bold tracking-widest uppercase mb-2 block">
            Vegetation Management
          </span>
          <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight text-on-surface">
            The Digital Flora Guide
          </h1>
          <p className="mt-3 text-lg text-on-surface-variant max-w-2xl font-body">
            Browse fire-resilient plant species tailored to your local micro-climate and defensible space requirements.
            {jurisdictionFromUrl && (
              <span className="ml-1 text-outline"> \u00b7 {jurisdictionFromUrl}</span>
            )}
          </p>
        </div>
        {plants.length > 0 && !loading && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-6 py-3 bg-surface-container-high rounded-xl text-on-surface font-headline text-sm hover:bg-surface-container transition-colors active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              CSV
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-6 py-3 bg-surface-container-high rounded-xl text-on-surface font-headline text-sm hover:bg-surface-container transition-colors active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              PDF
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <div className="relative">
          <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-primary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder='Try "natives for pollinators near the house"'
            className="w-full pl-14 pr-32 py-5 bg-surface-container-lowest rounded-2xl shadow-[0_4px_24px_rgba(27,28,26,0.04)] border-none focus:ring-2 focus:ring-primary/20 text-lg font-body placeholder:text-on-surface-variant/40 outline-none"
          />
          <div className="absolute inset-y-0 right-2 flex items-center">
            <button
              onClick={search}
              className="h-[calc(100%-0.5rem)] px-6 bg-secondary text-on-secondary rounded-xl font-headline text-sm flex items-center gap-2 hover:opacity-90 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-8">
        <select
          value={filterZone}
          onChange={(e) => setFilterZone(e.target.value)}
          className="text-sm bg-surface-container-low rounded-xl px-4 py-2.5 font-body text-on-surface-variant border-none outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All zones</option>
          {Object.entries(ZONE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
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
            className={`text-sm px-4 py-2.5 rounded-xl font-body transition-colors ${
              state
                ? "bg-secondary text-on-secondary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {label}
          </button>
        ))}

        {plants.length > 0 && !loading && (
          <span className="text-xs text-outline ml-auto">{plants.length} species</span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center text-on-surface-variant py-16 font-body">Loading plants\u2026</div>
      )}

      {/* Empty */}
      {!loading && hasSearched && plants.length === 0 && (
        <div className="text-center text-on-surface-variant py-16 font-body">
          No plants found. Try removing some filters.
        </div>
      )}

      {/* Plant grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {plants.map((plant) => (
          <div
            key={plant.id}
            className="bg-surface-container-lowest rounded-2xl overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300"
          >
            {/* Image area */}
            {plant.primary_image_url ? (
              <div className="relative h-56 overflow-hidden bg-surface-container-low">
                <img
                  src={plant.primary_image_url}
                  alt={plant.common_name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Zone badge */}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-secondary text-on-secondary text-[10px] font-bold tracking-widest uppercase rounded-full">
                    {getZones(plant) || "All zones"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative h-32 bg-surface-container-low flex items-center justify-center">
                <svg className="w-12 h-12 text-outline-variant/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-secondary text-on-secondary text-[10px] font-bold tracking-widest uppercase rounded-full">
                    {getZones(plant) || "All zones"}
                  </span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="p-6 flex-1 flex flex-col">
              <div className="mb-4">
                <h3 className="text-xl font-headline font-bold text-on-surface">{plant.common_name}</h3>
                {plant.scientific_name && (
                  <p className="italic text-on-surface-variant font-body text-sm">{plant.scientific_name}</p>
                )}
              </div>

              {/* Trait badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {plant.water_need && (
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-tight ${WATER_COLORS[plant.water_need] ?? "bg-surface-container-low text-on-surface-variant"}`}>
                    {plant.water_need}
                  </span>
                )}
                {plant.sun && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low rounded-lg text-xs font-bold uppercase tracking-tight text-on-surface-variant capitalize">
                    {plant.sun}
                  </span>
                )}
                {plant.is_native && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-container text-on-secondary-container rounded-lg text-xs font-bold uppercase tracking-tight">
                    Native
                  </span>
                )}
                {plant.deer_resistant && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low rounded-lg text-xs font-bold uppercase tracking-tight text-on-surface-variant">
                    Deer resistant
                  </span>
                )}
                {plant.pollinator_support && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-container text-on-secondary-container rounded-lg text-xs font-bold uppercase tracking-tight">
                    Pollinators
                  </span>
                )}
              </div>

              {/* Warnings */}
              {plant.ashland_restricted && (
                <div className="mb-3 text-xs bg-error-container text-on-tertiary-container px-3 py-2 rounded-lg">
                  Ashland restricted{plant.ashland_restriction_type && ` (${plant.ashland_restriction_type})`}
                </div>
              )}
              {plant.is_noxious_weed && (
                <div className="mb-3 text-xs bg-error-container text-on-tertiary-container px-3 py-2 rounded-lg">
                  Oregon noxious weed \u2014 do not plant
                </div>
              )}

              {/* Fire behavior note */}
              {plant.fire_behavior_notes && (
                <div className="p-4 bg-tertiary-container/10 border-l-4 border-tertiary rounded-r-lg mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-tertiary">Fire Behavior Note</span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-snug font-body">
                    {plant.fire_behavior_notes}
                  </p>
                </div>
              )}

              {/* Height */}
              {plant.mature_height_max_ft && (
                <p className="text-xs text-outline mb-4 font-body">
                  Mature height: {plant.mature_height_min_ft ?? "?"}\u2013{plant.mature_height_max_ft} ft
                </p>
              )}

              {/* Bottom actions */}
              <div className="mt-auto pt-4 border-t border-outline-variant/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {plant.source_url && (
                    <CitationLink
                      citation="Living with Fire"
                      type="structured_data"
                      url={plant.source_url}
                    />
                  )}
                </div>
                <a
                  href={`https://www.naturehills.com/catalogsearch/result/?q=${encodeURIComponent(plant.common_name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-primary-container text-on-primary-container rounded-lg font-headline text-xs font-bold flex items-center gap-2 active:scale-95 transition-all hover:opacity-90"
                >
                  Buy from Nursery
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlantsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-16 text-center text-on-surface-variant font-body">Loading plants\u2026</div>}>
      <PlantsInner />
    </Suspense>
  );
}
