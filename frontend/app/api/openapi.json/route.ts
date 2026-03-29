import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/openapi.json`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch OpenAPI spec from backend" },
        { status: res.status }
      );
    }
    const spec = await res.json();
    return NextResponse.json(spec, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Signal": "ai-train=no, search=yes, ai-input=yes",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 502 }
    );
  }
}
