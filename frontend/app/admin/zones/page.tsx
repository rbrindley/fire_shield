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
  1: "border-orange-500 bg-orange-50",
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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
      <h1 className="text-xl font-bold text-stone-900 mb-1">Zone Actions</h1>
      <p className="text-sm text-stone-500 mb-5">
        Edit priority scores, seasonal peaks, and action text. Zone actions are authoritative content.
      </p>

      {/* Stubbed: Version history */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-stone-600">Version history</p>
          <p className="text-xs text-stone-400">Track changes to zone action content over time</p>
        </div>
        <button
          disabled
          className="text-xs px-3 py-1.5 border border-stone-200 rounded text-stone-400 cursor-not-allowed"
        >
          Coming soon
        </button>
      </div>

      {loading ? (
        <div className="text-center text-stone-400 py-12">Loading zone actions…</div>
      ) : (
        <div className="space-y-5">
          {[0, 1, 2, 3, 4].map((layer) => {
            const layerActions = byLayer[layer] || [];
            return (
              <div
                key={layer}
                className={`rounded-xl border-2 ${LAYER_COLORS[layer]} p-4`}
              >
                <h2 className="font-bold text-stone-900 mb-3">{LAYER_NAMES[layer]}</h2>
                <div className="space-y-3">
                  {layerActions.map((action) => (
                    <div
                      key={action.id}
                      className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm"
                    >
                      {editingId === action.id ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs font-medium text-stone-500">Title</label>
                            <input
                              value={editValues.action_title || ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, action_title: e.target.value }))}
                              className="w-full mt-0.5 px-2 py-1 text-sm border border-stone-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-stone-500">Why it matters</label>
                            <textarea
                              value={editValues.why_it_matters || ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, why_it_matters: e.target.value }))}
                              rows={2}
                              className="w-full mt-0.5 px-2 py-1 text-sm border border-stone-300 rounded resize-none"
                            />
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="text-xs font-medium text-stone-500">Priority score</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                value={editValues.priority_score ?? action.priority_score}
                                onChange={(e) => setEditValues((v) => ({ ...v, priority_score: parseFloat(e.target.value) }))}
                                className="w-full mt-0.5 px-2 py-1 text-sm border border-stone-300 rounded"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-xs font-medium text-stone-500">Seasonal peak (JSON)</label>
                              <input
                                value={editValues.seasonal_peak || ""}
                                onChange={(e) => setEditValues((v) => ({ ...v, seasonal_peak: e.target.value }))}
                                placeholder='["june","july","august"]'
                                className="w-full mt-0.5 px-2 py-1 text-sm border border-stone-300 rounded"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(action.id)}
                              disabled={saving}
                              className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 border border-stone-300 text-stone-600 rounded text-sm hover:bg-stone-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-stone-400">#{action.rank_in_layer}</span>
                              <p className="text-sm font-semibold text-stone-900">{action.action_title}</p>
                            </div>
                            <p className="text-xs text-stone-500">{action.why_it_matters}</p>
                            <div className="flex gap-2 mt-1 text-xs text-stone-400">
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
                            className="text-xs px-2 py-1 border border-stone-300 rounded hover:bg-stone-100 text-stone-600 flex-shrink-0"
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
