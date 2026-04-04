"use client";

import { useEffect, useRef, useState } from "react";
import ZoneCard from "./ZoneCard";

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
  seasonal_boost: number;
}

interface Layer {
  layer: number;
  layer_name: string;
  layer_description: string;
  actions: ZoneAction[];
}

interface ZoneData {
  layers: Layer[];
  neighbor_note: string;
  current_season: string;
  jurisdiction_code: string;
}

interface HIZMapProps {
  lat: number;
  lng: number;
  jurisdictionDisplay: string;
  profileId: string;
}

// Zone ring config
const ZONE_RINGS = [
  { meters: 1.5, label: "0–5 ft", color: "#dc2626", fillColor: "#fca5a5" },   // Layer 1
  { meters: 9.1, label: "5–30 ft", color: "#ea580c", fillColor: "#fdba74" },  // Layer 2
  { meters: 30.5, label: "30–100 ft", color: "#ca8a04", fillColor: "#fde047" }, // Layer 3
  { meters: 100, label: "100+ ft", color: "#65a30d", fillColor: "#bbf7d0" },  // Layer 4
];

interface FootprintData {
  footprint: GeoJSON.Polygon | null;
  source: string | null;
}

export default function HIZMap({ lat, lng, jurisdictionDisplay, profileId }: HIZMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const zoneLayersRef = useRef<unknown[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);
  const [zoneData, setZoneData] = useState<ZoneData | null>(null);
  const [loadingZones, setLoadingZones] = useState(true);
  const [footprintData, setFootprintData] = useState<FootprintData>({ footprint: null, source: null });
  const [footprintLoading, setFootprintLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  // Fetch zone actions
  useEffect(() => {
    fetch(`${apiUrl}/api/zones/`)
      .then((r) => r.json())
      .then(setZoneData)
      .catch(console.error)
      .finally(() => setLoadingZones(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch building footprint
  useEffect(() => {
    setFootprintLoading(true);
    fetch(`${apiUrl}/api/buildings/footprint?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((data) => {
        setFootprintData({
          footprint: data.footprint ?? null,
          source: data.source ?? null,
        });
      })
      .catch(() => {
        setFootprintData({ footprint: null, source: null });
      })
      .finally(() => setFootprintLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    // Clean up any existing map first
    if (mapInstanceRef.current) {
      (mapInstanceRef.current as { remove: () => void }).remove();
      mapInstanceRef.current = null;
    }

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current).setView([lat, lng], 19);
      mapInstanceRef.current = map;

      // Base street map
      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 22,
        maxNativeZoom: 19,
      });

      // Satellite imagery (Esri)
      const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri",
        maxZoom: 22,
        maxNativeZoom: 19,
      });

      satellite.addTo(map);
      L.control.layers({ "Street": streets, "Satellite": satellite }, {}, { position: "topright" }).addTo(map);

      // Property marker
      L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`<strong>Your Property</strong><br/>${jurisdictionDisplay}`)
        .openPopup();
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Draw zone rings once map + footprint are both ready
  useEffect(() => {
    if (footprintLoading) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old zone layers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zoneLayersRef.current.forEach((l) => (map as any).removeLayer(l));
    zoneLayersRef.current = [];

    Promise.all([import("leaflet"), import("@turf/turf")]).then(([L, turf]) => {
      const geocodedPoint = turf.point([lng, lat]);

      // Check if footprint is close enough to geocoded point (within 50m)
      let useFootprint = false;
      if (footprintData.footprint) {
        const fpCentroid = turf.centroid(turf.feature(footprintData.footprint));
        const dist = turf.distance(geocodedPoint, fpCentroid, { units: "meters" });
        useFootprint = dist < 50;
      }

      // Zone rings always center on the geocoded point
      const ringBase = useFootprint
        ? turf.feature(footprintData.footprint!)
        : geocodedPoint;

      // Draw zone rings (outermost first so inner rings layer on top)
      [...ZONE_RINGS].reverse().forEach((ring, i) => {
        const layerIndex = ZONE_RINGS.length - 1 - i;
        const buffered = turf.buffer(ringBase, ring.meters, { units: "meters" });
        if (!buffered) return;

        const geoLayer = L.geoJSON(buffered as GeoJSON.GeoJsonObject, {
          style: {
            color: ring.color,
            weight: 2,
            fillColor: ring.fillColor,
            fillOpacity: 0.18,
          },
          interactive: true,
          bubblingMouseEvents: false,
        });

        geoLayer.on("click", () => {
          setSelectedLayer(layerIndex + 1);
        });
        geoLayer.on("mouseover", () => {
          geoLayer.setStyle({ fillOpacity: 0.35, weight: 3 });
        });
        geoLayer.on("mouseout", () => {
          geoLayer.setStyle({ fillOpacity: 0.18, weight: 2 });
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geoLayer.addTo(map as any);
        zoneLayersRef.current.push(geoLayer);
      });

      // Draw the building footprint itself (Layer 0 visual) — only if close to geocoded point
      if (footprintData.footprint && useFootprint) {
        const footprintLayer = L.geoJSON(footprintData.footprint as GeoJSON.GeoJsonObject, {
          style: {
            color: "#1e293b",
            fillColor: "#475569",
            fillOpacity: 0.5,
            weight: 2,
          },
          interactive: true,
          bubblingMouseEvents: false,
        });

        footprintLayer.on("click", () => {
          setSelectedLayer(0);
        });
        footprintLayer.on("mouseover", () => {
          footprintLayer.setStyle({ fillOpacity: 0.7, weight: 3 });
        });
        footprintLayer.on("mouseout", () => {
          footprintLayer.setStyle({ fillOpacity: 0.5, weight: 2 });
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        footprintLayer.addTo(map as any);
        zoneLayersRef.current.push(footprintLayer);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [footprintLoading, footprintData, lat, lng]);

  const selectedLayerData = zoneData?.layers.find((l) => l.layer === selectedLayer);

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Map */}
      <div className="flex-1 relative">
        {/* Leaflet CSS */}
        <style>{`@import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"); .leaflet-interactive { cursor: pointer !important; }`}</style>
        <div
          ref={mapRef}
          className="w-full h-full rounded-2xl shadow-[0_4px_24px_rgba(27,28,26,0.06)] overflow-hidden"
        />

        {/* Footprint source badge */}
        {footprintData.source && (
          <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur-xl rounded-xl shadow-sm px-3 py-2 text-xs text-on-surface-variant font-body z-[1000]">
            Building outline: {footprintData.source === "microsoft" ? "Microsoft" : "OpenStreetMap"}
          </div>
        )}
        {footprintLoading && (
          <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur-xl rounded-xl shadow-sm px-3 py-2 text-xs text-outline font-body z-[1000]">
            Loading building outline\u2026
          </div>
        )}
        {!footprintLoading && !footprintData.source && (
          <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur-xl rounded-xl shadow-sm px-3 py-2 text-xs text-outline font-body z-[1000]">
            No building footprint found \u2014 using point estimate
          </div>
        )}
      </div>

      {/* Zone key + action panel */}
      <div className="w-80 flex flex-col overflow-hidden">
        {/* Zone selector buttons */}
        <div className="flex flex-col gap-1.5 mb-3 flex-shrink-0">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-body">Select a zone</p>
          <button
            onClick={() => setSelectedLayer(0)}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-headline font-medium transition-colors text-left ${
              selectedLayer === 0
                ? "bg-inverse-surface text-inverse-on-surface"
                : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-inverse-surface flex-shrink-0" style={selectedLayer === 0 ? { backgroundColor: "#f2f0ed" } : undefined} />
            Layer 0: House
          </button>
          {ZONE_RINGS.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setSelectedLayer(i + 1)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-headline font-medium transition-colors text-left ${
                selectedLayer === i + 1
                  ? "text-white"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high"
              }`}
              style={selectedLayer === i + 1 ? { backgroundColor: r.color } : undefined}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: r.fillColor, border: `2px solid ${r.color}` }}
              />
              Layer {i + 1}: {r.label}
            </button>
          ))}
        </div>

        {/* Action card panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedLayer === null ? (
            <div className="flex flex-col items-center justify-center text-center text-outline px-4 py-8">
              <p className="text-sm font-body text-primary">Click on a zone above to see prioritized actions</p>
            </div>
          ) : loadingZones ? (
            <div className="p-4 text-on-surface-variant text-sm font-body">Loading actions\u2026</div>
          ) : selectedLayerData ? (
            <ZoneCard
              layer={selectedLayerData}
              neighborNote={selectedLayer === 2 || selectedLayer === 3 ? zoneData?.neighbor_note : undefined}
              currentSeason={zoneData?.current_season ?? "spring"}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
