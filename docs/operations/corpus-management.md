# Corpus Management

The corpus is the collection of documents the RAG pipeline searches to answer wildfire questions. This guide covers how to add, update, and retire documents.

## Concepts

### Trust Tiers

Every document is assigned a trust tier (1–6) that affects how its chunks rank during retrieval:

| Tier | Source Type | Rerank Boost | When to Use |
|------|-------------|-------------|-------------|
| 1 | Local ordinances / fire code | ×1.20 | City or county fire codes, AMC sections |
| 2 | Agency guidance (NFPA, IBHS, ODF, CAL FIRE) | ×1.10 | Official agency publications |
| 3 | Fire science evidence (peer-reviewed) | ×1.05 | Academic papers, research studies |
| 4 | Best-practice guides | ×1.00 | Practitioner guides, checklists |
| 5 | Grant / program info | ×0.95 | Funding announcements, program descriptions |
| 6 | Supplementary / older docs | ×0.90 | Archived materials, older versions |

When in doubt, default to tier 4. Only assign tier 1 for official local government ordinances.

### Jurisdictions

Tag each document with the most specific jurisdiction it applies to:

| Code | Use for |
|------|---------|
| `ashland` | City of Ashland ordinances, Ashland-specific programs |
| `jacksonville` | Jacksonville-specific docs |
| `medford` | Medford-specific docs |
| `talent` / `phoenix` / `central_point` / `eagle_point` | City-specific |
| `jackson_county` | Jackson County Fire District, countywide guidance |
| `grants_pass` | City of Grants Pass |
| `josephine_county` | Josephine County guidance |
| `oregon_state` | ODF publications, Oregon ORS/OAR citations |
| `federal` | USFS, NFPA, FEMA, national guidance |
| `universal` | Content applicable everywhere, no jurisdiction-specific claims |

A document tagged `ashland` is returned for all `ashland` queries, and also for any query from cities that include `ashland` in their jurisdiction chain — but `ashland`-tagged content is NOT returned for a `medford` query (different city). If content applies to the whole county, use `jackson_county`.

---

## Adding Documents

### Via Admin UI

1. Admin → Corpus tab → **+ Add Document**
2. Choose URL or file upload
3. Fill in Title, Jurisdiction, Trust Tier, Document Date
4. Click **Ingest**
5. Document status shows `pending` → wait for it to become `active` (typically 30–90 seconds for a 10-page PDF)

### Via API

```bash
# Ingest from URL
curl -X POST http://localhost:8100/api/ingest/url \
  -H "Content-Type: application/json" \
  -b "admin_token=your-token" \
  -d '{
    "url": "https://ashland.or.us/DocumentCenter/View/1234/AMC-15-04-Fire-Code",
    "title": "Ashland Municipal Code Title 15.04 — Fire Code",
    "jurisdiction": "ashland",
    "trust_tier": 1,
    "document_date": "2024-03-01"
  }'

# Check status
curl http://localhost:8100/api/ingest/status/1 -b "admin_token=your-token"
```

### Via PDF Upload

```bash
curl -X POST http://localhost:8100/api/ingest/upload \
  -b "admin_token=your-token" \
  -F "file=@/path/to/document.pdf" \
  -F "title=Jackson County Fire District Guidelines" \
  -F "jurisdiction=jackson_county" \
  -F "trust_tier=2" \
  -F "document_date=2024-01-01"
```

---

## Updating Documents

To update an ingested document's metadata (jurisdiction, trust tier, status):

**Admin UI:** Click the edit icon on the corpus row.

**API:**
```bash
curl -X PATCH http://localhost:8100/api/admin/corpus/42 \
  -H "Content-Type: application/json" \
  -b "admin_token=your-token" \
  -d '{"trust_tier": 2, "status": "active"}'
```

---

## Retiring / Deprecating Documents

Set a document's status to `stale` to suppress it from retrieval while preserving the record.

**When to use `stale`:**
- Document has been superseded by a newer version
- Content is outdated but you want to keep the audit trail
- Temporarily pulling content while reviewing accuracy

**Admin UI:** Edit row → Status → `stale`

**API:**
```bash
curl -X PATCH http://localhost:8100/api/admin/corpus/42 \
  -H "Content-Type: application/json" \
  -b "admin_token=your-token" \
  -d '{"status": "stale"}'
```

To permanently remove and delete chunks (also removes vectors from Qdrant):
```bash
curl -X DELETE http://localhost:8100/api/admin/corpus/42 \
  -b "admin_token=your-token"
```

---

## Priority Documents to Ingest

The following corpus is recommended for full Rogue Valley coverage. These are the highest-value sources by jurisdiction:

| Priority | Document | Jurisdiction | Tier |
|----------|----------|-------------|------|
| High | Ashland Municipal Code Title 15 (Fire Code) | `ashland` | 1 |
| High | Ashland Community Wildfire Protection Plan (CWPP) | `ashland` | 1 |
| High | Jackson County Community Wildfire Protection Plan | `jackson_county` | 1 |
| High | ODF Defensible Space Guide for Oregon | `oregon_state` | 2 |
| High | IBHS Wildfire Prepared Home standard | `federal` | 2 |
| High | NFPA 1144 Standard (HIZ) | `federal` | 2 |
| Medium | SB 762 Implementation Guide (Oregon) | `oregon_state` | 2 |
| Medium | Ashland SB 762 grant program materials | `ashland` | 5 |
| Medium | CAL FIRE ember intrusion research summary | `universal` | 3 |
| Medium | USFS Go-bag and evacuation planning guides | `federal` | 4 |

---

## Troubleshooting Ingestion

**Status stays `pending` for more than 5 minutes:**
- Check backend logs for extraction errors
- PDF may be scanned (no text layer) — use an OCR-processed version
- URL may be behind a login or return non-HTML content

**Chunks are too short / low quality:**
- The chunker filters out chunks under a minimum length — this is expected for tables-of-contents pages
- Add a document with better text extraction if too many pages are blank

**Document ingested but not appearing in search:**
- Verify status is `active` (not `pending` or `stale`)
- Verify jurisdiction code matches what users are querying
- Qdrant vector index may need a moment to sync — wait 30 seconds and retry
