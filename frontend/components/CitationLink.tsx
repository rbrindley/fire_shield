"use client";

import { useState } from "react";

type CitationType = "structured_data" | "retrieved_document" | "fire_science_evidence";

interface CitationLinkProps {
  citation: string;
  type?: CitationType;
  url?: string;
}

const TYPE_CONFIG: Record<CitationType, { icon: string; color: string; label: string }> = {
  structured_data: {
    icon: "🗄",
    color: "text-green-700 bg-green-50 border-green-200",
    label: "Structured data",
  },
  retrieved_document: {
    icon: "📄",
    color: "text-blue-700 bg-blue-50 border-blue-200",
    label: "Source document",
  },
  fire_science_evidence: {
    icon: "🔬",
    color: "text-purple-700 bg-purple-50 border-purple-200",
    label: "Fire science",
  },
};

export default function CitationLink({
  citation,
  type = "retrieved_document",
  url,
}: CitationLinkProps) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[type];

  if (!citation) return null;

  return (
    <div className={`text-xs rounded border px-2 py-1 ${config.color}`}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1 w-full text-left"
      >
        <span>{config.icon}</span>
        <span className="font-medium">{config.label}</span>
        <span className="ml-auto text-xs opacity-60">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="mt-1 pt-1 border-t border-current/10 leading-relaxed">
          <p className="opacity-80">{citation}</p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline mt-1 inline-block"
            >
              View source →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
