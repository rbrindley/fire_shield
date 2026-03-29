#!/usr/bin/env node
/**
 * Fire Shield MCP Server
 *
 * Exposes wildfire preparedness tools via Model Context Protocol (SSE transport).
 * Tools:
 *   - search_plants: Query the fire-resistant plant database
 *   - get_zone_actions: Get HIZ zone actions for a property address or lat/lng
 *
 * Usage:
 *   node index.js
 *
 * Environment:
 *   FIRE_SHIELD_API_URL  — FastAPI backend URL (default: http://localhost:8000)
 *   MCP_PORT             — Server port (default: 3001)
 */

const http = require("http");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { z } = require("zod");

const API_URL = process.env.FIRE_SHIELD_API_URL || "http://localhost:8000";
const PORT = parseInt(process.env.MCP_PORT || "3001", 10);

// ── HTTP helper ──────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }
  return response.json();
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "fire-shield",
  version: "1.0.0",
  description: "Wildfire preparedness tools for the Rogue Valley (Southern Oregon)",
});

// Tool: search_plants
server.tool(
  "search_plants",
  "Search the Living with Fire fire-resistant plant database. Returns plants suitable for wildfire-resilient landscaping in the Rogue Valley.",
  {
    query: z.string().optional().describe("Natural language search, e.g. 'native shrubs near the house'"),
    zone: z.enum(["zone_0_5ft", "zone_5_30ft", "zone_30_100ft", "zone_100ft_plus"])
      .optional()
      .describe("Filter to plants recommended for a specific Home Ignition Zone"),
    native: z.boolean().optional().describe("Filter to Oregon native plants only"),
    deer_resistant: z.boolean().optional().describe("Filter to deer-resistant plants only"),
    pollinator_support: z.boolean().optional().describe("Filter to plants that support pollinators"),
    sun: z.enum(["full", "partial", "shade"]).optional().describe("Sun exposure requirement"),
    water_need: z.enum(["low", "medium", "high"]).optional().describe("Water requirement"),
    exclude_restricted: z.boolean().optional().describe("Exclude Ashland-restricted plants"),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum results (default: 20)"),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.query) qs.set("query", params.query);
    if (params.zone) qs.set("zone", params.zone);
    if (params.native) qs.set("native", "true");
    if (params.deer_resistant) qs.set("deer_resistant", "true");
    if (params.pollinator_support) qs.set("pollinator_support", "true");
    if (params.sun) qs.set("sun", params.sun);
    if (params.water_need) qs.set("water_need", params.water_need);
    if (params.exclude_restricted) qs.set("exclude_restricted", "true");
    qs.set("limit", String(params.limit || 20));
    qs.set("exclude_noxious", "true");

    const data = await apiFetch(`/api/plants/search?${qs}`);

    const plants = (data.plants || []).map((p) => ({
      id: p.id,
      common_name: p.common_name,
      scientific_name: p.scientific_name,
      plant_type: p.plant_type,
      zone_suitability: {
        "0-5ft": p.zone_0_5ft,
        "5-30ft": p.zone_5_30ft,
        "30-100ft": p.zone_30_100ft,
        "100ft+": p.zone_100ft_plus,
      },
      water_need: p.water_need,
      is_native: p.is_native,
      deer_resistant: p.deer_resistant,
      pollinator_support: p.pollinator_support,
      sun: p.sun,
      mature_height_max_ft: p.mature_height_max_ft,
      fire_behavior_notes: p.fire_behavior_notes,
      ashland_restricted: p.ashland_restricted,
      ashland_restriction_type: p.ashland_restriction_type,
      source_citation: p.source_url
        ? `Living with Fire plant database — ${p.source_url}`
        : "Living with Fire plant database",
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total: data.total,
            plants,
            query_params: Object.fromEntries(qs),
          }, null, 2),
        },
      ],
    };
  }
);

// Tool: get_zone_actions
server.tool(
  "get_zone_actions",
  "Get Home Ignition Zone (HIZ) action recommendations for a property. Resolves jurisdiction from address or lat/lng and returns prioritized actions by zone layer.",
  {
    address: z.string().optional().describe("Full address, e.g. '123 Main St, Ashland, OR 97520'"),
    lat: z.number().optional().describe("Latitude (alternative to address)"),
    lng: z.number().optional().describe("Longitude (alternative to address)"),
    jurisdiction_code: z.string().optional().describe("Known jurisdiction code (e.g. 'ashland', 'jackson_county')"),
    season: z.enum(["spring", "summer", "fall", "winter"]).optional().describe("Current season for seasonal boost (auto-detected if omitted)"),
    top_n: z.number().int().min(1).max(20).optional().describe("Return top N actions across all layers (default: all)"),
  },
  async (params) => {
    let jurisdictionCode = params.jurisdiction_code || "jackson_county";
    let lat = params.lat;
    let lng = params.lng;
    let jurisdictionDisplay = jurisdictionCode;
    let propertyProfileId = null;

    // Geocode address if provided
    if (params.address && !params.lat) {
      try {
        const resolved = await apiFetch("/api/jurisdiction/resolve", {
          method: "POST",
          body: JSON.stringify({ address: params.address }),
        });
        jurisdictionCode = resolved.jurisdiction_code || jurisdictionCode;
        jurisdictionDisplay = resolved.jurisdiction_display || jurisdictionCode;
        lat = resolved.lat;
        lng = resolved.lng;
        propertyProfileId = resolved.property_profile_id;
      } catch (e) {
        // Geocoding failed — proceed with default jurisdiction
      }
    }

    // Get zone actions
    const qs = new URLSearchParams({ jurisdiction: jurisdictionCode });
    if (params.season) qs.set("season", params.season);
    if (params.top_n) {
      qs.set("limit", String(params.top_n));
    }

    const data = await apiFetch(`/api/zones/?${qs}`);
    const zones = data.zones || data;

    // Build jurisdiction note
    const jurisdictionNote = resolveJurisdictionNote(jurisdictionCode);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            resolved_jurisdiction: jurisdictionDisplay,
            jurisdiction_code: jurisdictionCode,
            jurisdiction_chain: data.jurisdiction_chain || [],
            jurisdiction_note: jurisdictionNote,
            lat,
            lng,
            property_profile_id: propertyProfileId,
            zones: zones,
          }, null, 2),
        },
      ],
    };
  }
);

function resolveJurisdictionNote(jurisdictionCode) {
  const citySpecific = ["ashland", "jacksonville", "medford", "talent", "phoenix", "central_point", "eagle_point"];
  if (citySpecific.includes(jurisdictionCode)) {
    return `Showing ${jurisdictionCode.replace("_", " ")} + Jackson County + Oregon state + universal guidance. For city-specific ordinances, contact your local fire department.`;
  }
  return "Showing Jackson County + Oregon state + universal wildfire guidance.";
}

// ── SSE Transport ─────────────────────────────────────────────────────────────

const transports = new Map();

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === "/sse" && req.method === "GET") {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    res.on("close", () => {
      transports.delete(sessionId);
    });

    await server.connect(transport);
    return;
  }

  if (url.pathname === "/messages" && req.method === "POST") {
    const sessionId = url.searchParams.get("sessionId");
    const transport = transports.get(sessionId);

    if (!transport) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        await transport.handlePostMessage(req, res, JSON.parse(body));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "fire-shield-mcp", version: "1.0.0" }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.log(`Fire Shield MCP server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Backend API: ${API_URL}`);
});
