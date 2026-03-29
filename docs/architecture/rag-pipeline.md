# RAG Pipeline

The RAG pipeline answers natural language questions about wildfire preparedness using evidence from the ingested corpus, filtered by the user's jurisdiction.

## Pipeline Steps

```
Question + jurisdiction_code + profile + lat/lng
          │
          ▼
1. build_jurisdiction_chain()          app/rag/smart_filter.py
   "ashland" → ["ashland","jackson_county","oregon_state","federal","universal"]
          │
          ├─── 2a. FTS5 full-text search              app/rag/retrieve.py
          │         chunks WHERE jurisdiction IN chain
          │         AND d.status = 'active'
          │         ORDER BY rank LIMIT fts_top_k (default 30)
          │
          └─── 2b. Qdrant vector search               app/rag/retrieve.py
                    embed(question) → cosine similarity
                    filter: jurisdiction IN chain
                    top_k = vector_top_k (default 30)
          │
          ▼
3. Merge + deduplicate by chunk_id      app/rag/retrieve.py
          │
          ▼
4. rerank_chunks()                      app/rag/rerank.py
   CrossEncoder score × TRUST_TIER_BOOST
   → top reranker_top_n (default 12) chunks
          │
          ▼
5. Optional: NWS tool-use               app/rag/generate.py
   GET api.weather.gov/alerts/active?point={lat},{lng}
   Filter for fire/red flag/wind events
          │
          ▼
6. generate_answer()                    app/rag/generate.py
   Claude claude-sonnet-4-6 with WILDFIRE_SYSTEM_PROMPT
   + jurisdiction_context (city-specific or fallback note)
   + profile_instructions (simple/pro/agent)
   + chunks formatted with [TIER-1-LOCAL-CODE] headers
          │
          ▼
7. _extract_citations_and_renumber()
   Map [1],[2] refs → Citation objects with citation_type + trust_tier
          │
          ▼
Response: { answer, citations, jurisdiction_note, nws_alert }
```

## Trust Tier System

Corpus documents are tagged with `trust_tier` (1–6) when ingested. Higher tiers receive a boost multiplier during reranking:

| Tier | Source Type | Boost |
|---|---|---|
| 1 | Local ordinances / fire code | ×1.20 |
| 2 | Agency guidance (NFPA, IBHS, ODF) | ×1.10 |
| 3 | Fire science evidence (peer-reviewed) | ×1.05 |
| 4 | Best-practice guides | ×1.00 (neutral) |
| 5 | Grant / program info | ×0.95 |
| 6 | Supplementary / older docs | ×0.90 |

The boost is multiplicative: `boosted_score = cross_encoder_score × TRUST_TIER_BOOST[tier]`.

## Response Profiles

Controlled by the `profile` field in `POST /api/query/`:

| Profile | Output Style | Use Case |
|---|---|---|
| `simple` | Plain language, 3–5 bullet points, "why it matters" framing | Homeowner mobile UI |
| `pro` | ORS/NFPA code citations, jurisdiction-specific vs universal, HIZ layer framework | Power user, fire professional |
| `agent` | JSON `{summary, priority_actions[], jurisdiction_note, confidence}` | MCP tools, API consumers |

## Citation Types

Returned in `citations[]` array, each citation has a `citation_type`:

| Type | Meaning | UI Color |
|---|---|---|
| `structured_data` | Plant record or zone action from DB | Green |
| `retrieved_document` | Corpus chunk (PDF, HTML) | Blue |
| `fire_science_evidence` | Peer-reviewed study | Purple |

## Key Files

| File | Responsibility |
|---|---|
| `app/rag/smart_filter.py` | `build_jurisdiction_chain()` — pure dict lookup |
| `app/rag/retrieve.py` | FTS5 + Qdrant search, merge, deduplicate |
| `app/rag/rerank.py` | CrossEncoder + TRUST_TIER_BOOST |
| `app/rag/generate.py` | Claude API call, NWS tool-use, citation extraction |
| `app/rag/profiles.py` | Profile-specific system prompt instructions |
| `app/rag/routes.py` | `POST /api/query/` endpoint |
