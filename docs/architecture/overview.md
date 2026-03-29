# Architecture Overview

Fire Shield is a property-specific wildfire prevention assistant for the Rogue Valley, Oregon. A homeowner enters their address and receives a zone-based action plan, evidence-grounded guidance via RAG chat, and fire-resistant plant recommendations — all scoped to their local jurisdiction.

## Components

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser / AI Agent                                             │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Next.js PWA │  │  MCP Client      │  │ curl / llms.txt  │  │
│  └──────┬──────┘  └────────┬─────────┘  └────────┬─────────┘  │
└─────────│──────────────────│────────────────────│──────────────┘
          │ HTTP              │ SSE/MCP            │ HTTP
┌─────────▼──────────────────▼────────────────────▼──────────────┐
│  Services                                                       │
│  ┌──────────────────┐      ┌───────────────────────────────┐   │
│  │ FastAPI Backend  │      │ Express MCP Server            │   │
│  │ :8000            │◄─────│ :3001                         │   │
│  └──────┬───────────┘      └───────────────────────────────┘   │
│         │                                                       │
│  ┌──────▼───────┐  ┌───────────────┐  ┌──────────────────┐    │
│  │ SQLite DB    │  │ Qdrant        │  │ External APIs    │    │
│  │ data/app.db  │  │ :6333         │  │ Nominatim / NWS  │    │
│  └──────────────┘  └───────────────┘  │ LWF / Claude     │    │
│                                       └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Address → Action Plan

```
User enters address
        │
        ▼
POST /api/jurisdiction/resolve
        │ Nominatim geocode → city/county extraction
        │ CITY_TO_JURISDICTION lookup → jurisdiction_code
        │ DB: jurisdictions.jurisdiction_chain (precomputed JSON)
        ▼
Property stored in sessionStorage (frontend) + DB property_profiles
        │
        ▼
GET /api/zones/
        │ SELECT zone_actions ORDER BY layer, rank_in_layer
        │ _apply_seasonal_boost() → effective_priority
        ▼
ZoneCards rendered per layer (Layer 0–4)
```

## Data Flow: RAG Chat Query

```
User question + jurisdiction_code
        │
        ▼
build_jurisdiction_chain() → ['ashland','jackson_county','oregon_state','federal','universal']
        │
        ├── FTS5 search (chunks WHERE jurisdiction IN chain AND status='active')
        └── Qdrant vector search (MatchAny jurisdiction filter)
                │
                ▼
        rerank_chunks() → CrossEncoder scores × TRUST_TIER_BOOST
                │
                ▼
        generate_answer() → Claude claude-sonnet-4-6
                │ Wildfire system prompt + jurisdiction context + profile mode
                │ Optional: NWS tool-use (fire weather alerts)
                ▼
        Response: answer + citations + jurisdiction_note + nws_alert
```

## Technology Choices

| Decision | Choice | Reason |
|---|---|---|
| Backend | FastAPI + Python | Async, native Pydantic, easy Claude SDK integration |
| DB | SQLite | Zero-infra for demo; migrations via plain SQL files |
| Vector store | Qdrant | Local Docker, jurisdiction metadata in payload |
| Geocoding | Nominatim | Free, no API key required |
| Embeddings | BAAI/bge-large-en-v1.5 | Open-source, runs on CPU |
| Reranking | BAAI/bge-reranker-large | Same family, strong cross-encoder |
| LLM | Claude claude-sonnet-4-6 | Citation-following, structured output |
| Frontend | Next.js 16 + React 19 | File-based routing, SSR, built-in TypeScript |
| Maps | Leaflet + Turf.js | Open-source, no API key, buffer calculations |
| MCP | Express + @modelcontextprotocol/sdk | Official SDK, SSE transport |

## Related Docs

- [Jurisdiction Chain](./jurisdiction-chain.md) — how city→county→state filtering works
- [RAG Pipeline](./rag-pipeline.md) — retrieve, rerank, generate detail
- [HIZ Zones](./hiz-zones.md) — 5 zone layers and seasonal boost math
- [Data Model](./data-model.md) — database schema overview
