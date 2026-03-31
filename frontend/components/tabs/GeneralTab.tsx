"use client";

import { useState, useEffect } from "react";

interface DocInfo {
  id: number;
  title: string;
  jurisdiction: string;
  trust_tier: number;
  source_url: string | null;
  status: string;
}

const TIER_LABELS: Record<number, string> = {
  1: "Local Code",
  2: "Authoritative (State/County)",
  3: "Fire Science Research",
  4: "Community / Educational",
  5: "Grants & Incentives",
  6: "Educational",
};

const TIER_COLORS: Record<number, string> = {
  1: "bg-tertiary-container/30 text-on-tertiary-container",
  2: "bg-primary-container/30 text-on-primary-container",
  3: "bg-secondary-container text-on-secondary-container",
  4: "bg-surface-container-high text-on-surface-variant",
  5: "bg-primary-container/20 text-on-primary-container",
  6: "bg-surface-container-high text-on-surface-variant",
};

const VIDEOS = [
  {
    id: "2EwYzorT-CI",
    title: "Stop Wildfire Embers from Igniting Your Home",
    description:
      "IBHS research footage showing how embers enter homes through vents, decks, and gutters — and how to stop them.",
  },
];

export default function GeneralTab() {
  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  useEffect(() => {
    fetch(`${apiUrl}/api/documents`)
      .then((r) => r.json())
      .then((data) => setDocs(data.documents ?? data ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  // Group documents by trust tier
  const grouped = docs
    .filter((d) => d.status === "active")
    .reduce<Record<number, DocInfo[]>>((acc, d) => {
      (acc[d.trust_tier] ??= []).push(d);
      return acc;
    }, {});

  const sortedTiers = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="font-headline font-bold text-on-surface text-lg">
          Resources
        </h2>
        <p className="text-xs text-on-surface-variant font-body mt-1">
          Educational videos and source documents powering Fire Shield&apos;s
          recommendations.
        </p>
      </div>

      {/* Educational Videos */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-headline">
          Educational Videos
        </h3>
        {VIDEOS.map((video) => (
          <div
            key={video.id}
            className="rounded-xl overflow-hidden bg-surface-container-lowest max-w-[30%] min-w-[240px]"
          >
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${video.id}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="px-3 py-2">
              <p className="text-xs font-headline font-semibold text-on-surface">
                {video.title}
              </p>
              <p className="text-[10px] text-on-surface-variant font-body mt-0.5">
                {video.description}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Ingested Documents */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-headline">
          Source Documents
        </h3>

        {loading && (
          <p className="text-sm text-on-surface-variant font-body">
            Loading documents&hellip;
          </p>
        )}

        {!loading && sortedTiers.length === 0 && (
          <p className="text-sm text-on-surface-variant font-body">
            No documents ingested yet.
          </p>
        )}

        {sortedTiers.map((tier) => (
          <div key={tier} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  TIER_COLORS[tier] ?? TIER_COLORS[4]
                }`}
              >
                Tier {tier}
              </span>
              <span className="text-xs text-on-surface-variant font-body">
                {TIER_LABELS[tier] ?? `Tier ${tier}`}
              </span>
            </div>
            <div className="space-y-1">
              {grouped[tier].map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-container-lowest"
                >
                  <svg
                    className="w-4 h-4 text-outline mt-0.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <div className="min-w-0">
                    {doc.source_url ? (
                      <a
                        href={doc.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-on-surface font-body hover:text-primary transition-colors"
                      >
                        {doc.title}
                        <span className="ml-1 text-outline text-xs">
                          {"\u2197"}
                        </span>
                      </a>
                    ) : (
                      <p className="text-sm text-on-surface font-body">
                        {doc.title}
                      </p>
                    )}
                    {doc.jurisdiction && doc.jurisdiction !== "universal" && (
                      <p className="text-[10px] text-on-surface-variant font-body">
                        {doc.jurisdiction}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
