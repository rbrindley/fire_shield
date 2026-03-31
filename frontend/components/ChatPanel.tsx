"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CitationLink from "@/components/CitationLink";

interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
}

interface Citation {
  ref_number: number;
  document_title: string;
  section_title?: string;
  excerpt: string;
  citation_type: "structured_data" | "retrieved_document" | "fire_science_evidence";
  trust_tier: number;
  source_url?: string;
}

interface IntentClassification {
  primary_intent: string;
  confidence: number;
  resource_tab: string;
  tab_context?: { search_query?: string; zone_filter?: string } | null;
}

interface ResourceLink {
  title: string;
  description: string;
  intent_tag: string;
  url?: string;
}

interface PropertyContext {
  address_mentioned?: string;
  lat?: number;
  lng?: number;
  jurisdiction_code?: string;
  jurisdiction_display?: string;
  area_type?: "urban" | "rural";
  nearest_neighbor_distance_m?: number;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  jurisdiction_note?: string;
  nws_alert?: string;
  intent?: IntentClassification;
  resource_links?: ResourceLink[];
  property_context?: PropertyContext;
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

interface ChatPanelProps {
  initialQuestion?: string;
  profileId?: string;
  profile?: string;
  onQueryResponse?: (response: QueryResponse) => void;
  address?: string | null;
  onAddressChange?: (data: { lat: number; lng: number; address: string; jurisdiction_code: string }) => void;
}

export default function ChatPanel({ initialQuestion, profileId, profile, onQueryResponse, address, onAddressChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"simple" | "pro">("simple");
  const [listening, setListening] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentInitialRef = useRef(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  const toggleMic = useCallback(() => {
    if (listening && recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
      setListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition: SpeechRecognitionInstance = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if ((result as unknown as { isFinal: boolean }).isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInput(final + interim);
    };

    recognition.onend = () => {
      // In continuous mode, browser may stop after silence — restart if still listening
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { setListening(false); }
      }
    };
    recognition.onerror = (event: Event & { error: string }) => {
      if (event.error === "no-speech") return; // silence timeout, onend will restart
      setListening(false);
    };

    recognition.start();
    setListening(true);
  }, [listening]);

  // Send initial question once
  useEffect(() => {
    console.log("[ChatPanel] useEffect initialQuestion:", initialQuestion, "sentInitialRef:", sentInitialRef.current);
    if (initialQuestion && !sentInitialRef.current) {
      sentInitialRef.current = true;
      console.log("[ChatPanel] Calling handleSend with initial question");
      handleSend(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const question = (text ?? input).trim();
    console.log("[ChatPanel] handleSend called, question:", question?.slice(0, 50), "loading:", loading);
    if (!question || loading) {
      console.log("[ChatPanel] handleSend BAILED — question empty:", !question, "loading:", loading);
      return;
    }
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
      const authToken = typeof window !== "undefined" ? sessionStorage.getItem("fs_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const res = await fetch(`${apiUrl}/api/query/`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          question,
          jurisdiction_code: jurisdictionCode,
          profile: profile ?? mode,
          property_profile_id: profileId || undefined,
          lat,
          lng,
        }),
      });

      console.log("[ChatPanel] fetch response status:", res.status);
      if (res.status === 401) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Please log in to use the wildfire advisor. Go back to the home page and sign in.",
        }]);
        setLoading(false);
        return;
      }
      if (res.status === 429) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "You've sent too many messages. Please wait a minute and try again.",
        }]);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Query failed");
      const data = await res.json();
      console.log("[ChatPanel] response data keys:", Object.keys(data), "answer length:", data.answer?.length, "property_context:", data.property_context);

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        citations: data.citations ?? [],
        jurisdictionNote: data.jurisdiction_note,
        nwsAlert: data.nws_alert,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Notify parent of the full response (intent + resource_links + property_context)
      onQueryResponse?.({
        answer: data.answer,
        citations: data.citations ?? [],
        jurisdiction_note: data.jurisdiction_note,
        nws_alert: data.nws_alert,
        intent: data.intent,
        resource_links: data.resource_links,
        property_context: data.property_context,
      });
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

  async function handleAddressSubmit() {
    const addr = addressInput.trim();
    if (!addr || addressLoading) return;
    setAddressLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/jurisdiction/resolve?address=${encodeURIComponent(addr)}`);
      if (!res.ok) throw new Error("Resolve failed");
      const data = await res.json();
      onAddressChange?.({
        lat: data.lat,
        lng: data.lng,
        address: addr,
        jurisdiction_code: data.jurisdiction_code ?? "jackson_county",
      });
      setEditingAddress(false);
      setAddressInput("");
    } catch {
      // keep editing open
    } finally {
      setAddressLoading(false);
    }
  }

  function renderMarkdown(text: string): React.ReactNode[] {
    // Split into lines to handle block-level markdown
    const lines = text.split("\n");
    const result: React.ReactNode[] = [];

    for (let li = 0; li < lines.length; li++) {
      let line = lines[li];

      // --- horizontal rules
      if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
        result.push(<hr key={`hr-${li}`} className="border-outline-variant/20 my-2" />);
        continue;
      }

      // ### headings
      const h3 = line.match(/^###\s+(.+)/);
      if (h3) {
        result.push(<p key={`h3-${li}`} className="font-headline font-bold text-on-surface mt-3 mb-1">{inlineMd(h3[1])}</p>);
        continue;
      }
      const h2 = line.match(/^##\s+(.+)/);
      if (h2) {
        result.push(<p key={`h2-${li}`} className="font-headline font-bold text-on-surface text-base mt-3 mb-1">{inlineMd(h2[1])}</p>);
        continue;
      }
      const h1 = line.match(/^#\s+(.+)/);
      if (h1) {
        result.push(<p key={`h1-${li}`} className="font-headline font-extrabold text-on-surface text-lg mt-3 mb-1">{inlineMd(h1[1])}</p>);
        continue;
      }

      // - bullet lists
      const bullet = line.match(/^[-*]\s+(.+)/);
      if (bullet) {
        result.push(
          <div key={`li-${li}`} className="flex gap-2 pl-2">
            <span className="text-secondary shrink-0">•</span>
            <span>{inlineMd(bullet[1])}</span>
          </div>
        );
        continue;
      }

      // Numbered lists
      const numbered = line.match(/^(\d+)[.)]\s+(.+)/);
      if (numbered) {
        result.push(
          <div key={`ol-${li}`} className="flex gap-2 pl-2">
            <span className="text-on-surface-variant shrink-0">{numbered[1]}.</span>
            <span>{inlineMd(numbered[2])}</span>
          </div>
        );
        continue;
      }

      // Empty lines → small spacer
      if (line.trim() === "") {
        result.push(<div key={`br-${li}`} className="h-2" />);
        continue;
      }

      // Regular text with inline formatting
      result.push(<span key={`p-${li}`}>{inlineMd(line)}{"\n"}</span>);
    }

    return result;
  }

  function inlineMd(text: string): React.ReactNode[] {
    // Bold and italic inline formatting
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      const boldMatch = part.match(/^\*\*(.+)\*\*$/);
      if (boldMatch) return <strong key={i} className="font-semibold">{boldMatch[1]}</strong>;
      const italicMatch = part.match(/^\*(.+)\*$/);
      if (italicMatch) return <em key={i}>{italicMatch[1]}</em>;
      return <span key={i}>{part}</span>;
    });
  }

  function renderAnswer(text: string, citations: Citation[] = []) {
    // Split on citations and URLs
    const parts = text.split(/(\[\d+\]|https?:\/\/[^\s)\]]+)/g);
    return parts.map((part, i) => {
      // Citation reference
      const citMatch = part.match(/^\[(\d+)\]$/);
      if (citMatch) {
        const num = parseInt(citMatch[1]);
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
      // URL — render as clickable link
      if (/^https?:\/\//.test(part)) {
        let label = part;
        try {
          const u = new URL(part);
          const path = u.pathname.replace(/\/$/, "");
          label = u.hostname.replace("www.", "") + (path && path !== "/" ? path : "");
        } catch { /* use raw URL */ }
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
          >
            {label}
          </a>
        );
      }
      return <span key={i}>{renderMarkdown(part)}</span>;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Address bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-outline-variant/15 bg-surface-container-low">
        {editingAddress ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddressSubmit(); }}
            className="flex items-center gap-2 flex-1"
          >
            <input
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="Enter an address..."
              autoFocus
              className="flex-1 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface-container-lowest"
            />
            <button
              type="submit"
              disabled={addressLoading || !addressInput.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-headline font-medium text-on-primary disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
            >
              {addressLoading ? "..." : "Set"}
            </button>
            <button
              type="button"
              onClick={() => { setEditingAddress(false); setAddressInput(""); }}
              className="px-2 py-1.5 rounded-lg text-xs text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <span className="text-xs font-headline font-medium text-on-surface-variant">Current Address:</span>
            <span className="text-xs font-body text-on-surface truncate flex-1">
              {address || "Not set"}
            </span>
            <button
              onClick={() => { setEditingAddress(true); setAddressInput(address ?? ""); }}
              className="text-xs px-2 py-1 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-headline font-medium shrink-0"
            >
              Change
            </button>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 && (
          <div className="text-center text-on-surface-variant pt-8">
            <p className="text-sm font-body">Ask anything about wildfire preparedness.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] px-4 py-3 ${
                msg.role === "user"
                  ? "rounded-2xl rounded-tr-sm text-on-primary"
                  : "bg-surface-container-lowest rounded-2xl rounded-tl-sm shadow-[0_2px_12px_rgba(27,28,26,0.06)]"
              }`}
              style={msg.role === "user" ? { background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" } : undefined}
            >
              {msg.role === "assistant" ? (
                <div>
                  {msg.nwsAlert && (
                    <div className="mb-2 p-2 bg-tertiary-container/15 rounded-lg text-xs text-on-tertiary-container font-body font-medium">
                      {msg.nwsAlert}
                    </div>
                  )}
                  {msg.jurisdictionNote && (
                    <div className="mb-2 p-2 bg-primary-container/10 rounded-lg text-xs text-on-primary-container font-body">
                      {msg.jurisdictionNote}
                    </div>
                  )}
                  <div className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap font-body">
                    {renderAnswer(msg.content, msg.citations)}
                  </div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 space-y-1">
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
            <div className="bg-surface-container-lowest rounded-2xl rounded-tl-sm px-4 py-3 shadow-[0_2px_12px_rgba(27,28,26,0.06)]">
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

      {/* Input + mode toggle */}
      <div className="p-3 border-t border-outline-variant/15">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) handleSend();
                  }
                }}
                placeholder="Ask about vent screening, plants, grants, local code\u2026"
                rows={5}
                className="w-full px-4 py-3 pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-body resize-none"
                disabled={loading}
              />
              <button
                type="button"
                onClick={toggleMic}
                className={`absolute right-2 top-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  listening
                    ? "bg-tertiary text-on-tertiary animate-pulse"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
                }`}
                title={listening ? "Stop listening" : "Voice input"}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 self-end py-3 text-on-primary rounded-xl font-headline font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
            >
              Send
            </button>
          </div>
        </form>
        <div className="flex items-center justify-center gap-1 mt-2">
          <div className="flex gap-1 bg-surface-container-low rounded-full p-0.5">
            {(["simple", "pro"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-full text-xs font-headline font-medium transition-colors ${
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
      </div>
    </div>
  );
}
