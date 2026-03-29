# MCP Server

Fire Shield exposes an MCP (Model Context Protocol) server at port 3001. It provides two tools that AI agents can use to query fire preparedness data without building their own HTTP integration.

## Connection

**Transport:** SSE (Server-Sent Events)
**SSE endpoint:** `http://localhost:3101/sse`
**Message endpoint:** `POST http://localhost:3101/messages?sessionId=<id>`
**Health check:** `GET http://localhost:3101/health`

### Claude Desktop / MCP Client Config

```json
{
  "mcpServers": {
    "fire-shield": {
      "url": "http://localhost:3101/sse",
      "transport": "sse"
    }
  }
}
```

For production (Railway deployment):
```json
{
  "mcpServers": {
    "fire-shield": {
      "url": "https://your-railway-app.up.railway.app/sse",
      "transport": "sse"
    }
  }
}
```

---

## Tools

### `search_plants`

Search the Living with Fire fire-resistant plant database. Returns plants suitable for wildfire-resilient landscaping in the Rogue Valley.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | No | Natural language search, e.g. `"native shrubs near the house"` |
| `zone` | enum | No | HIZ zone: `zone_0_5ft`, `zone_5_30ft`, `zone_30_100ft`, `zone_100ft_plus` |
| `native` | boolean | No | Oregon native plants only |
| `deer_resistant` | boolean | No | Deer-resistant plants only |
| `pollinator_support` | boolean | No | Pollinator-supporting plants only |
| `sun` | enum | No | Sun exposure: `full`, `partial`, `shade` |
| `water_need` | enum | No | `low`, `medium`, `high` |
| `exclude_restricted` | boolean | No | Exclude Ashland-restricted plants |
| `limit` | number | No | Max results (default 20, max 50) |

**Example call:**
```json
{
  "name": "search_plants",
  "arguments": {
    "zone": "zone_0_5ft",
    "native": true,
    "water_need": "low",
    "limit": 10
  }
}
```

**Response shape:**
```json
{
  "total": 8,
  "plants": [
    {
      "id": "lwf-uuid",
      "common_name": "Oregon White Oak",
      "scientific_name": "Quercus garryana",
      "plant_type": "tree",
      "zone_suitability": {
        "0-5ft": false,
        "5-30ft": true,
        "30-100ft": true,
        "100ft+": true
      },
      "water_need": "low",
      "is_native": true,
      "deer_resistant": true,
      "pollinator_support": true,
      "sun": "full",
      "mature_height_max_ft": 70,
      "fire_behavior_notes": "Deep-rooted, drought tolerant, deciduous — lower ignition risk",
      "ashland_restricted": false,
      "ashland_restriction_type": null,
      "source_citation": "Living with Fire Plant Database, LWF #abc123"
    }
  ],
  "query_params": { "zone": "zone_5_30ft", "native": true }
}
```

---

### `get_zone_actions`

Get Home Ignition Zone (HIZ) action recommendations. Resolves jurisdiction from address or coordinates and returns prioritized actions by zone layer.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | string | No | Full address, e.g. `"123 Main St, Ashland, OR 97520"` |
| `lat` | number | No | Latitude (alternative to address) |
| `lng` | number | No | Longitude (alternative to address) |
| `jurisdiction_code` | string | No | Known code: `ashland`, `jackson_county`, etc. |
| `season` | enum | No | `spring`, `summer`, `fall`, `winter` (auto-detected if omitted) |
| `top_n` | number | No | Return top N actions across all layers (default: all) |

At least one of `address`, lat/lng pair, or `jurisdiction_code` is required.

**Example call:**
```json
{
  "name": "get_zone_actions",
  "arguments": {
    "address": "1234 Greensprings Hwy, Ashland, OR 97520",
    "season": "summer",
    "top_n": 5
  }
}
```

**Response shape:**
```json
{
  "resolved_jurisdiction": "City of Ashland, Oregon",
  "jurisdiction_code": "ashland",
  "jurisdiction_chain": ["ashland","jackson_county","oregon_state","federal","universal"],
  "jurisdiction_note": null,
  "lat": 42.195,
  "lng": -122.709,
  "property_profile_id": "uuid",
  "zones": [
    {
      "layer": 0,
      "layer_name": "The House Itself",
      "layer_description": "...",
      "actions": [
        {
          "id": "layer0-vent-screening",
          "action_title": "Screen all vents",
          "action_detail": "Install 1/16\" corrosion-resistant metal mesh...",
          "why_it_matters": "Ember intrusion through vents is the #1 cause...",
          "effort_level": "low",
          "effective_priority": 1.0,
          "is_seasonal_peak": true
        }
      ]
    }
  ]
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FIRE_SHIELD_API_URL` | `http://localhost:8100` | Backend API to proxy requests to |
| `MCP_PORT` | `3001` | Port to listen on |

---

## Running Locally

```bash
cd mcp_server
node index.js
# Server listening on http://localhost:3101
```

---

## Production Deployment

The MCP server is deployed on Railway. See [deployment.md](../operations/deployment.md) for setup steps.

The `railway.json` config uses:
- Builder: Nixpacks
- Start: `node index.js`
- Health check: `GET /health`
- Restart policy: `ON_FAILURE` (max 3 retries)
