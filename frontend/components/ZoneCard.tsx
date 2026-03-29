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
  zero_cost: { label: "Free", color: "bg-secondary-container text-on-secondary-container" },
  low: { label: "Low cost", color: "bg-secondary-container/60 text-on-secondary-container" },
  moderate: { label: "Moderate", color: "bg-primary-container/20 text-on-primary-container" },
  high: { label: "High effort", color: "bg-tertiary-container/20 text-on-tertiary-container" },
};

export default function ZoneCard({ layer, neighborNote, currentSeason }: ZoneCardProps) {
  const isFireSeason = currentSeason === "summer";

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-body">
            Layer {layer.layer}
          </span>
          {isFireSeason && layer.layer <= 1 && (
            <span className="text-xs bg-tertiary text-on-tertiary px-2.5 py-0.5 rounded-full font-bold font-headline">
              Fire Season Priority
            </span>
          )}
        </div>
        <h2 className="font-headline font-bold text-on-surface text-lg leading-snug">{layer.layer_name}</h2>
        <p className="text-sm text-on-surface-variant mt-1 leading-snug font-body">{layer.layer_description}</p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {layer.actions.map((action, i) => {
          const effort = EFFORT_LABELS[action.effort_level] ?? EFFORT_LABELS.low;
          return (
            <div
              key={action.id}
              className="bg-surface-container-low rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-outline mt-0.5 font-body">
                    #{i + 1}
                  </span>
                  <p className="text-sm font-headline font-semibold text-on-surface leading-snug">
                    {action.action_title}
                  </p>
                </div>
                {action.is_seasonal_peak && (
                  <span className="flex-shrink-0 text-xs bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-bold">
                    Now
                  </span>
                )}
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed mb-3 font-body">
                {action.why_it_matters}
              </p>

              <div className="flex flex-wrap gap-1.5 items-center mb-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${effort.color}`}>
                  {effort.label}
                </span>
                {action.cost_estimate && (
                  <span className="text-xs text-on-surface-variant font-body">{action.cost_estimate}</span>
                )}
                {action.time_estimate && (
                  <span className="text-xs text-outline font-body">&middot; {action.time_estimate}</span>
                )}
              </div>

              <CitationLink citation={action.evidence_citation} type="retrieved_document" />
            </div>
          );
        })}
      </div>

      {/* Neighbor note */}
      {neighborNote && (
        <div className="mt-4 p-3 bg-secondary-container/20 rounded-xl">
          <p className="text-xs text-on-secondary-container leading-relaxed font-body">
            <span className="font-headline font-bold">Neighbor impact:</span> {neighborNote}
          </p>
        </div>
      )}
    </div>
  );
}
