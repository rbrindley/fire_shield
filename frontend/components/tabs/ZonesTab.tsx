"use client";

import { useState, useEffect } from "react";
import ZoneCard from "@/components/ZoneCard";

interface Layer {
  layer: number;
  layer_name: string;
  layer_description: string;
  actions: Array<{
    id: string;
    layer: number;
    action_title: string;
    action_detail: string;
    why_it_matters: string;
    evidence_citation: string;
    effort_level: string;
    cost_estimate: string;
    time_estimate: string;
    is_seasonal_peak: boolean;
    effective_priority: number;
  }>;
}

interface ZonesTabProps {
  jurisdictionCode?: string;
}

export default function ZonesTab({ jurisdictionCode }: ZonesTabProps) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(true);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  useEffect(() => {
    const jc = jurisdictionCode ?? "jackson_county";
    fetch(`${apiUrl}/api/zones/?jurisdiction=${jc}`)
      .then((r) => r.json())
      .then((data) => setLayers(data.layers ?? []))
      .catch(() => setLayers([]))
      .finally(() => setLoading(false));
  }, [apiUrl, jurisdictionCode]);

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant text-sm font-body">Loading zone actions\u2026</div>;
  }

  if (layers.length === 0) {
    return <div className="p-8 text-center text-on-surface-variant text-sm font-body">No zone actions found.</div>;
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div>
        <h2 className="font-headline font-bold text-on-surface text-lg">Defensible Space Zones</h2>
        <p className="text-xs text-on-surface-variant font-body mt-1">
          Prioritized actions for each zone layer around your home.
        </p>
      </div>
      {layers.map((layer) => (
        <ZoneCard key={layer.layer} layer={layer} />
      ))}
    </div>
  );
}
