"use client";

import dynamic from "next/dynamic";

const MapTab = dynamic(() => import("@/components/tabs/MapTab"), { ssr: false });
const PlantsTab = dynamic(() => import("@/components/tabs/PlantsTab"), { ssr: false });
const ZonesTab = dynamic(() => import("@/components/tabs/ZonesTab"), { ssr: false });
const BuildTab = dynamic(() => import("@/components/tabs/BuildTab"), { ssr: false });
const GeneralTab = dynamic(() => import("@/components/tabs/GeneralTab"), { ssr: false });

const TAB_LABELS: Record<string, string> = {
  map: "Map",
  plants: "Plants",
  zones: "Zones",
  build: "Build",
  general: "Resources",
  property: "Property",
};

interface ResourceWindowProps {
  activeTab: string | null;
  visitedTabs: Set<string>;
  onTabChange: (tab: string) => void;
  lat?: number;
  lng?: number;
  profileId?: string;
  jurisdictionCode?: string;
}

export default function ResourceWindow({
  activeTab,
  visitedTabs,
  onTabChange,
  lat,
  lng,
  profileId,
  jurisdictionCode,
}: ResourceWindowProps) {
  const tabsToShow = Array.from(visitedTabs);

  return (
    <div className="flex flex-col h-full">
      {/* Tab pills — only show when multiple tabs have been visited */}
      {tabsToShow.length > 1 && (
        <div className="flex gap-1 px-4 py-2 border-b border-outline-variant/15 overflow-x-auto">
          {tabsToShow.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-3 py-1 rounded-full text-xs font-headline font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {TAB_LABELS[tab] ?? tab}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {!activeTab && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-full bg-primary-container/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <p className="text-on-surface-variant font-body text-sm">
              Ask a question to get started. Relevant resources will appear here.
            </p>
          </div>
        )}

        {activeTab === "map" && <MapTab lat={lat} lng={lng} profileId={profileId} />}
        {activeTab === "plants" && <PlantsTab jurisdictionCode={jurisdictionCode} />}
        {activeTab === "zones" && <ZonesTab jurisdictionCode={jurisdictionCode} />}
        {activeTab === "build" && <BuildTab />}
        {(activeTab === "general" || activeTab === "property") && <GeneralTab />}
      </div>
    </div>
  );
}
