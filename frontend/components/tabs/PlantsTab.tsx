"use client";

import { useState, useEffect, useCallback } from "react";

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
  fire_behavior_notes?: string;
  primary_image_url?: string;
}

const ZONE_LABELS: Record<string, string> = {
  zone_0_5ft: "0\u20135 ft",
  zone_5_30ft: "5\u201330 ft",
  zone_30_100ft: "30\u2013100 ft",
  zone_100ft_plus: "100+ ft",
};

interface PlantsTabProps {
  jurisdictionCode?: string;
}

export default function PlantsTab({ jurisdictionCode }: PlantsTabProps) {
  const [query, setQuery] = useState("");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterZone, setFilterZone] = useState("");
  const [filterNative, setFilterNative] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (filterZone) params.set("zone", filterZone);
    if (filterNative) params.set("native", "true");
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
  }, [apiUrl, query, filterZone, filterNative]);

  useEffect(() => {
    search();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const zoneKeys = ["zone_0_5ft", "zone_5_30ft", "zone_30_100ft", "zone_100ft_plus"] as const;
  const getZones = (p: Plant) => zoneKeys.filter((k) => p[k]).map((k) => ZONE_LABELS[k]).join(", ");

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Search */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search plants..."
          className="flex-1 px-3 py-2 rounded-lg bg-surface-container-low text-sm text-on-surface placeholder:text-outline/60 font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          onClick={search}
          className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-headline hover:opacity-90"
        >
          Search
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterZone}
          onChange={(e) => setFilterZone(e.target.value)}
          className="text-xs bg-surface-container-low rounded-lg px-3 py-1.5 font-body text-on-surface-variant"
        >
          <option value="">All zones</option>
          {Object.entries(ZONE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          onClick={() => setFilterNative(!filterNative)}
          className={`text-xs px-3 py-1.5 rounded-lg font-body ${
            filterNative
              ? "bg-secondary text-on-secondary"
              : "bg-surface-container-low text-on-surface-variant"
          }`}
        >
          Native
        </button>
        {plants.length > 0 && !loading && (
          <span className="text-xs text-outline ml-auto self-center">{plants.length} species</span>
        )}
      </div>

      {loading && <div className="text-center text-on-surface-variant py-8 text-sm font-body">Loading plants\u2026</div>}

      {/* Plant grid — 2 columns for embedded view */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.map((plant) => (
          <div key={plant.id} className="bg-surface-container-lowest rounded-xl overflow-hidden flex flex-col">
            {plant.primary_image_url ? (
              <div className="relative h-36 overflow-hidden bg-surface-container-low">
                <img src={plant.primary_image_url} alt={plant.common_name} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-secondary text-on-secondary text-[9px] font-bold uppercase rounded-full">
                  {getZones(plant) || "All zones"}
                </span>
              </div>
            ) : (
              <div className="relative h-20 bg-surface-container-low flex items-center justify-center">
                <svg className="w-8 h-8 text-outline-variant/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-secondary text-on-secondary text-[9px] font-bold uppercase rounded-full">
                  {getZones(plant) || "All zones"}
                </span>
              </div>
            )}
            <div className="p-3">
              <h3 className="text-sm font-headline font-bold text-on-surface">{plant.common_name}</h3>
              {plant.scientific_name && (
                <p className="italic text-on-surface-variant font-body text-xs">{plant.scientific_name}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {plant.water_need && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant uppercase font-bold">
                    {plant.water_need} water
                  </span>
                )}
                {plant.is_native && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container uppercase font-bold">
                    Native
                  </span>
                )}
              </div>
              {plant.fire_behavior_notes && (
                <p className="text-xs text-on-surface-variant mt-2 line-clamp-2 font-body">{plant.fire_behavior_notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
