import { NextRequest, NextResponse } from "next/server";

// Paths that support text/markdown responses for AI agents
const MARKDOWN_PATHS = ["/plants", "/zones"];

export function proxy(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";

  // If client explicitly accepts text/markdown, redirect to the llms-full API route
  // which returns the full Markdown content dump
  if (
    accept.includes("text/markdown") &&
    MARKDOWN_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/llms-full";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/plants/:path*", "/zones/:path*"],
};
