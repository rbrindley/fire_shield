"use client";

import { useState } from "react";

interface AddressBarProps {
  address: string | null;
  onAddressChange: (data: { lat: number; lng: number; address: string; jurisdiction_code: string; jurisdiction_display: string; property_profile_id?: string }) => void;
}

export default function AddressBar({ address, onAddressChange }: AddressBarProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
      const latLngMatch = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
      const res = await fetch(`${apiUrl}/api/jurisdiction/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          latLngMatch
            ? { address: trimmed, lat: parseFloat(latLngMatch[1]), lng: parseFloat(latLngMatch[2]) }
            : { address: trimmed }
        ),
      });
      if (!res.ok) throw new Error("resolve failed");
      const data = await res.json();
      sessionStorage.setItem("property", JSON.stringify(data));
      onAddressChange(data);
      setEditing(false);
      setValue("");
    } catch {
      setError("Couldn\u2019t locate that address.");
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2 bg-surface-container-low">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter address or lat,lng"
          className="flex-1 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
          autoFocus
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "\u2026" : "Set"}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setError(null); }}
          className="px-3 py-1.5 text-on-surface-variant text-xs hover:text-on-surface"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-error">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low">
      <svg className="w-4 h-4 text-outline flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="text-sm text-on-surface font-body truncate">
        {address || "No address set"}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="ml-auto text-xs text-primary hover:text-on-primary-container font-medium flex-shrink-0"
      >
        Change
      </button>
    </div>
  );
}
