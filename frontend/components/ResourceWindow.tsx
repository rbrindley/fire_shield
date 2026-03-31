"use client";

import dynamic from "next/dynamic";

const MapTab = dynamic(() => import("@/components/tabs/MapTab"), { ssr: false });
const PlantsTab = dynamic(() => import("@/components/tabs/PlantsTab"), { ssr: false });
const ZonesTab = dynamic(() => import("@/components/tabs/ZonesTab"), { ssr: false });
const OrganizationsTab = dynamic(() => import("@/components/tabs/OrganizationsTab"), { ssr: false });
const GeneralTab = dynamic(() => import("@/components/tabs/GeneralTab"), { ssr: false });

const ALL_TABS = [
  { key: "map", label: "Map", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { key: "plants", label: "Plants", icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" },
  { key: "zones", label: "Zones", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
  { key: "orgs", label: "Orgs", icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" },
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
  visitedTabs: _visitedTabs,
  onTabChange,
  lat,
  lng,
  profileId,
  jurisdictionCode,
  tabContext,
}: ResourceWindowProps) {
  // Normalize: "property" and "build" intents map to existing tabs
  const resolvedTab = activeTab === "property" ? "zones" : activeTab === "build" ? "orgs" : activeTab;

  return (
    <div className="flex flex-col h-full">
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {!resolvedTab && (
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

        {resolvedTab === "map" && <MapTab lat={lat} lng={lng} profileId={profileId} />}
        {resolvedTab === "plants" && <PlantsTab jurisdictionCode={jurisdictionCode} tabContext={tabContext} />}
        {resolvedTab === "zones" && <ZonesTab jurisdictionCode={jurisdictionCode} />}
        {resolvedTab === "orgs" && <OrganizationsTab />}
        {resolvedTab === "general" && <GeneralTab />}
      </div>

      {/* Bottom tab bar */}
      <div className="flex items-center justify-around border-t border-outline-variant/15 bg-surface-container-low px-2 py-1.5">
        {ALL_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0 ${
              resolvedTab === tab.key
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
