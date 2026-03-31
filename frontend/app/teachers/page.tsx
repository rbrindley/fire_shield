"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ChatPanel from "@/components/ChatPanel";

const BuildTab = dynamic(() => import("@/components/tabs/BuildTab"), { ssr: false });

export default function TeachersPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)]">
      {/* Left panel — Build content */}
      <div className="flex-1 overflow-y-auto min-w-0 md:border-r border-outline-variant/15">
        <BuildTab />
      </div>

      {/* Right panel — chat (hidden on mobile unless toggled) */}
      <div className={`${chatOpen ? "fixed inset-0 z-50 bg-surface" : "hidden"} md:relative md:block md:w-[40%] md:min-w-[360px] md:max-w-[600px] flex flex-col bg-surface`}>
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
        <ChatPanel profile="teacher" />
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
