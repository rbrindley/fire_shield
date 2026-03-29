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

// Zone ring config: [radius_meters, label, color, fill_opacity]
const ZONE_RINGS = [
  { meters: 1.5, label: "0–5 ft", color: "#dc2626", fillColor: "#fca5a5" },   // Layer 1
  { meters: 9.1, label: "5–30 ft", color: "#ea580c", fillColor: "#fdba74" },  // Layer 2
  { meters: 30.5, label: "30–100 ft", color: "#ca8a04", fillColor: "#fde047" }, // Layer 3
  { meters: 100, label: "100+ ft", color: "#65a30d", fillColor: "#bbf7d0" },  // Layer 4
];

export default function HIZMap({ lat, lng, jurisdictionDisplay, profileId }: HIZMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);
  const [zoneData, setZoneData] = useState<ZoneData | null>(null);
  const [loadingZones, setLoadingZones] = useState(true);

  // Fetch zone actions
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
    fetch(`${apiUrl}/api/zones/`)
      .then((r) => r.json())
      .then(setZoneData)
      .catch(console.error)
      .finally(() => setLoadingZones(false));
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (typeof window === "undefined") return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      import("@turf/turf").then((turf) => {
        // Fix Leaflet default icon path issue in Next.js
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(mapRef.current!).setView([lat, lng], 18);
        mapInstanceRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Property marker
        L.marker([lat, lng])
          .addTo(map)
          .bindPopup(`<strong>Your Property</strong><br/>${jurisdictionDisplay}`)
          .openPopup();

        // Draw HIZ rings using Turf.js buffers (outermost first so inner rings render on top)
        const point = turf.point([lng, lat]);
        [...ZONE_RINGS].reverse().forEach((ring, i) => {
          const layerIndex = ZONE_RINGS.length - 1 - i; // reverse index
          const buffered = turf.buffer(point, ring.meters, { units: "meters" });
          if (!buffered) return;

          const geoLayer = L.geoJSON(buffered as GeoJSON.GeoJsonObject, {
            style: {
              color: ring.color,
              weight: 2,
              fillColor: ring.fillColor,
              fillOpacity: 0.25,
            },
          });

          geoLayer.on("click", () => {
            setSelectedLayer(layerIndex + 1); // layers 1-4 (layer 0 = house itself)
          });

          geoLayer.addTo(map);

          // Zone label
          const center = turf.center(buffered);
          const [cLng, cLat] = center.geometry.coordinates;
          L.tooltip({
            permanent: true,
            direction: "center",
            className: "zone-label",
          })
            .setContent(ring.label)
            .setLatLng([cLat - (i * 0.00004), cLng])
            .addTo(map);
        });
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const selectedLayerData = zoneData?.layers.find((l) => l.layer === selectedLayer);

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Map */}
      <div className="flex-1 relative">
        {/* Leaflet CSS */}
        <style>{`
          @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
          .zone-label {
            background: white;
            border: none;
            box-shadow: none;
            font-size: 11px;
            font-weight: 600;
            color: #57534e;
            white-space: nowrap;
          }
        `}</style>
        <div
          ref={mapRef}
          className="w-full h-full rounded-xl border border-stone-200 shadow-sm overflow-hidden"
        />
        {/* Ring legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg shadow p-3 text-xs z-[1000]">
          <p className="font-semibold text-stone-700 mb-1.5">Click a zone</p>
          {ZONE_RINGS.map((r, i) => (
            <div key={r.label} className="flex items-center gap-1.5 mb-1">
              <span
                className="w-3 h-3 rounded-full border flex-shrink-0"
                style={{ backgroundColor: r.fillColor, borderColor: r.color }}
              />
              <span className="text-stone-600">
                Layer {i + 1}: {r.label}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-stone-900 flex-shrink-0" />
            <span className="text-stone-600">Layer 0: House</span>
          </div>
        </div>

        {/* House button */}
        <button
          onClick={() => setSelectedLayer(0)}
          className="absolute top-4 right-4 z-[1000] bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow hover:bg-red-700 transition-colors"
        >
          🏠 House (Layer 0)
        </button>
      </div>

      {/* Zone card panel */}
      <div className="w-80 overflow-y-auto">
        {selectedLayer === null ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 px-4">
            <div className="text-4xl mb-3">👆</div>
            <p className="font-medium">Click a zone ring or Layer 0</p>
            <p className="text-sm mt-1">to see prioritized actions for that zone</p>
          </div>
        ) : loadingZones ? (
          <div className="p-4 text-stone-500 text-sm">Loading actions…</div>
        ) : selectedLayerData ? (
          <ZoneCard
            layer={selectedLayerData}
            neighborNote={selectedLayer === 2 || selectedLayer === 3 ? zoneData?.neighbor_note : undefined}
            currentSeason={zoneData?.current_season ?? "spring"}
          />
        ) : null}
      </div>
    </div>
  );
}
