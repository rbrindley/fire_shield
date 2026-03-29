# API Endpoints Reference

All endpoints are served by the FastAPI backend on port 8000 (default). The frontend proxies `/api/*` to this service.

## Quick Reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/query/` | None | RAG chat query |
| GET | `/api/zones/` | None | All 17 HIZ zone actions |
| GET | `/api/zones/top` | None | Top N zone actions by priority |
| GET | `/api/plants/search` | None | Search fire-resistant plant database |
| GET | `/api/plants/{plant_id}` | None | Single plant detail |
| POST | `/api/jurisdiction/resolve` | None | Geocode address → jurisdiction |
| GET | `/api/jurisdiction/profile/{id}` | None | Retrieve property profile |
| PATCH | `/api/jurisdiction/profile/{id}` | None | Update property profile |
| GET | `/api/jurisdiction/jurisdictions` | None | List all jurisdictions |
| POST | `/api/ingest/url` | Admin | Ingest document from URL |
| POST | `/api/ingest/upload` | Admin | Ingest PDF upload |
| GET | `/api/ingest/status/{doc_id}` | Admin | Ingestion status |
| GET | `/api/admin/corpus` | Admin cookie | List corpus sources |
| PATCH | `/api/admin/corpus/{id}` | Admin cookie | Update corpus source |
| DELETE | `/api/admin/corpus/{id}` | Admin cookie | Deprecate corpus source |
| GET | `/api/admin/corpus/jurisdiction-preview/{code}` | Admin cookie | Preview jurisdiction chain |
| POST | `/api/admin/plants/sync` | Admin cookie | Trigger LWF plant sync |
| GET | `/api/admin/plants/sync-log` | Admin cookie | Plant sync history |
| PATCH | `/api/admin/plants/{id}/override` | Admin cookie | Override plant metadata |
| GET | `/api/admin/zones` | Admin cookie | List all zone actions |
| PATCH | `/api/admin/zones/{id}` | Admin cookie | Update zone action |
| GET | `/api/evidence/chunk/{chunk_id}` | None | Retrieve chunk content |
| GET | `/api/evidence/context/{chunk_id}` | None | Surrounding chunk context |
| GET | `/api/evidence/pdf/{doc_version_id}` | None | PDF file info |
| GET | `/health` | None | Health check |

**Total: 25 routes**

---

## Authentication

**Public routes** — no authentication required. Any origin can call these.

**Admin routes** — require the `admin_token` cookie to be set (value must match `settings.admin_token`). Set this cookie by submitting the token on the `/admin` login page, or include `Cookie: admin_token=<value>` in API calls.

---

## Core Endpoints

### `POST /api/query/`
RAG chat query. See [query-api.md](./query-api.md) for full detail.

**Request:**
```json
{
  "question": "What should I do about my gutters before fire season?",
  "jurisdiction_code": "ashland",
  "profile": "simple",
  "lat": 42.195,
  "lng": -122.709
}
```

**Response:** `{ answer, citations[], jurisdiction_note, nws_alert, profile_used, retrieval_time_ms, generation_time_ms, total_time_ms }`

---

### `GET /api/zones/`
Returns all 17 HIZ zone actions organized by layer, with seasonal boost applied.

**Query params:** `jurisdiction` (optional), `season` (optional: `spring`/`summer`/`fall`/`winter`)

**Response:**
```json
{
  "layers": [...],
  "neighbor_note": "...",
  "current_season": "summer",
  "current_month": "july"
}
```

Each layer: `{ layer, layer_name, layer_description, actions[] }`
Each action: `{ id, action_title, action_detail, why_it_matters, evidence_citation, effort_level, effective_priority, is_seasonal_peak }`

---

### `GET /api/zones/top`
Returns top N actions sorted by `effective_priority` across all layers.

**Query params:** `n` (integer, 1–10, default 3)

**Response:** Array of action objects with `layer` and `effective_priority` fields.

---

### `GET /api/plants/search`
Search fire-resistant plants. Empty query returns all plants matching filters.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string | None | Natural language search |
| `zone` | string | None | `zone_0_5ft`, `zone_5_30ft`, `zone_30_100ft`, `zone_100ft_plus` |
| `native` | bool | false | Oregon native only |
| `deer_resistant` | bool | false | Deer resistant only |
| `water_need` | string | None | `low`, `medium`, `high` |
| `exclude_noxious` | bool | true | Exclude noxious weeds |
| `exclude_restricted` | bool | false | Exclude Ashland-restricted |
| `limit` | int | 20 | Max results (max 100) |
| `offset` | int | 0 | Pagination offset |

**Response:** `{ plants[], total, limit, offset }`

---

### `POST /api/jurisdiction/resolve`
Geocode an address and resolve its jurisdiction code. Creates a `property_profile` row.

**Request:** `{ "address": "123 Main St, Ashland, OR", "session_id": "optional" }`

**Response:** `{ lat, lng, jurisdiction_code, property_profile_id, session_id, ... }`

---

### `POST /api/ingest/url`
Queue a document URL for ingestion. Returns immediately with `status: "pending"` — processing happens asynchronously.

**Request:**
```json
{
  "url": "https://example.com/fire-code.pdf",
  "title": "Ashland Fire Code 2024",
  "jurisdiction": "ashland",
  "trust_tier": 1,
  "document_date": "2024-01-01"
}
```

**Response:** `{ document_id, corpus_source_id, status, message }`

---

### `GET /health`
Returns `{ "status": "healthy", "app": "fire_shield", "version": "1.0.0" }` when the backend is up.
