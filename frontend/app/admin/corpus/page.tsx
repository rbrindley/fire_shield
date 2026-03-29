"use client";

import { useState, useEffect } from "react";

interface CorpusSource {
  id: number;
  title: string;
  source_url?: string;
  jurisdiction: string;
  jurisdiction_display?: string;
  jurisdiction_chain?: string;
  trust_tier: number;
  document_date?: string;
  ingestion_date?: string;
  status: string;
  document_id?: string;
}

const TIER_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-800",
  2: "bg-primary-container/20 text-on-primary-container",
  3: "bg-blue-100 text-blue-800",
  4: "bg-surface-container text-on-surface",
  5: "bg-green-100 text-green-700",
  6: "bg-surface-container text-on-surface-variant",
};

const TIER_LABELS: Record<number, string> = {
  1: "Local code",
  2: "Agency guidance",
  3: "Fire science",
  4: "Best practice",
  5: "Grant/program",
  6: "Supplementary",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  stale: "bg-surface-container text-on-surface-variant",
  pending: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
};

const JURISDICTIONS = [
  "ashland", "jacksonville", "medford", "talent", "phoenix",
  "central_point", "eagle_point", "jackson_county", "josephine_county",
  "grants_pass", "oregon_state", "federal", "universal",
];

function getAdminToken() {
  const match = document.cookie.match(/admin_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export default function CorpusPage() {
  const [sources, setSources] = useState<CorpusSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestJurisdiction, setIngestJurisdiction] = useState("universal");
  const [ingestTier, setIngestTier] = useState(4);
  const [ingestDate, setIngestDate] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMessage, setIngestMessage] = useState("");
  const [chainPreview, setChainPreview] = useState<string[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  async function loadSources() {
    setLoading(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${apiUrl}/api/admin/corpus`, {
        credentials: "include",
        headers: token ? { "X-Admin-Token": token } : {},
      });
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      const data = await res.json();
      setSources(Array.isArray(data) ? data : []);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  async function updateChainPreview(jurisdiction: string) {
    try {
      const token = getAdminToken();
      const res = await fetch(
        `${apiUrl}/api/admin/corpus/jurisdiction-preview/${jurisdiction}`,
        {
          credentials: "include",
          headers: token ? { "X-Admin-Token": token } : {},
        }
      );
      const data = await res.json();
      setChainPreview(data.chain ?? []);
    } catch {
      setChainPreview([]);
    }
  }

  async function deprecate(id: number) {
    const token = getAdminToken();
    await fetch(`${apiUrl}/api/admin/corpus/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: token ? { "X-Admin-Token": token } : {},
    });
    await loadSources();
  }

  async function activate(id: number) {
    const token = getAdminToken();
    await fetch(`${apiUrl}/api/admin/corpus/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Admin-Token": token } : {}),
      },
      body: JSON.stringify({ status: "active" }),
    });
    await loadSources();
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    setIngestLoading(true);
    setIngestMessage("");
    try {
      const token = getAdminToken();
      const res = await fetch(`${apiUrl}/api/ingest/url`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Admin-Token": token } : {}),
        },
        body: JSON.stringify({
          url: ingestUrl,
          title: ingestTitle,
          jurisdiction: ingestJurisdiction,
          trust_tier: ingestTier,
          document_date: ingestDate || null,
          source_url: ingestUrl,
        }),
      });
      const data = await res.json();
      setIngestMessage(`Started ingestion: ${data.document_id}`);
      setIngestUrl("");
      setIngestTitle("");
      await loadSources();
    } catch {
      setIngestMessage("Ingestion failed. Check the backend.");
    } finally {
      setIngestLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-on-surface mb-5">Corpus Sources</h1>

      {/* Source list */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 shadow-sm mb-6 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-outline">Loading…</div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-outline">No sources yet. Ingest a document below.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant/15">
              <tr>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Title</th>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Jurisdiction</th>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Tier</th>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Status</th>
                <th className="text-left px-4 py-2 text-on-surface-variant font-medium">Date</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low">
                  <td className="px-4 py-2">
                    <div className="font-medium text-on-surface">{s.title}</div>
                    {s.source_url && (
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline truncate block max-w-xs"
                      >
                        {s.source_url}
                      </a>
                    )}
                    {s.jurisdiction_chain && (
                      <div className="text-xs text-outline mt-0.5">
                        Chain: {s.jurisdiction_chain}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant">
                    {s.jurisdiction_display || s.jurisdiction}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${TIER_COLORS[s.trust_tier] ?? "bg-surface-container text-on-surface-variant"}`}>
                      Tier {s.trust_tier} · {TIER_LABELS[s.trust_tier] ?? ""}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[s.status] ?? "bg-surface-container text-on-surface-variant"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-outline text-xs">
                    {s.document_date || s.ingestion_date?.slice(0, 10) || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {s.status !== "stale" ? (
                        <button
                          onClick={() => deprecate(s.id)}
                          className="text-xs px-2 py-1 border border-outline-variant/30 rounded hover:bg-surface-container text-on-surface-variant"
                        >
                          Deprecate
                        </button>
                      ) : (
                        <button
                          onClick={() => activate(s.id)}
                          className="text-xs px-2 py-1 border border-green-300 rounded hover:bg-green-50 text-green-700"
                        >
                          Re-activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ingest form */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 shadow-sm p-5">
        <h2 className="font-semibold text-on-surface mb-4">Ingest New Document</h2>
        <form onSubmit={handleIngest} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Document URL</label>
              <input
                value={ingestUrl}
                onChange={(e) => setIngestUrl(e.target.value)}
                placeholder="https://www.ashland.or.us/fire-landscaping.pdf"
                required
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Title</label>
              <input
                value={ingestTitle}
                onChange={(e) => setIngestTitle(e.target.value)}
                placeholder="City of Ashland Fire-Reluctant Landscaping Best Practices"
                required
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Jurisdiction</label>
              <select
                value={ingestJurisdiction}
                onChange={(e) => {
                  setIngestJurisdiction(e.target.value);
                  updateChainPreview(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm bg-surface-container-lowest"
              >
                {JURISDICTIONS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
              {chainPreview.length > 0 && (
                <p className="text-xs text-outline mt-1">
                  Chain: {chainPreview.join(" → ")}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Trust Tier</label>
              <select
                value={ingestTier}
                onChange={(e) => setIngestTier(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm bg-surface-container-lowest"
              >
                <option value={1}>Tier 1 — Local code / ordinance</option>
                <option value={2}>Tier 2 — Agency guidance</option>
                <option value={3}>Tier 3 — Fire science evidence</option>
                <option value={4}>Tier 4 — Best practice guide</option>
                <option value={5}>Tier 5 — Grant / program info</option>
                <option value={6}>Tier 6 — Supplementary</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Document Date (optional)</label>
              <input
                type="date"
                value={ingestDate}
                onChange={(e) => setIngestDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm"
              />
            </div>
          </div>

          {/* Stubbed: Advanced geo-fence */}
          <div className="rounded-xl border border-outline-variant/15 p-3 bg-surface-container-low">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Advanced geo-fence</p>
                <p className="text-xs text-outline">Polygon-based jurisdiction assignment (coming soon)</p>
              </div>
              <button
                type="button"
                disabled
                className="text-xs px-3 py-1.5 border border-outline-variant/30 rounded text-outline cursor-not-allowed"
              >
                Configure polygon
              </button>
            </div>
          </div>

          {ingestMessage && (
            <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">{ingestMessage}</p>
          )}

          <button
            type="submit"
            disabled={ingestLoading}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {ingestLoading ? "Starting ingest…" : "Ingest document"}
          </button>
        </form>
      </div>
    </div>
  );
}
