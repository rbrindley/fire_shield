# Plant Sync

Fire Shield's plant database comes from the Living with Fire (LWF) API. This guide covers how to run syncs, interpret results, and apply manual overrides.

## Overview

The `plants` table is populated by syncing from `LWF_API_BASE` (default: `https://lwf-api.vercel.app/api/v2`). Plants are not populated at startup — the first sync must be run manually.

The sync is an upsert: new plants are inserted, existing plants are updated by `id`, and local overrides (Ashland restriction flags, placement notes) are preserved.

---

## Running a Sync

### Via Admin UI

Admin → Plants tab → **Sync Plants** button

The button shows "Syncing…" while running. The sync log below updates automatically when complete.

### Via API

```bash
curl -X POST http://localhost:8000/api/admin/plants/sync \
  -b "admin_token=your-admin-token"
```

Response:
```json
{
  "status": "success",
  "plants_upserted": 147,
  "plants_skipped": 3,
  "errors": null,
  "synced_at": "2026-03-28T14:30:00Z"
}
```

### Sync Log

View the 10 most recent sync events:

```bash
curl http://localhost:8000/api/admin/plants/sync-log \
  -b "admin_token=your-admin-token"
```

Each entry has: `synced_at`, `plants_upserted`, `plants_skipped`, `errors`, `status`.

---

## Sync Frequency

Plants don't change frequently. Recommended schedule:
- **Spring** (March–April): before homeowners start planting
- **Fall** (September–October): after fire season, before dormant-season planning
- **Ad hoc**: after major LWF database updates

There's no automated scheduler — sync is always triggered manually.

---

## Manual Overrides

Some plants require local adjustments that the LWF API doesn't know about — most notably Ashland's plant restriction ordinance.

### Mark a Plant as Ashland-Restricted

Plants prohibited or restricted by Ashland ordinance should be flagged so the UI shows a warning.

**Admin UI:** Admin → Plants tab → click edit icon on the plant row → toggle **Ashland Restricted** → save.

**API:**
```bash
curl -X PATCH http://localhost:8000/api/admin/plants/lwf-uuid-here/override \
  -H "Content-Type: application/json" \
  -b "admin_token=your-token" \
  -d '{"ashland_restricted": true}'
```

### Add Placement Notes

Add jurisdiction-specific guidance that doesn't exist in the LWF data:

```bash
curl -X PATCH http://localhost:8000/api/admin/plants/lwf-uuid-here/override \
  -H "Content-Type: application/json" \
  -b "admin_token=your-token" \
  -d '{"placement_notes": "Restricted within Ashland city limits per AMC 18.63 — confirm with city before planting."}'
```

Overrides **persist across syncs**. The `sync_lwf_plants()` function skips overwriting `ashland_restricted` and `placement_notes` fields on upsert.

---

## Plants Excluded from Search by Default

Two plant categories are excluded from default search results:

| Flag | Default behavior | Override |
|------|-----------------|---------|
| `is_noxious_weed = 1` | Excluded | Add `exclude_noxious=false` query param |
| `ashland_restricted = 1` | Included with warning banner | Add `exclude_restricted=true` to exclude |

Noxious weeds are excluded regardless of zone eligibility because including them in a fire safety recommendation would be irresponsible even if they have fire-resistant characteristics.

---

## Troubleshooting

**Sync returns `plants_upserted: 0`:**
- LWF API may be returning an empty or cached response — try again in a few minutes
- Check `errors` field in the sync log for API error messages
- Verify `LWF_API_BASE` environment variable points to the correct endpoint

**Plant is not appearing in search after sync:**
- Check that `is_noxious_weed = 0` (noxious weeds excluded by default)
- Check zone fields — if a plant has no zone eligibility flags set, it won't appear in zone-filtered searches
- Verify the plant's `status` (if applicable) is active

**Override was overwritten after sync:**
- This should not happen — check `adapter.py` upsert logic. The sync is written to skip overrides.
- If it did happen, re-apply the override and file a bug.
