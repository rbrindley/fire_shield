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
}

interface ResourceLink {
  title: string;
  description: string;
  intent_tag: string;
  url?: string;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  jurisdiction_note?: string;
  nws_alert?: string;
  intent?: IntentClassification;
  resource_links?: ResourceLink[];
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
  onQueryResponse?: (response: QueryResponse) => void;
}

export default function ChatPanel({ initialQuestion, profileId, onQueryResponse }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"simple" | "pro">("simple");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentInitialRef = useRef(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

  const toggleMic = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition: SpeechRecognitionInstance = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.start();
    setListening(true);
  }, [listening]);

  // Send initial question once
  useEffect(() => {
    if (initialQuestion && !sentInitialRef.current) {
      sentInitialRef.current = true;
      handleSend(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

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

      // Notify parent of the full response (intent + resource_links)
      onQueryResponse?.({
        answer: data.answer,
        citations: data.citations ?? [],
        jurisdiction_note: data.jurisdiction_note,
        nws_alert: data.nws_alert,
        intent: data.intent,
        resource_links: data.resource_links,
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/15">
        <div className="flex items-center gap-2">
          <h2 className="font-headline font-bold text-on-surface text-sm">Digital Arborist</h2>
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        </div>
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

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-outline-variant/15"
      >
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about vent screening, plants, grants, local code\u2026"
              className="w-full px-4 py-3 pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-body"
              disabled={loading}
            />
            <button
              type="button"
              onClick={toggleMic}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
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
            className="px-5 py-3 text-on-primary rounded-xl font-headline font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
