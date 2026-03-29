"use client";

import dynamic from "next/dynamic";

const MapTab = dynamic(() => import("@/components/tabs/MapTab"), { ssr: false });
const PlantsTab = dynamic(() => import("@/components/tabs/PlantsTab"), { ssr: false });
const ZonesTab = dynamic(() => import("@/components/tabs/ZonesTab"), { ssr: false });
const BuildTab = dynamic(() => import("@/components/tabs/BuildTab"), { ssr: false });
const GeneralTab = dynamic(() => import("@/components/tabs/GeneralTab"), { ssr: false });

const ALL_TABS = [
  { key: "map", label: "Map", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { key: "plants", label: "Plants", icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" },
  { key: "zones", label: "Zones", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
  { key: "build", label: "Teachers", icon: "M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" },
  { key: "general", label: "Resources", icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" },
];

interface TabContext {
  search_query?: string;
  zone_filter?: string;
}

interface ResourceWindowProps {
  activeTab: string | null;
  visitedTabs: Set<string>;
  onTabChange: (tab: string) => void;
  lat?: number;
  lng?: number;
  profileId?: string;
  jurisdictionCode?: string;
  tabContext?: TabContext | null;
}

export default function ResourceWindow({
  activeTab,
  visitedTabs,
  onTabChange,
  lat,
  lng,
  profileId,
  jurisdictionCode,
  tabContext,
}: ResourceWindowProps) {
  return (
    <div className="flex flex-col h-full">
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
        {activeTab === "plants" && <PlantsTab jurisdictionCode={jurisdictionCode} tabContext={tabContext} />}
        {activeTab === "zones" && <ZonesTab jurisdictionCode={jurisdictionCode} />}
        {activeTab === "build" && <BuildTab />}
        {(activeTab === "general" || activeTab === "property") && <GeneralTab />}
      </div>

      {/* Bottom tab bar */}
      <div className="flex items-center justify-around border-t border-outline-variant/15 bg-surface-container-low px-2 py-1.5">
        {ALL_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0 ${
              activeTab === tab.key
                ? "text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            <span className="text-[10px] font-headline font-medium leading-tight">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
