"use client";

import dynamic from "next/dynamic";

const HIZMap = dynamic(() => import("@/components/HIZMap"), { ssr: false });

interface MapTabProps {
  lat?: number;
  lng?: number;
  profileId?: string;
}

export default function MapTab({ lat, lng, profileId }: MapTabProps) {
  if (!lat || !lng) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <p className="text-on-surface-variant font-body text-sm">
          Enter your address to see your property on the map with defensible space zones.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <HIZMap
        lat={lat}
        lng={lng}
        jurisdictionDisplay=""
        profileId={profileId ?? ""}
      />
    </div>
  );
}
