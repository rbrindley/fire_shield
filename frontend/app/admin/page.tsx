"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Enter the admin token.");
      return;
    }
    // Store in cookie for backend auth check
    document.cookie = `admin_token=${encodeURIComponent(token)}; path=/; SameSite=Strict`;
    router.push("/admin/corpus");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-stone-900 mb-1">Admin</h1>
        <p className="text-sm text-stone-500 mb-5">Fire Shield corpus management</p>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Admin token"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
