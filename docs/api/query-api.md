# Query API — `/api/query/`

The query endpoint is the core of Fire Shield's AI-powered guidance. It runs the full RAG pipeline: retrieve → rerank → generate, with jurisdiction filtering and optional NWS weather alerting.

## Request

```http
POST /api/query/
Content-Type: application/json
```

```json
{
  "question": "What should I do about my wood shake roof?",
  "jurisdiction_code": "ashland",
  "profile": "simple",
  "property_profile_id": "uuid-optional",
  "lat": 42.195,
  "lng": -122.709
}
```

### Request Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `question` | string | required | The wildfire preparedness question |
| `jurisdiction_code` | string | `"jackson_county"` | Jurisdiction for corpus filtering. See [jurisdiction-chain.md](../architecture/jurisdiction-chain.md) for valid codes |
| `profile` | `"simple"` \| `"pro"` \| `"agent"` | `"simple"` | Controls Claude output format |
| `property_profile_id` | string | None | Attaches query to a property session (optional) |
| `lat` | float | None | Latitude — enables NWS weather alerts |
| `lng` | float | None | Longitude — enables NWS weather alerts |

---

## Response

```json
{
  "answer": "Wood shake roofs are the highest-risk roof material...",
  "citations": [
    {
      "chunk_id": "abc-123",
      "ref_number": 1,
      "document_title": "Ashland Fire Code 2024",
      "section_title": "Section 4.3 — Roof Materials",
      "excerpt": "Class A fire-rated roofing shall be required...",
      "citation_type": "retrieved_document",
      "trust_tier": 1,
      "source_url": "https://ashland.or.us/fire-code.pdf"
    }
  ],
  "jurisdiction_note": null,
  "nws_alert": "Red Flag Warning in effect until 8 PM PDT...",
  "profile_used": "simple",
  "retrieval_time_ms": 312,
  "generation_time_ms": 1850,
  "total_time_ms": 2162
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `answer` | string | Claude-generated response |
| `citations` | Citation[] | Evidence backing the answer |
| `jurisdiction_note` | string \| null | Shown when city-specific docs are absent; amber banner in UI |
| `nws_alert` | string \| null | Active NWS fire/red flag/wind alert (requires lat/lng) |
| `profile_used` | string | Profile that was applied |
| `retrieval_time_ms` | int | Time to retrieve and rerank chunks |
| `generation_time_ms` | int | Time for Claude generation |
| `total_time_ms` | int | End-to-end latency |

### Citation Object

| Field | Type | Description |
|-------|------|-------------|
| `chunk_id` | string | UUID of the source chunk |
| `ref_number` | int \| null | Renumbered citation `[1]`, `[2]` as they appear in `answer` |
| `source_number` | int \| null | Original number from LLM context (before renumbering) |
| `document_title` | string | Parent document title |
| `section_title` | string \| null | Section header if detected |
| `excerpt` | string | Verbatim chunk text |
| `citation_type` | string | `structured_data` / `retrieved_document` / `fire_science_evidence` |
| `trust_tier` | int | 1–6. See [rag-pipeline.md](../architecture/rag-pipeline.md) |
| `source_url` | string \| null | Canonical URL of source document |

---

## Profiles

### `simple` (default)
Plain language, 3–5 bullet points, "why it matters" framing. Designed for homeowners on mobile.

Example question → Claude writes conversational bullets with no jargon. Good for "What should I do first?"

### `pro`
ORS/NFPA code citations, explicit jurisdiction-specific vs universal distinction, HIZ layer framework language. Designed for fire professionals, insurance adjusters, or homeowners who want technical depth.

### `agent`
Structured JSON response from Claude:
```json
{
  "summary": "...",
  "priority_actions": ["Clear gutters", "Screen vents"],
  "jurisdiction_note": "...",
  "confidence": 0.85
}
```
Used by the MCP server and external API consumers. The `answer` field in the HTTP response will contain this JSON string.

---

## Pipeline Steps

See [rag-pipeline.md](../architecture/rag-pipeline.md) for full detail. Brief summary:

1. **Jurisdiction chain** built from `jurisdiction_code` (e.g., `ashland` → `["ashland","jackson_county","oregon_state","federal","universal"]`)
2. **FTS5 search** — full-text match against `chunks_fts` filtered by chain
3. **Vector search** — Qdrant cosine similarity with `MatchAny` jurisdiction filter
4. **Merge + deduplicate** by `chunk_id`
5. **Rerank** via `BAAI/bge-reranker-large` CrossEncoder × `TRUST_TIER_BOOST`
6. **NWS tool-use** (if lat/lng provided) — fire/red flag/wind alerts
7. **Claude generation** with jurisdiction context, profile instructions, chunk headers

---

## Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `ANTHROPIC_API_KEY` not configured |
| 422 | Missing required `question` field or invalid `profile` enum |
| 503 | Qdrant not reachable (RAG unavailable) |

When no relevant chunks are found, the endpoint returns 200 with a fallback answer rather than an error:
> "No relevant guidance found for your question. Try rephrasing, or ask your local fire department."

---

## Example: cURL

```bash
curl -X POST http://localhost:8100/api/query/ \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How close to my house should I keep wood piles?",
    "jurisdiction_code": "ashland",
    "profile": "simple"
  }'
```

## Example: Agent Mode

```bash
curl -X POST http://localhost:8100/api/query/ \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the top 3 most urgent actions for a wood-framed home in fire season?",
    "jurisdiction_code": "jackson_county",
    "profile": "agent",
    "lat": 42.33,
    "lng": -122.87
  }'
```
