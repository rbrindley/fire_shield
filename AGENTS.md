# AGENTS.md — Fire Shield

Instructions for coding agents (Claude Code, Codex, Cursor, Devin, Jules, Gemini CLI) working on this codebase.

For human builders who want to use Fire Shield's data to build projects, see [BUILDERS.md](BUILDERS.md).

---

## Project Overview

Fire Shield is a wildfire prevention assistant for Southern Oregon's Rogue Valley. It turns a property address into a zone-based action plan with cited recommendations using the Home Ignition Zone (HIZ) framework. The system includes a RAG chat advisor, fire-resistant plant database, zone action engine, and an MCP server for agent integration.

---

## Architecture

Fire Shield is a **three-service** application, not a monolith:

| Service | Stack | Port | Directory |
|---------|-------|------|-----------|
| Backend API | FastAPI (Python 3.11+) | 8100 | `backend/` |
| Frontend | Next.js 16 (App Router) + React 19 | 3100 | `frontend/` |
| MCP Server | Node.js + MCP SDK (SSE) | 3101 | `mcp_server/` |

All three are started together via `./start.sh` from the repo root.

---

## Project Structure

```
fire_shield/
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── admin/              # Admin CRUD endpoints
│   │   ├── auth/               # User authentication
│   │   ├── building/           # Microsoft building footprint queries
│   │   ├── config/             # Settings (Pydantic), DB init
│   │   ├── evidence/           # Evidence chunk retrieval
│   │   ├── ingest/             # Document ingestion pipeline
│   │   ├── jurisdiction/       # Geocoding + jurisdiction resolver
│   │   ├── memory/             # Conversation memory extraction
│   │   ├── models/             # Pydantic models (query, citation, etc.)
│   │   ├── nursery/            # Nature Hills nursery search
│   │   ├── plant/              # Plant database search
│   │   ├── rag/                # RAG engine (retrieve, rerank, generate)
│   │   └── zone/               # Zone action engine + seasonal boosting
│   ├── data/                   # SQLite database (app.db)
│   ├── main.py                 # Uvicorn entry point
│   └── pyproject.toml          # Python dependencies
│
├── frontend/                   # Next.js frontend
│   ├── app/
│   │   ├── main/               # Two-panel dashboard (chat + resources)
│   │   ├── map/                # Leaflet map with HIZ zone rings
│   │   ├── plants/             # Plant search + card grid
│   │   ├── build/              # Developer tools + starter prompts
│   │   ├── agents/             # "For Agents" info page
│   │   ├── admin/              # Admin dashboard (corpus, plants, zones)
│   │   └── api/
│   │       └── llms-full/      # Markdown content dump for agents
│   ├── components/
│   │   ├── ChatPanel.tsx       # Reusable chat with intent classification
│   │   ├── HIZMap.tsx          # Leaflet map with zone rings + footprints
│   │   ├── ResourceWindow.tsx  # Dynamic tab container
│   │   └── tabs/               # MapTab, PlantsTab, ZonesTab, BuildTab, GeneralTab
│   └── public/
│       └── llms.txt            # Static agent site index
│
├── mcp_server/                 # MCP server (SSE transport)
│   └── index.js                # search_plants, get_zone_actions, nursery_lookup
│
├── docs/                       # Documentation
│   ├── api/                    # API reference, MCP guide, query docs
│   ├── architecture/           # System design docs
│   └── spec/                   # Original build spec
│
├── AGENTS.md                   # This file
├── BUILDERS.md                 # Guide for humans building with Fire Shield data
├── README.md                   # Project README
└── start.sh                    # Start all services
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for RAG generation |
| `CLAUDE_MODEL` | No | Model ID (default: `claude-sonnet-4-6`) |
| `DATABASE_URL` | No | SQLite path (default: `data/app.db`) |
| `ADMIN_TOKEN` | No | Admin API token |
| `QDRANT_HOST` | No | Qdrant host (default: `localhost`) |
| `QDRANT_PORT` | No | Qdrant port (default: `6333`) |
| `QDRANT_COLLECTION` | No | Collection name (default: `fire_shield_chunks`) |
| `EMBEDDING_MODEL` | No | Sentence transformer model (default: `BAAI/bge-large-en-v1.5`) |
| `EMBEDDING_DEVICE` | No | `auto`, `cuda`, or `cpu` |
| `NWS_USER_AGENT` | No | User-Agent for NWS weather API |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Backend URL (default: `http://localhost:8100`) |

### MCP Server (environment)

| Variable | Required | Description |
|----------|----------|-------------|
| `FIRE_SHIELD_API_URL` | No | Backend URL (default: `http://localhost:8100`) |
| `MCP_PORT` | No | Server port (default: `3101`) |

---

## How to Run Locally

```bash
# Start all services (backend + frontend + MCP + Qdrant)
./start.sh

# Or start individually:
cd backend && uvicorn app.main:app --port 8100 --reload
cd frontend && npm run dev
cd mcp_server && node index.js
```

Backend requires Python 3.11+. Frontend requires Node.js 18+.

---

## How to Run Tests

```bash
# Frontend tests
cd frontend && npm test

# Frontend build check (catches TypeScript errors)
cd frontend && npm run build
```

---

## Coding Conventions

- **Frontend**: TypeScript strict mode, Tailwind CSS only (no CSS modules), `"use client"` only when needed.
- **Backend**: Python type hints, Pydantic models for all request/response payloads.
- **Fonts**: Manrope for headlines (`font-headline`), Inter for body (`font-body`). Never use system fonts.
- **Colors**: Material Design 3 tokens via CSS variables. Never use raw hex colors or default Tailwind colors. Use `text-on-surface`, `bg-primary`, etc.
- **No pure black**: Use `#1b1c1a` (warm charcoal) via `text-on-surface`. Never use `#000000`.
- **No 1px borders**: Use tonal shifts (`bg-surface-container-low` vs `bg-surface`) or ghost borders (`border-outline-variant/15`).

---

## Key Architectural Rules

1. **Deterministic logic must not use the LLM.** Zone geometry, plant filters, jurisdiction resolution, action scoring — all deterministic. The LLM explains and synthesizes; it does not decide.
2. **Every recommendation must carry a citation.** RAG chunks carry: source_url, doc_title, trust_tier, jurisdiction, section_title, document_date.
3. **Jurisdiction filtering is mandatory.** Never return results without filtering by the property's resolved jurisdiction chain.
4. **Trust hierarchy**: Local code (Tier 1) > Agency guidance (Tier 2) > Fire science (Tier 3) > Best practice (Tier 4+).
5. **Intent classification** is embedded in the RAG response via `<!-- INTENT_JSON: {...} -->` blocks parsed by `_extract_intent_and_resources()` in `backend/app/rag/generate.py`.

---

## Important: Next.js Version

The frontend uses Next.js 16 which has breaking changes from prior versions. **Read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing any frontend code.** Do not rely on training data for Next.js APIs.
