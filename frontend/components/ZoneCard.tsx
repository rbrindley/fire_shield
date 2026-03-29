import CitationLink from "./CitationLink";

interface ZoneAction {
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
}

interface Layer {
  layer: number;
  layer_name: string;
  layer_description: string;
  actions: ZoneAction[];
}

interface ZoneCardProps {
  layer: Layer;
  neighborNote?: string;
  currentSeason?: string;
}

const EFFORT_LABELS: Record<string, { label: string; color: string }> = {
  zero_cost: { label: "Free", color: "bg-green-100 text-green-800" },
  low: { label: "Low cost", color: "bg-blue-100 text-blue-800" },
  moderate: { label: "Moderate", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "High effort", color: "bg-red-100 text-red-800" },
};

const LAYER_COLORS: Record<number, { ring: string; bg: string }> = {
  0: { ring: "border-red-600", bg: "bg-red-50" },
  1: { ring: "border-red-500", bg: "bg-orange-50" },
  2: { ring: "border-orange-500", bg: "bg-amber-50" },
  3: { ring: "border-yellow-500", bg: "bg-yellow-50" },
  4: { ring: "border-green-500", bg: "bg-green-50" },
};

export default function ZoneCard({ layer, neighborNote, currentSeason }: ZoneCardProps) {
  const colors = LAYER_COLORS[layer.layer] ?? LAYER_COLORS[4];
  const isFireSeason = currentSeason === "summer";

  return (
    <div className={`rounded-xl border-2 ${colors.ring} ${colors.bg} p-4`}>
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Layer {layer.layer}
          </span>
          {isFireSeason && layer.layer <= 1 && (
            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold">
              🔥 Fire Season Priority
            </span>
          )}
        </div>
        <h2 className="font-bold text-stone-900 text-base leading-snug">{layer.layer_name}</h2>
        <p className="text-xs text-stone-600 mt-0.5 leading-snug">{layer.layer_description}</p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {layer.actions.map((action, i) => {
          const effort = EFFORT_LABELS[action.effort_level] ?? EFFORT_LABELS.low;
          return (
            <div
              key={action.id}
              className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-stone-400 mt-0.5">
                    #{i + 1}
                  </span>
                  <p className="text-sm font-semibold text-stone-900 leading-snug">
                    {action.action_title}
                  </p>
                </div>
                {action.is_seasonal_peak && (
                  <span className="flex-shrink-0 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                    Now
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-600 leading-relaxed mb-2">
                {action.why_it_matters}
              </p>

              <div className="flex flex-wrap gap-1.5 items-center mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${effort.color}`}>
                  {effort.label}
                </span>
                {action.cost_estimate && (
                  <span className="text-xs text-stone-500">{action.cost_estimate}</span>
                )}
                {action.time_estimate && (
                  <span className="text-xs text-stone-400">· {action.time_estimate}</span>
                )}
              </div>

              <CitationLink citation={action.evidence_citation} type="retrieved_document" />
            </div>
          );
        })}
      </div>

      {/* Neighbor note for Layer 2 */}
      {neighborNote && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800 leading-relaxed">
            <span className="font-semibold">🏘 Neighbor impact:</span> {neighborNote}
          </p>
        </div>
      )}
    </div>
  );
}
