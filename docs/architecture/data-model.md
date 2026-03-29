# Data Model

Fire Shield uses SQLite (`data/app.db`). Migrations live in `backend/app/migrations/*.sql` and run automatically on startup via `init_db()` (idempotent — tracks applied migrations in `schema_migrations` table).

## Key Tables

### `jurisdictions`
Precomputed jurisdiction hierarchy. Seeded by `002_seed_jurisdictions.sql`.

| Column | Type | Notes |
|---|---|---|
| `code` | TEXT PK | e.g., `"ashland"`, `"jackson_county"` |
| `display_name` | TEXT | e.g., `"City of Ashland, Oregon"` |
| `parent_code` | TEXT FK | References `jurisdictions.code` |
| `jurisdiction_chain` | TEXT | JSON array, e.g., `["ashland","jackson_county",...]` |

### `zone_actions`
17 HIZ zone actions seeded from `003_seed_zone_actions.sql`. These are universal — not jurisdiction-specific.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | e.g., `"layer0-vent-screening"` |
| `layer` | INTEGER | 0–4 |
| `layer_name` | TEXT | `"house"`, `"0_5ft"`, `"5_30ft"`, etc. |
| `rank_in_layer` | INTEGER | 1-based sort within layer |
| `action_title` | TEXT | Short action label |
| `action_detail` | TEXT | Full description |
| `why_it_matters` | TEXT | Evidence-grounded explanation |
| `evidence_citation` | TEXT | Source(s) |
| `effort_level` | TEXT | `zero_cost` / `low` / `moderate` / `high` |
| `priority_score` | REAL | 0.0–1.0 base score before seasonal boost |
| `seasonal_peak` | TEXT | JSON array of month names |
| `neighbor_effect` | INTEGER | 1 if action affects neighbor properties |

### `documents`
Corpus sources managed via admin UI. Ingested documents stored here.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `title` | TEXT | Document title |
| `jurisdiction` | TEXT | One of the jurisdiction codes |
| `trust_tier` | INTEGER | 1–6 (see [RAG Pipeline](./rag-pipeline.md)) |
| `source_url` | TEXT | Canonical URL if available |
| `status` | TEXT | `active` / `stale` / `pending` |

### `chunks`
Text chunks extracted from documents, indexed for retrieval.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `doc_version_id` | INTEGER FK | References `document_versions.id` |
| `content` | TEXT | Chunk text (also in FTS5) |
| `jurisdiction` | TEXT | Inherited from parent document |
| `trust_tier` | INTEGER | Inherited from parent document |
| `section_title` | TEXT | Section heading if detected |

`chunks_fts` — FTS5 virtual table synced via triggers. Columns: `chunk_id`, `content`, `section_title`, `jurisdiction`.

### `plants`
Fire-resistant plant database synced from LWF API. Empty until sync runs.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | LWF plant UUID |
| `common_name` | TEXT | |
| `zone_0_5ft` | INTEGER | 1 if eligible for 0–5ft zone |
| `zone_5_30ft` | INTEGER | 1 if eligible for 5–30ft zone |
| `zone_30_100ft` | INTEGER | 1 if eligible for 30–100ft zone |
| `zone_100ft_plus` | INTEGER | 1 if eligible for 100+ft zone |
| `is_native` | INTEGER | 1 if Oregon native |
| `deer_resistant` | INTEGER | 1 if deer resistant |
| `water_need` | TEXT | `low` / `medium` / `high` |
| `ashland_restricted` | INTEGER | 1 if restricted by Ashland ordinance |
| `is_noxious_weed` | INTEGER | 1 if noxious weed (excluded from results by default) |
| `fire_behavior_notes` | TEXT | Free-text fire safety notes from LWF |

### `property_profiles`
One row per address lookup. Session-scoped (no auth).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `address` | TEXT | User-entered address |
| `lat` / `lng` | REAL | Geocoded coordinates |
| `jurisdiction_code` | TEXT | Resolved jurisdiction |
| `session_id` | TEXT | Browser session ID |

### `corpus_sources`
Admin-managed registry of ingested documents (separate from `documents` table).

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `title` | TEXT | |
| `jurisdiction` | TEXT | |
| `trust_tier` | INTEGER | |
| `status` | TEXT | `active` / `stale` / `pending` |

## Migration Naming Convention

```
NNN_description.sql
```

Where `NNN` is a zero-padded number. Multiple migrations at the same number are allowed (e.g., `003_document_metadata.sql` and `003_seed_zone_actions.sql`). They are applied alphabetically.

Applied migrations are tracked in `schema_migrations(filename)` so restarts are safe.
