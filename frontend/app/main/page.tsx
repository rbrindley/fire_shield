"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChatPanel from "@/components/ChatPanel";
import type { QueryResponse } from "@/components/ChatPanel";
import ResourceList from "@/components/ResourceList";
import ResourceWindow from "@/components/ResourceWindow";
import AddressBar from "@/components/AddressBar";

interface ResourceLink {
  title: string;
  description: string;
  intent_tag: string;
  url?: string;
}

// Lightweight keyword pre-classifier for optimistic tab selection
function preClassify(question: string): string | null {
  const q = question.toLowerCase();
  if (/\b(map|satellite|aerial|property map|zone ring)\b/.test(q)) return "map";
  if (/\b(plant|shrub|tree|landscap|vegetat|flora|garden)\b/.test(q)) return "plants";
  if (/\b(zone|defensible|clearance|distance|0.5.*ft|5.30|30.100)\b/.test(q)) return "zones";
  if (/\b(build|teach|educ|student|classroom|instruc|diy|project)\b/.test(q)) return "build";
  return null;
}

function MainInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialTab = searchParams.get("tab") ?? "";
  const profileId = searchParams.get("profile") ?? "";

  const [activeTab, setActiveTab] = useState<string | null>(initialTab || null);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (initialTab) initial.add(initialTab);
    return initial;
  });
  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [jurisdictionCode, setJurisdictionCode] = useState<string | undefined>();

  // Load property from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("property");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setAddress(p.address ?? null);
        setLat(p.lat);
        setLng(p.lng);
        setJurisdictionCode(p.jurisdiction_code);
      } catch {
        // ignore
      }
    }
  }, []);

  // Optimistic pre-classification from initial question
  useEffect(() => {
    if (initialQ && !initialTab) {
      const guessedTab = preClassify(initialQ);
      if (guessedTab) {
        setActiveTab(guessedTab);
        setVisitedTabs((prev) => new Set(prev).add(guessedTab));
      }
    }
  }, [initialQ, initialTab]);

  const handleQueryResponse = useCallback((response: QueryResponse) => {
    if (response.intent) {
      const tab = response.intent.resource_tab;
      setActiveTab(tab);
      setVisitedTabs((prev) => new Set(prev).add(tab));
    }
    if (response.resource_links && response.resource_links.length > 0) {
      setResourceLinks(response.resource_links);
    }
  }, []);

  const handleResourceLinkClick = useCallback((link: ResourceLink) => {
    const tab = link.intent_tag;
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set(prev).add(tab));
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleAddressChange = useCallback((data: { lat: number; lng: number; address: string; jurisdiction_code: string }) => {
    setAddress(data.address);
    setLat(data.lat);
    setLng(data.lng);
    setJurisdictionCode(data.jurisdiction_code);
    // Auto-switch to map when address is set
    setActiveTab("map");
    setVisitedTabs((prev) => new Set(prev).add("map"));
  }, []);

  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)]">
      {/* Left panel — resources */}
      <div className="flex-1 flex flex-col min-w-0 md:border-r border-outline-variant/15 min-h-0">
        {/* Address bar */}
        <AddressBar address={address} onAddressChange={handleAddressChange} />

        {/* Resource list */}
        {resourceLinks.length > 0 && (
          <div className="px-4 py-3 border-b border-outline-variant/15">
            <ResourceList links={resourceLinks} onLinkClick={handleResourceLinkClick} />
          </div>
        )}

        {/* Resource window */}
        <div className="flex-1 min-h-0">
          <ResourceWindow
            activeTab={activeTab}
            visitedTabs={visitedTabs}
            onTabChange={handleTabChange}
            lat={lat}
            lng={lng}
            profileId={profileId}
            jurisdictionCode={jurisdictionCode}
          />
        </div>
      </div>

      {/* Right panel — chat (hidden on mobile unless toggled) */}
      <div className={`${chatOpen ? "fixed inset-0 z-50 bg-surface" : "hidden"} md:relative md:block md:w-[33%] md:min-w-[320px] md:max-w-[480px] flex flex-col bg-surface`}>
        {/* Mobile close button */}
        <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-outline-variant/15">
          <span className="text-sm font-headline font-bold text-on-surface">Chat</span>
          <button
            onClick={() => setChatOpen(false)}
            className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ChatPanel
          initialQuestion={initialQ || undefined}
          profileId={profileId || undefined}
          onQueryResponse={handleQueryResponse}
        />
      </div>

      {/* Mobile chat FAB */}
      <button
        onClick={() => setChatOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-on-primary"
        style={{ background: "linear-gradient(135deg, #795900 0%, #d4a017 100%)" }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div>
  );
}

export default function MainPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-3.5rem)] text-on-surface-variant font-body">Loading\u2026</div>}>
      <MainInner />
    </Suspense>
  );
}
