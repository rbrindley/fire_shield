"use client";

import { useState, useEffect } from "react";

interface ZoneAction {
  id: string;
  layer: number;
  layer_name: string;
  rank_in_layer: number;
  action_title: string;
  action_detail: string;
  why_it_matters: string;
  evidence_citation: string;
  effort_level: string;
  cost_estimate?: string;
  time_estimate?: string;
  seasonal_peak?: string;
  priority_score: number;
  neighbor_effect: number;
}

const LAYER_NAMES: Record<number, string> = {
  0: "Layer 0 — The Structure",
  1: "Layer 1 — 0–5 ft Zone",
  2: "Layer 2 — 5–30 ft Zone",
  3: "Layer 3 — 30–100 ft Zone",
  4: "Layer 4 — 100+ ft Zone",
};

const LAYER_COLORS: Record<number, string> = {
  0: "border-red-500 bg-red-50",
  1: "border-primary bg-primary/10",
  2: "border-amber-500 bg-amber-50",
  3: "border-yellow-500 bg-yellow-50",
  4: "border-green-500 bg-green-50",
};

export default function AdminZonesPage() {
  const [actions, setActions] = useState<ZoneAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ZoneAction>>({});
  const [saving, setSaving] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  async function loadActions() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/zones`, { credentials: "include" });
      const data = await res.json();
      setActions(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActions();
  }, []);

  function startEdit(action: ZoneAction) {
    setEditingId(action.id);
    setEditValues({
      action_title: action.action_title,
      why_it_matters: action.why_it_matters,
      priority_score: action.priority_score,
      seasonal_peak: action.seasonal_peak || "",
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await fetch(`${apiUrl}/api/admin/zones/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      setEditingId(null);
      await loadActions();
    } finally {
      setSaving(false);
    }
  }

  const byLayer = actions.reduce<Record<number, ZoneAction[]>>((acc, a) => {
    (acc[a.layer] = acc[a.layer] || []).push(a);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-xl font-bold text-on-surface mb-1">Zone Actions</h1>
      <p className="text-sm text-on-surface-variant mb-5">
        Edit priority scores, seasonal peaks, and action text. Zone actions are authoritative content.
      </p>

      {/* Stubbed: Version history */}
      <div className="bg-surface-container-low border border-outline-variant/15 rounded-xl p-3 mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-on-surface-variant">Version history</p>
          <p className="text-xs text-outline">Track changes to zone action content over time</p>
        </div>
        <button
          disabled
          className="text-xs px-3 py-1.5 border border-outline-variant/15 rounded text-outline cursor-not-allowed"
        >
          Coming soon
        </button>
      </div>

      {loading ? (
        <div className="text-center text-outline py-12">Loading zone actions…</div>
      ) : (
        <div className="space-y-5">
          {[0, 1, 2, 3, 4].map((layer) => {
            const layerActions = byLayer[layer] || [];
            return (
              <div
                key={layer}
                className={`rounded-xl border-2 ${LAYER_COLORS[layer]} p-4`}
              >
                <h2 className="font-bold text-on-surface mb-3">{LAYER_NAMES[layer]}</h2>
                <div className="space-y-3">
                  {layerActions.map((action) => (
                    <div
                      key={action.id}
                      className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-3 shadow-sm"
                    >
                      {editingId === action.id ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs font-medium text-on-surface-variant">Title</label>
                            <input
                              value={editValues.action_title || ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, action_title: e.target.value }))}
                              className="w-full mt-0.5 px-2 py-1 text-sm border border-outline-variant/30 rounded"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-on-surface-variant">Why it matters</label>
                            <textarea
                              value={editValues.why_it_matters || ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, why_it_matters: e.target.value }))}
                              rows={2}
                              className="w-full mt-0.5 px-2 py-1 text-sm border border-outline-variant/30 rounded resize-none"
                            />
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="text-xs font-medium text-on-surface-variant">Priority score</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                value={editValues.priority_score ?? action.priority_score}
                                onChange={(e) => setEditValues((v) => ({ ...v, priority_score: parseFloat(e.target.value) }))}
                                className="w-full mt-0.5 px-2 py-1 text-sm border border-outline-variant/30 rounded"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-xs font-medium text-on-surface-variant">Seasonal peak (JSON)</label>
                              <input
                                value={editValues.seasonal_peak || ""}
                                onChange={(e) => setEditValues((v) => ({ ...v, seasonal_peak: e.target.value }))}
                                placeholder='["june","july","august"]'
                                className="w-full mt-0.5 px-2 py-1 text-sm border border-outline-variant/30 rounded"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(action.id)}
                              disabled={saving}
                              className="px-3 py-1 bg-primary text-on-primary rounded text-sm hover:opacity-90 disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 border border-outline-variant/30 text-on-surface-variant rounded text-sm hover:bg-surface-container-low"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-outline">#{action.rank_in_layer}</span>
                              <p className="text-sm font-semibold text-on-surface">{action.action_title}</p>
                            </div>
                            <p className="text-xs text-on-surface-variant">{action.why_it_matters}</p>
                            <div className="flex gap-2 mt-1 text-xs text-outline">
                              <span>Priority: {action.priority_score.toFixed(2)}</span>
                              <span>·</span>
                              <span>{action.effort_level}</span>
                              {action.seasonal_peak && action.seasonal_peak !== "[]" && (
                                <>
                                  <span>·</span>
                                  <span>Peak: {action.seasonal_peak}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => startEdit(action)}
                            className="text-xs px-2 py-1 border border-outline-variant/30 rounded hover:bg-surface-container text-on-surface-variant flex-shrink-0"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
