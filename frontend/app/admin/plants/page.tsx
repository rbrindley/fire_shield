"use client";

import { useState, useEffect } from "react";

interface SyncLog {
  synced_at: string;
  plants_upserted: number;
  plants_skipped: number;
  errors: number;
  status: string;
}

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
  ashland_restricted: boolean;
  ashland_restriction_type?: string;
  is_noxious_weed: boolean;
  placement_notes?: string;
}

const ZONE_LABELS = ["0–5ft", "5–30ft", "30–100ft", "100+ft"];

export default function AdminPlantsPage() {
  const [syncLog, setSyncLog] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loadingPlants, setLoadingPlants] = useState(false);
  const [filterZone, setFilterZone] = useState("");
  const [filterRestricted, setFilterRestricted] = useState(false);
  const [filterNoxious, setFilterNoxious] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  async function loadSyncLog() {
    const res = await fetch(`${apiUrl}/api/admin/plants/sync-log`, {
      credentials: "include",
    });
    const data = await res.json();
    setSyncLog(Array.isArray(data) ? data : []);
  }

  async function loadPlants() {
    setLoadingPlants(true);
    try {
      const qs = new URLSearchParams({ limit: "50", exclude_noxious: "false" });
      if (filterZone) qs.set("zone", filterZone);
      if (filterRestricted) qs.set("exclude_restricted", "false");
      const res = await fetch(`${apiUrl}/api/plants/search?${qs}`);
      const data = await res.json();
      setPlants(data.plants ?? []);
    } finally {
      setLoadingPlants(false);
    }
  }

  useEffect(() => {
    loadSyncLog();
    loadPlants();
  }, []);

  async function triggerSync() {
    setSyncing(true);
    setSyncResult("");
    try {
      const res = await fetch(`${apiUrl}/api/admin/plants/sync`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setSyncResult(
        `Synced: ${data.upserted} upserted, ${data.skipped} skipped, ${data.errors} errors`
      );
      await loadSyncLog();
      await loadPlants();
    } catch {
      setSyncResult("Sync failed. Check the backend logs.");
    } finally {
      setSyncing(false);
    }
  }

  async function overridePlant(id: string, field: "ashland_restricted" | "placement_notes", value: boolean | string) {
    await fetch(`${apiUrl}/api/admin/plants/${id}/override`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    await loadPlants();
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-on-surface mb-5">Plant Database</h1>

      {/* Sync panel */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 shadow-sm p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-on-surface mb-1">LWF Sync</h2>
            {syncLog.length > 0 ? (
              <p className="text-sm text-on-surface-variant">
                Last synced: {new Date(syncLog[0].synced_at).toLocaleString()} ·{" "}
                {syncLog[0].plants_upserted} plants ·{" "}
                <span className={syncLog[0].status === "success" ? "text-green-700" : "text-amber-700"}>
                  {syncLog[0].status}
                </span>
              </p>
            ) : (
              <p className="text-sm text-outline">Never synced</p>
            )}
            {syncResult && (
              <p className="text-sm text-green-700 mt-1">{syncResult}</p>
            )}
          </div>
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {syncing ? "Syncing…" : "Sync from LWF"}
          </button>
        </div>

        {/* Sync log */}
        {syncLog.length > 0 && (
          <div className="mt-4 border-t border-outline-variant/15 pt-3">
            <p className="text-xs font-medium text-on-surface-variant mb-2">Recent syncs</p>
            <div className="space-y-1">
              {syncLog.map((log, i) => (
                <div key={i} className="text-xs text-on-surface-variant flex gap-3">
                  <span>{new Date(log.synced_at).toLocaleString()}</span>
                  <span>{log.plants_upserted} upserted</span>
                  <span>{log.errors} errors</span>
                  <span className={log.status === "success" ? "text-green-700" : "text-amber-700"}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Plant list */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant/15 flex gap-3 items-center">
          <h2 className="font-semibold text-on-surface">Plants</h2>
          <select
            value={filterZone}
            onChange={(e) => { setFilterZone(e.target.value); }}
            className="text-sm border border-outline-variant/30 rounded-lg px-2 py-1 bg-surface-container-lowest"
          >
            <option value="">All zones</option>
            <option value="zone_0_5ft">0–5 ft</option>
            <option value="zone_5_30ft">5–30 ft</option>
            <option value="zone_30_100ft">30–100 ft</option>
            <option value="zone_100ft_plus">100+ ft</option>
          </select>
          <label className="flex items-center gap-1 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={filterRestricted}
              onChange={(e) => setFilterRestricted(e.target.checked)}
            />
            Show Ashland restricted
          </label>
          <label className="flex items-center gap-1 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={filterNoxious}
              onChange={(e) => setFilterNoxious(e.target.checked)}
            />
            Show noxious weeds
          </label>
          <button
            onClick={loadPlants}
            className="ml-auto px-3 py-1 text-sm bg-surface-container rounded-lg hover:bg-surface-container-high"
          >
            Apply
          </button>
        </div>

        {loadingPlants ? (
          <div className="p-8 text-center text-outline">Loading plants…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant/15">
              <tr>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Plant</th>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Type</th>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Zones</th>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Water</th>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Flags</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {plants.map((p) => (
                <tr key={p.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low">
                  <td className="px-4 py-2">
                    <div className="font-medium text-on-surface">{p.common_name}</div>
                    {p.scientific_name && (
                      <div className="text-xs text-outline italic">{p.scientific_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant capitalize">{p.plant_type || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.zone_0_5ft && <span className="text-xs bg-primary-container/20 text-primary px-1 rounded">0–5ft</span>}
                      {p.zone_5_30ft && <span className="text-xs bg-primary-container/20 text-primary px-1 rounded">5–30ft</span>}
                      {p.zone_30_100ft && <span className="text-xs bg-yellow-100 text-yellow-700 px-1 rounded">30–100ft</span>}
                      {p.zone_100ft_plus && <span className="text-xs bg-surface-container text-on-surface-variant px-1 rounded">100+ft</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant capitalize">{p.water_need || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.is_native && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">Native</span>}
                      {p.deer_resistant && <span className="text-xs bg-surface-container text-on-surface-variant px-1 rounded">Deer</span>}
                      {p.ashland_restricted && (
                        <span className="text-xs bg-red-100 text-red-700 px-1 rounded">
                          Ashland {p.ashland_restriction_type && `(${p.ashland_restriction_type})`}
                        </span>
                      )}
                      {p.is_noxious_weed && (
                        <span className="text-xs bg-red-200 text-red-800 px-1 rounded font-medium">Noxious</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => overridePlant(p.id, "ashland_restricted", !p.ashland_restricted)}
                      className="text-xs px-2 py-1 border border-outline-variant/30 rounded hover:bg-surface-container text-on-surface-variant"
                    >
                      {p.ashland_restricted ? "Clear Ashland flag" : "Flag Ashland"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
