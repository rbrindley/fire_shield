"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import CitationLink from "@/components/CitationLink";

interface Citation {
  ref_number: number;
  document_title: string;
  section_title?: string;
  excerpt: string;
  citation_type: "structured_data" | "retrieved_document" | "fire_science_evidence";
  trust_tier: number;
  source_url?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  jurisdictionNote?: string;
  nwsAlert?: string;
}

const MODE_LABELS: Record<string, string> = {
  simple: "Simple",
  pro: "Pro",
};

function ChatInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const profileId = searchParams.get("profile") ?? "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"simple" | "pro">("simple");
  const [jurisdictionDisplay, setJurisdictionDisplay] = useState<string | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  // Load jurisdiction from stored property + fetch memory count
  useEffect(() => {
    const stored = sessionStorage.getItem("property");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setJurisdictionDisplay(p.jurisdiction_display ?? null);

        // Fetch memory count if we have a profile ID
        const pid = p.property_profile_id ?? profileId;
        if (pid) {
          fetch(`${apiUrl}/api/memory/${pid}`)
            .then((r) => r.json())
            .then((data) => setMemoryCount(data.count ?? 0))
            .catch(() => {});
        }
      } catch {
        // ignore
      }
    }
  }, [apiUrl, profileId]);

  // Auto-submit initial question
  useEffect(() => {
    if (initialQ) {
      setInput("");
      handleSend(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setLoading(true);

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);

    const stored = sessionStorage.getItem("property");
    let jurisdictionCode = "jackson_county";
    let lat: number | undefined;
    let lng: number | undefined;
    if (stored) {
      try {
        const p = JSON.parse(stored);
        jurisdictionCode = p.jurisdiction_code ?? jurisdictionCode;
        lat = p.lat;
        lng = p.lng;
      } catch {
        // ignore
      }
    }

    try {
      const res = await fetch(`${apiUrl}/api/query/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          jurisdiction_code: jurisdictionCode,
          profile: mode,
          property_profile_id: profileId || undefined,
          lat,
          lng,
        }),
      });

      if (!res.ok) throw new Error("Query failed");
      const data = await res.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        citations: data.citations ?? [],
        jurisdictionNote: data.jurisdiction_note,
        nwsAlert: data.nws_alert,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Refresh memory count after a short delay (extraction runs async)
      if (profileId) {
        setTimeout(() => {
          fetch(`${apiUrl}/api/memory/${profileId}`)
            .then((r) => r.json())
            .then((d) => setMemoryCount(d.count ?? 0))
            .catch(() => {});
        }, 3000);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I couldn't retrieve an answer right now. Please check that the backend is running and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Render answer text with inline [n] citation markers highlighted
  function renderAnswer(text: string, citations: Citation[] = []) {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const num = parseInt(match[1]);
        const citation = citations.find((c) => c.ref_number === num);
        if (citation) {
          return (
            <button
              key={i}
              className={`inline-flex items-center text-xs font-bold px-1 rounded ml-0.5 align-middle ${
                citation.citation_type === "fire_science_evidence"
                  ? "bg-purple-100 text-purple-700"
                  : citation.citation_type === "structured_data"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}
              title={citation.document_title}
              onClick={() =>
                document.getElementById(`citation-${num}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                })
              }
            >
              [{num}]
            </button>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-bold text-stone-900">Ask Fire Shield</h1>
          {jurisdictionDisplay && (
            <p className="text-xs text-stone-500">
              {jurisdictionDisplay}
              {memoryCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                  {memoryCount} {memoryCount === 1 ? "memory" : "memories"}
                </span>
              )}
            </p>
          )}
        </div>
        {/* Mode toggle */}
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
          {(["simple", "pro"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-white shadow text-stone-900"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.length === 0 && (
          <div className="text-center text-stone-400 pt-16">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm">Ask anything about wildfire preparedness for your property.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-orange-600 text-white"
                  : "bg-white border border-stone-200 shadow-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div>
                  {/* NWS alert banner */}
                  {msg.nwsAlert && (
                    <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800 font-medium">
                      🚨 {msg.nwsAlert}
                    </div>
                  )}

                  {/* Jurisdiction note */}
                  {msg.jurisdictionNote && (
                    <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      ℹ {msg.jurisdictionNote}
                    </div>
                  )}

                  {/* Answer with inline citations */}
                  <div className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                    {renderAnswer(msg.content, msg.citations)}
                  </div>

                  {/* Citation list */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                        Sources
                      </p>
                      {msg.citations.map((c) => (
                        <div
                          key={c.ref_number}
                          id={`citation-${c.ref_number}`}
                        >
                          <CitationLink
                            citation={`[${c.ref_number}] ${c.document_title}${c.section_title ? ` — ${c.section_title}` : ""}: ${c.excerpt}`}
                            type={c.citation_type}
                            url={c.source_url}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-stone-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about vent screening, plants, grants, local code…"
          className="flex-1 px-4 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white shadow-sm text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-3 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-4 py-12 text-center text-stone-400">Loading…</div>}>
      <ChatInner />
    </Suspense>
  );
}
