# Backend Module Map

All source lives under `backend/app/`. Each subdirectory is a self-contained module with its own `routes.py` (FastAPI router) where applicable.

## Module Overview

```
backend/app/
├── config/          # App factory, settings, DB init
├── rag/             # Retrieve → Rerank → Generate pipeline
├── zone/            # HIZ zone actions and seasonal engine
├── plant/           # Plant database and LWF sync
├── jurisdiction/    # Geocoding and property profiles
├── ingest/          # Document ingestion pipeline
├── admin/           # Admin API (corpus, plants, zones)
├── evidence/        # Chunk retrieval and PDF context
├── audit/           # Compliance audit logging
├── auth/            # Session authentication
├── middleware/      # HTTP middleware
├── models/          # Shared Pydantic models
└── migrations/      # SQL migration files
```

---

## `config/`

**Purpose:** Application setup — settings, DB connection, app factory.

| File | Responsibility |
|------|---------------|
| `config.py` | `Settings` class (Pydantic). Loads all env vars with defaults. Single source of truth for configuration. |
| `database.py` | `get_db()` async context manager for aiosqlite. `init_db()` runs migrations at startup. WAL mode enabled. |
| `main.py` | `create_app()` factory — registers all routers, CORS middleware, lifespan hook. |
| `app_init.py` | Initialization tasks run after startup (e.g., Qdrant collection creation). |

**Key pattern:**
```python
async with get_db() as db:
    result = await db.execute("SELECT ...")
```

---

## `rag/`

**Purpose:** Full RAG pipeline — FTS5 + vector retrieval, CrossEncoder reranking, Claude generation.

| File | Responsibility |
|------|---------------|
| `smart_filter.py` | `build_jurisdiction_chain(code)` — pure dict lookup, no DB call. `JURISDICTION_CHAINS` dict is the source of truth. |
| `retrieve.py` | `retrieve_chunks(question, chain)` — parallel FTS5 + Qdrant search, merge, deduplicate. |
| `rerank.py` | `rerank_chunks(question, chunks)` — CrossEncoder scores × `TRUST_TIER_BOOST`. Truncates to `settings.reranker_top_n`. |
| `generate.py` | `generate_answer()` — Claude call with system prompt, jurisdiction context, profile mode, optional NWS tool-use. `_extract_citations_and_renumber()` maps `[1]`,`[2]` refs to Citation objects. |
| `profiles.py` | Profile-specific system prompt snippets for `simple`/`pro`/`agent`. |
| `embedder.py` | `get_embedder()` singleton — loads `BAAI/bge-large-en-v1.5`, respects `EMBEDDING_DEVICE`. |
| `routes.py` | `POST /api/query/` endpoint. Orchestrates the full pipeline. |
| `phi_scanner.py` | Detects PHI (PII) in generated responses. |
| `verify.py` | Response faithfulness verification. |

**Trust tier boost constants** (in `rerank.py`):
```python
TRUST_TIER_BOOST = {1: 1.20, 2: 1.10, 3: 1.05, 4: 1.00, 5: 0.95, 6: 0.90}
```

---

## `zone/`

**Purpose:** HIZ zone action data and seasonal prioritization engine.

| File | Responsibility |
|------|---------------|
| `engine.py` | `get_zone_actions(jurisdiction_code, season)` — reads zone_actions table, applies `_apply_seasonal_boost()`, organizes into 5 layer dicts. `get_top_actions(n)` returns top N across all layers. |
| `routes.py` | `GET /api/zones/` and `GET /api/zones/top`. |

**Seasonal boost logic** (see [hiz-zones.md](../architecture/hiz-zones.md) for math):
- +0.15 if current month in action's `seasonal_peak`
- +0.10 if fire season (June–September) AND layer 0 or 1
- Capped at 1.0

---

## `plant/`

**Purpose:** Fire-resistant plant database (read) and LWF API sync (write).

| File | Responsibility |
|------|---------------|
| `adapter.py` | `sync_lwf_plants()` — fetches from Living with Fire API, upserts `plants` table, writes sync log row. |
| `routes.py` | `GET /api/plants/search` (with filters) and `GET /api/plants/{id}`. |

---

## `jurisdiction/`

**Purpose:** Address geocoding via Nominatim and property profile CRUD.

| File | Responsibility |
|------|---------------|
| `resolver.py` | `resolve_address(address)` — geocodes via Nominatim, calls `_extract_jurisdiction_from_nominatim()` to map city/county/state → jurisdiction code. `CITY_TO_JURISDICTION` dict is the lookup table. |
| `routes.py` | `POST /api/jurisdiction/resolve`, `GET/PATCH /api/jurisdiction/profile/{id}`, `GET /api/jurisdiction/jurisdictions`. |

**Resolution priority:** city field → town field → village field → partial city match → county fallback → state fallback → `"universal"`.

---

## `ingest/`

**Purpose:** Full document ingestion pipeline — extract text, chunk, embed, index.

| File | Responsibility |
|------|---------------|
| `pipeline.py` | `ingest_document(doc_id)` — orchestrates extract → chunk → validate → embed → index. Called asynchronously after route returns. |
| `extractor.py` | PDF text extraction (PyMuPDF) and HTML fetching. |
| `chunker.py` | Splits extracted text into chunks with section heading detection. |
| `chunk_validator.py` | Filters out chunks that are too short, too long, or mostly boilerplate. |
| `indexer.py` | `index_chunks(chunks)` — generates embeddings via `get_embedder()`, upserts to Qdrant with jurisdiction metadata. |
| `doc_type_detector.py` | Classifies document type (ordinance, guidance, scientific, etc.) for `doc_type` field. |
| `routes.py` | `POST /api/ingest/url`, `POST /api/ingest/upload`, `GET /api/ingest/status/{id}`. |

---

## `admin/`

**Purpose:** Admin API for corpus management, plant overrides, zone action edits, and plant sync.

| File | Responsibility |
|------|---------------|
| `routes.py` | All `/api/admin/*` routes. Requires `admin_token` cookie on every request. |

Admin operations:
- List/update/deprecate corpus sources
- Preview jurisdiction chain for a code
- Trigger LWF plant sync + view sync log
- Override individual plant metadata (ashland_restricted, placement_notes)
- List/update zone actions

---

## `evidence/`

**Purpose:** Serve raw chunk content and surrounding context for citation expansion in the UI.

| File | Responsibility |
|------|---------------|
| `service.py` | `get_chunk_detail(chunk_id)` and `get_surrounding_context(chunk_id, pages_before, pages_after)`. |
| `routes.py` | `GET /api/evidence/chunk/{id}`, `GET /api/evidence/context/{id}`, `GET /api/evidence/pdf/{doc_version_id}`. |

---

## `models/`

**Purpose:** Shared Pydantic request/response models used across routers.

| File | Models |
|------|--------|
| `query.py` | `QueryRequest`, `QueryResponse`, `Citation` |
| `documents.py` | `DocumentCreate`, `DocumentResponse`, `ChunkResponse`, `IngestResponse` |
| `auth.py` | `LoginRequest`, `UserResponse`, `SessionInfo` |
| `audit.py` | `AuditLogEntry`, `PHIOverrideEntry` |

---

## `migrations/`

SQL migration files applied in alphabetical order by `init_db()` at startup. Applied migrations tracked in `schema_migrations(filename)` — restarts are safe (idempotent).

Naming convention: `NNN_description.sql` — zero-padded prefix. Same prefix allowed for multiple files (applied alphabetically).

Key migrations:
- `001_initial.sql` — core schema (jurisdictions, documents, chunks, property_profiles, zone_actions, plants)
- `002_seed_jurisdictions.sql` — 12 jurisdiction rows with precomputed chains
- `003_seed_zone_actions.sql` — all 17 HIZ zone actions with scores and citations
