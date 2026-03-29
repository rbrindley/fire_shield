# AI Quick Start — Fire Shield Agent Onboarding

This is the single entry point for onboarding a new AI agent to the Fire Shield codebase. Work through the steps below before taking on any task.

---

## Step 1: Purpose, Users, and Scope

**What Fire Shield does:**
Fire Shield is a property-specific wildfire prevention assistant for the Rogue Valley, Southern Oregon. A homeowner enters their address and receives:
1. A zone-based action plan organized by the Home Ignition Zone (HIZ) framework (5 concentric layers, 17 total actions)
2. Evidence-grounded chat answers via a RAG pipeline filtered to their local jurisdiction
3. Fire-resistant plant recommendations from the Living with Fire database

**Who uses it:**

| User | Context | Key Action |
|------|---------|-----------|
| Homeowner | Enters address, reviews plan, asks questions | Uses /map, /plants, /chat |
| Fire professional | Pro-mode chat with code citations | Uses /chat?mode=pro |
| AI agent | MCP tools or direct API | search_plants, get_zone_actions |
| Operator | Manages corpus and plant data | Uses /admin |

**What it does NOT do:**
- No user authentication (no accounts, no passwords)
- No real-time fire mapping or active incident tracking
- No jurisdictions beyond the Rogue Valley (Jackson/Josephine counties, Oregon)
- No automated document ingestion (operators manually add corpus documents)

---

## Step 2: Architecture and Standards

**Tech stack:**

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Python 3.11, SQLite (aiosqlite), Qdrant |
| Embeddings | BAAI/bge-large-en-v1.5 |
| Reranking | BAAI/bge-reranker-large |
| LLM | Claude claude-sonnet-4-6 |
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Maps | Leaflet + Turf.js |
| MCP | Express + @modelcontextprotocol/sdk |

**Directory layout:**
```
fire_shield/
├── backend/            # FastAPI app
│   ├── app/
│   │   ├── config/     # Settings, DB, app factory
│   │   ├── rag/        # Retrieve → Rerank → Generate
│   │   ├── zone/       # HIZ zone engine
│   │   ├── plant/      # Plant DB + LWF sync
│   │   ├── jurisdiction/ # Geocoding + profiles
│   │   ├── ingest/     # Document ingestion pipeline
│   │   ├── admin/      # Admin API
│   │   └── migrations/ # SQL migration files
│   └── tests/          # pytest tests (unit + integration)
├── frontend/           # Next.js PWA
│   ├── app/            # Pages (App Router)
│   └── components/     # Shared components
└── mcp_server/         # Express MCP server (index.js)
```

**Key conventions:**
- All DB calls use `async with get_db() as db:` (aiosqlite async context manager)
- Migrations are SQL files in `backend/app/migrations/`, run automatically at startup via `init_db()`
- Environment config lives in `backend/app/config/config.py` (Pydantic Settings)
- Admin routes require `admin_token` cookie; all other routes are public
- `sessionStorage` (not localStorage) stores property context in the frontend

---

## Step 3: Core Subsystems

### 3a. Jurisdiction Chain System
The mechanism that scopes corpus retrieval to the user's location.

- City → county → state → federal → universal hierarchy
- Example: `ashland` → `["ashland","jackson_county","oregon_state","federal","universal"]`
- Used to filter FTS5 and Qdrant searches so Medford users don't see Jacksonville-specific ordinances
- Full reference: [architecture/jurisdiction-chain.md](./architecture/jurisdiction-chain.md)
- Key file: `backend/app/rag/smart_filter.py` (`build_jurisdiction_chain()`)

### 3b. RAG Pipeline
Answers natural language wildfire questions using the ingested corpus.

Flow: question + jurisdiction → FTS5 search + Qdrant vector search → merge → CrossEncoder rerank (× trust tier boost) → Claude generation

- Profiles: `simple` (bullets), `pro` (code citations), `agent` (JSON)
- Trust tier boost: tier 1 gets ×1.20, tier 6 gets ×0.90
- Optional: NWS fire/red flag alerts via tool-use (when lat/lng provided)
- Full reference: [architecture/rag-pipeline.md](./architecture/rag-pipeline.md)
- Key files: `backend/app/rag/retrieve.py`, `rerank.py`, `generate.py`

### 3c. HIZ Zone Engine
Computes prioritized actions for all 5 zone layers with seasonal adjustments.

- 17 actions seeded from `003_seed_zone_actions.sql`, organized by layer
- Seasonal boost: +0.15 for peak months, +0.10 for fire season (June–Sep) on layers 0–1, capped at 1.0
- `get_zone_actions(jurisdiction_code, season)` and `get_top_actions(n)`
- Full reference: [architecture/hiz-zones.md](./architecture/hiz-zones.md)
- Key file: `backend/app/zone/engine.py`

### 3d. MCP Server
Two tools for external AI agents:
- `search_plants` — fire-resistant plant search with zone/native/water filters
- `get_zone_actions` — resolve address → jurisdiction → prioritized HIZ actions

Full reference: [api/mcp-server.md](./api/mcp-server.md)

---

## Step 4: Verify It's Working

Run these checks once the app is running (see [operations/setup.md](./operations/setup.md)):

```bash
# 1. Backend health
curl http://localhost:8000/health
# Expected: {"status": "healthy", "app": "fire_shield", "version": "1.0.0"}

# 2. Zone actions (no API key needed)
curl "http://localhost:8000/api/zones/top?n=3"
# Expected: JSON array of 3 zone actions with action_title, layer, effective_priority

# 3. Plant search
curl "http://localhost:8000/api/plants/search?native=true&zone=zone_0_5ft&limit=5"
# Expected: {"plants": [...], "total": N, ...}

# 4. Jurisdiction resolve
curl -X POST http://localhost:8000/api/jurisdiction/resolve \
  -H "Content-Type: application/json" \
  -d '{"address": "1234 Greensprings Hwy, Ashland, OR 97520"}'
# Expected: {"jurisdiction_code": "ashland", "lat": ..., "lng": ..., ...}

# 5. RAG query (requires ANTHROPIC_API_KEY + ingested documents)
curl -X POST http://localhost:8000/api/query/ \
  -H "Content-Type: application/json" \
  -d '{"question": "What is defensible space?", "jurisdiction_code": "ashland"}'
# Expected: {"answer": "...", "citations": [...]}
```

---

## Step 5: Where to Find Things

| Question | Go here |
|----------|---------|
| How does jurisdiction filtering work? | [architecture/jurisdiction-chain.md](./architecture/jurisdiction-chain.md) + `app/rag/smart_filter.py` |
| Why did a RAG answer include/exclude a document? | [architecture/rag-pipeline.md](./architecture/rag-pipeline.md) + `app/rag/retrieve.py` |
| What are all the zone actions and scores? | [architecture/hiz-zones.md](./architecture/hiz-zones.md) + `app/migrations/003_seed_zone_actions.sql` |
| What does each DB table contain? | [architecture/data-model.md](./architecture/data-model.md) |
| What are all the API endpoints? | [api/endpoints.md](./api/endpoints.md) |
| How does the query endpoint work in detail? | [api/query-api.md](./api/query-api.md) |
| What MCP tools are available? | [api/mcp-server.md](./api/mcp-server.md) |
| What does each backend module own? | [components/backend-modules.md](./components/backend-modules.md) |
| What are the ZoneCard / CitationLink props? | [components/frontend-components.md](./components/frontend-components.md) |
| How to run locally from scratch? | [operations/setup.md](./operations/setup.md) |
| How to ingest or retire a document? | [operations/corpus-management.md](./operations/corpus-management.md) |
| How to deploy to fly.io / Vercel / Railway? | [operations/deployment.md](./operations/deployment.md) |
| What's planned but not yet built? | [../backlog.md](../backlog.md) |
