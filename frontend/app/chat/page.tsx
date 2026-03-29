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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  useEffect(() => {
    const stored = sessionStorage.getItem("property");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setJurisdictionDisplay(p.jurisdiction_display ?? null);

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
            "I couldn\u2019t retrieve an answer right now. Please check that the backend is running and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

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
                  ? "bg-tertiary-container/20 text-tertiary"
                  : citation.citation_type === "structured_data"
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-primary-container/20 text-primary"
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
          <div className="flex items-center gap-2">
            <h1 className="font-headline font-bold text-on-surface">Digital Arborist</h1>
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          </div>
          {jurisdictionDisplay && (
            <p className="text-xs text-on-surface-variant font-body">
              {jurisdictionDisplay}
              {memoryCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-tertiary-container/20 text-tertiary rounded text-[10px] font-bold">
                  {memoryCount} {memoryCount === 1 ? "memory" : "memories"}
                </span>
              )}
            </p>
          )}
        </div>
        {/* Mode toggle */}
        <div className="flex gap-1 bg-surface-container-low rounded-full p-1">
          {(["simple", "pro"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-sm font-headline font-medium transition-colors ${
                mode === m
                  ? "bg-surface-container-lowest shadow-sm text-on-surface"
                  : "text-on-surface-variant hover:text-on-surface"
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
          <div className="text-center text-on-surface-variant pt-16">
            <p className="text-sm font-body">Ask anything about wildfire preparedness for your property.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-5 py-3.5 ${
                msg.role === "user"
                  ? "rounded-3xl rounded-tr-sm text-on-primary"
                  : "bg-surface-container-lowest rounded-3xl rounded-tl-sm shadow-[0_2px_12px_rgba(27,28,26,0.06)]"
              }`}
              style={msg.role === "user" ? { background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" } : undefined}
            >
              {msg.role === "assistant" ? (
                <div>
                  {/* NWS alert */}
                  {msg.nwsAlert && (
                    <div className="mb-3 p-3 bg-tertiary-container/15 rounded-xl text-xs text-on-tertiary-container font-body font-medium">
                      {msg.nwsAlert}
                    </div>
                  )}

                  {/* Jurisdiction note */}
                  {msg.jurisdictionNote && (
                    <div className="mb-3 p-3 bg-primary-container/10 rounded-xl text-xs text-on-primary-container font-body">
                      {msg.jurisdictionNote}
                    </div>
                  )}

                  {/* Answer */}
                  <div className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap font-body">
                    {renderAnswer(msg.content, msg.citations)}
                  </div>

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-body">
                        Sources
                      </p>
                      {msg.citations.map((c) => (
                        <div key={c.ref_number} id={`citation-${c.ref_number}`}>
                          <CitationLink
                            citation={`[${c.ref_number}] ${c.document_title}${c.section_title ? ` \u2014 ${c.section_title}` : ""}: ${c.excerpt}`}
                            type={c.citation_type}
                            url={c.source_url}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm font-body">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-container-lowest rounded-3xl rounded-tl-sm px-5 py-4 shadow-[0_2px_12px_rgba(27,28,26,0.06)]">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-outline-variant rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-outline-variant rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-outline-variant rounded-full animate-bounce" />
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
          placeholder="Ask about vent screening, plants, grants, local code\u2026"
          className="flex-1 px-5 py-3.5 rounded-2xl bg-surface-container-lowest text-on-surface placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-[0_2px_12px_rgba(27,28,26,0.04)] text-sm font-body"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-6 py-3.5 text-on-primary rounded-2xl font-headline font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-4 py-12 text-center text-on-surface-variant font-body">Loading\u2026</div>}>
      <ChatInner />
    </Suspense>
  );
}
