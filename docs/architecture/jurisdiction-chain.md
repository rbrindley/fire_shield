# Jurisdiction Chain System

The jurisdiction chain is the mechanism that ensures a homeowner in Ashland gets Ashland-specific guidance first, falling back to Jackson County, then Oregon state, then federal, then universal content — in that order.

## The Problem It Solves

Documents in the corpus are tagged with a `jurisdiction` field (e.g., `"ashland"`, `"jackson_county"`). A naive query that only matches exact jurisdiction would miss relevant county and state guidance. A query that returns everything regardless of jurisdiction would mix Jacksonville content into Ashland results.

The chain solves this by building an ordered list of valid jurisdictions for each query, then filtering corpus chunks to only those jurisdictions.

## Chain Table

| Code | Chain |
|---|---|
| `ashland` | `["ashland","jackson_county","oregon_state","federal","universal"]` |
| `jacksonville` | `["jacksonville","jackson_county","oregon_state","federal","universal"]` |
| `medford` | `["medford","jackson_county","oregon_state","federal","universal"]` |
| `talent` | `["talent","jackson_county","oregon_state","federal","universal"]` |
| `phoenix` | `["phoenix","jackson_county","oregon_state","federal","universal"]` |
| `central_point` | `["central_point","jackson_county","oregon_state","federal","universal"]` |
| `eagle_point` | `["eagle_point","jackson_county","oregon_state","federal","universal"]` |
| `jackson_county` | `["jackson_county","oregon_state","federal","universal"]` |
| `grants_pass` | `["grants_pass","josephine_county","oregon_state","federal","universal"]` |
| `josephine_county` | `["josephine_county","oregon_state","federal","universal"]` |
| `oregon_state` | `["oregon_state","federal","universal"]` |
| `universal` | `["universal"]` |
| *(unknown)* | `["jackson_county","oregon_state","federal","universal"]` (DEFAULT_CHAIN) |

Chains are stored precomputed in the `jurisdictions` table (`jurisdiction_chain` JSON column) and also in `app/rag/smart_filter.py` for pure-Python lookups without a DB call.

## How It's Applied

**FTS5 retrieval** (`app/rag/retrieve.py`):
```sql
SELECT ... FROM chunks c
JOIN documents d ON c.doc_version_id = ...
WHERE c.jurisdiction IN ('ashland','jackson_county','oregon_state','federal','universal')
AND d.status = 'active'
```

**Qdrant vector search** (`app/rag/retrieve.py`):
```python
FieldCondition(
    key="jurisdiction",
    match=MatchAny(any=["ashland","jackson_county","oregon_state","federal","universal"])
)
```

## Adding New Jurisdictions

1. Add a row to `jurisdictions` table (or run a migration):
   ```sql
   INSERT INTO jurisdictions VALUES ('new_city','City of New City, Oregon','jackson_county',
     '["new_city","jackson_county","oregon_state","federal","universal"]');
   ```
2. Add the entry to `JURISDICTION_CHAINS` dict in `app/rag/smart_filter.py`
3. Add the city name mapping in `CITY_TO_JURISDICTION` in `app/jurisdiction/resolver.py`
4. Tag new corpus documents with `jurisdiction = "new_city"`

## Jurisdiction Note in Chat

If a user is in a city (e.g., Jacksonville) but no Jacksonville-specific documents are in the corpus, `generate_answer()` adds a `jurisdiction_note` to the response:

> "Jacksonville-specific documentation is not yet available. Showing Jackson County, Oregon state, and universal guidance."

The chat UI displays this as an amber info banner above the answer.
