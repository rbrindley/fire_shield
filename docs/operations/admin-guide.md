# Admin Guide

The admin UI provides a browser-based interface for managing the corpus, plants, and zone actions. It's designed for operators who don't need to use the API directly.

## Accessing Admin

1. Navigate to `http://localhost:3000/admin` (or your deployed URL)
2. Enter your `ADMIN_TOKEN` (set in the backend `.env` as `ADMIN_TOKEN`)
3. The token is stored as a cookie (`admin_token`) with `SameSite=Strict`

> The admin UI does not have user accounts — it uses a single shared token. Keep the token secret. Rotate it by updating `ADMIN_TOKEN` in the backend environment and restarting.

---

## Corpus Management

**Path:** Admin → Corpus tab

The corpus table shows all ingested documents. Each row displays:
- Title
- Jurisdiction
- Trust tier (1–6)
- Status: `active`, `stale`, `pending`, `error`
- Ingestion date

### Add a Document

Click **+ Add Document**. You can ingest by:
- **URL** — paste a public link to a PDF or HTML page
- **File upload** — upload a PDF directly

Required fields:
- **Title** — display name for the document
- **Jurisdiction** — the code this document applies to (e.g., `ashland`, `jackson_county`)
- **Trust tier** — 1 (local ordinance) through 6 (supplementary). See [rag-pipeline.md](../architecture/rag-pipeline.md) for the trust tier scale.
- **Document date** — ISO date string (optional but recommended for staleness tracking)

After submitting, the document is queued with `status: pending`. Processing runs asynchronously — the document extracts text, chunks it, generates embeddings, and indexes to Qdrant. Check the status column to confirm `active`.

### Edit a Document

Click the edit icon on any row to update:
- Jurisdiction
- Trust tier
- Status (manually override to `stale` to suppress from retrieval without deleting)
- Source URL

### Deprecate a Document

Click the delete icon to set status to `deprecated`. The document and its chunks are removed from retrieval but the database row is preserved for audit purposes.

### Jurisdiction Chain Preview

Use the **Preview Chain** dropdown to verify what jurisdiction chain a code resolves to before ingesting documents. This helps confirm that a new document tagged with `ashland` will be included in queries from `ashland` users.

---

## Plant Management

**Path:** Admin → Plants tab

### Sync Plants

Click **Sync Plants** to fetch the latest plant data from the Living with Fire (LWF) API. This:
- Fetches all fire-resistant plants from `LWF_API_BASE`
- Upserts the `plants` table (insert new, update changed)
- Logs the sync result (plants upserted, skipped, errors)

The sync log below the button shows the 10 most recent sync events.

> Plants are not automatically synced — run this manually when you want to pull in LWF updates, typically once per growing season.

### Override a Plant

Click the edit icon on a plant to override:
- **Ashland restricted** — mark a plant as restricted by Ashland ordinance (this is a local rule not reflected in the LWF API)
- **Placement notes** — add jurisdiction-specific guidance shown in the UI

Overrides persist across syncs — they are not overwritten by the next LWF sync.

---

## Zone Action Management

**Path:** Admin → Zones tab

Zone actions are the 17 standardized HIZ actions seeded from `003_seed_zone_actions.sql`. They are universal (not jurisdiction-specific).

### View Actions

The zones table shows all 17 actions with:
- Layer (0–4)
- Action title and detail
- Effort level
- Base priority score
- Seasonal peak months

### Edit an Action

Click the edit icon to update:
- `action_title` — short label
- `action_detail` — full description
- `why_it_matters` — evidence framing
- `evidence_citation` — source citation text
- `priority_score` — base score (0.0–1.0) before seasonal boost
- `seasonal_peak` — JSON array of month names, e.g. `["june","july","august"]`
- `rank_in_layer` — sort order within the layer

> Changing `priority_score` affects the ordering of actions shown to users. Test changes with the season override (`?season=summer`) to verify the display order is as expected.

---

## Seasonal Preview

On the Zones tab, use the **Season** dropdown to preview what users would see during a specific season. This applies the same boost math the engine uses without requiring a specific month:

- **Summer** (+0.10 fire boost on layers 0–1; peak actions get +0.15)
- **Spring/Fall** (peak actions get +0.15 where applicable)
- **Winter** (no fire boost; dormant season tree work peaks active)

---

## Admin API Reference

All admin UI actions call the `/api/admin/*` endpoints. These can also be called directly — see [endpoints.md](../api/endpoints.md). All require the `admin_token` cookie.
