# Backlog

Lean roadmap for Fire Shield. Detailed specs live in the build guides referenced below — this file stays minimal. Add future work here; link to docs rather than duplicating detail.

---

## Phase 1 — Corpus & Content (Near-term, High Impact)

These don't require code changes — just ingestion via the admin UI. See [corpus-management.md](docs/operations/corpus-management.md).

- [ ] Ingest all 10 priority documents (see corpus-management.md priority table)
- [ ] Ashland Municipal Code Title 15.04 (Fire Code) — tier 1
- [ ] Ashland CWPP and SB 762 grant program materials
- [ ] Jackson County CWPP and fire district guidelines
- [ ] ODF Defensible Space Guide for Oregon — tier 2
- [ ] NFPA 1144 and IBHS Wildfire Prepared Home — tier 2
- [ ] Peer-reviewed ember intrusion research — tier 3
- [ ] Run initial LWF plant sync and apply Ashland restriction overrides

---

## Phase 2 — Admin & Ops Completions

Features with stubs or "Coming soon" placeholders in the current build.

- [ ] **Geo-fence jurisdiction assignment** — polygon-based assignment (currently disabled UI in admin; resolver only uses Nominatim address text)
- [ ] **Document version history + rollback** — admin UI shows "Coming soon" tab; `document_versions` table exists but rollback is not wired
- [ ] **Bulk re-ingestion queue** — currently single-doc only; add batch URL list ingestion
- [ ] **Automated stale-doc scoring** — flag documents as stale based on age or URL availability checks (no code written)
- [ ] **Ingestion error UI** — documents with `status: error` currently show no detail in admin; surface the error message

---

## Phase 3 — Notification Agent

Push notifications for fire weather events and seasonal reminders. Requires database migration and new external service integrations.

- [ ] Migrate from SQLite to Supabase (PostgreSQL) for multi-writer support
- [ ] NWS red flag alert polling (every 4h during fire season, June–September)
- [ ] Resend email integration + weekly digest (property-specific action reminders)
- [ ] Weekly digest email with top seasonal actions for the subscriber's address
- [ ] Subscription management UI (opt-in, update address, unsubscribe)
- [ ] Reference: original notification agent spec in project build plan

---

## Phase 4 — Multi-Region & Auth

Expanding beyond Rogue Valley and adding user accounts for persistent history.

- [ ] User authentication (currently no auth — all property data is session-scoped)
- [ ] Saved properties per user (currently lost on tab close)
- [ ] Add jurisdiction support for additional Oregon regions (Medford metro expansion, Klamath County)
- [ ] Per-jurisdiction custom HIZ zone configurations (some counties have ordinance-specific zone distances)
- [ ] Structured output improvements for `agent` profile mode

---

## Bugs / Small Fixes

- [ ] Plant search `native=false` behavior is counter-intuitive — currently returns all plants, not non-native only (documented in test; decide if this should change)
- [ ] MCP `get_zone_actions` with `jurisdiction_code` only (no address) skips geocoding step — `lat`/`lng` are null in response; NWS alerts unavailable in that path

---

## Won't Do (Explicitly Out of Scope)

- Real-time fire mapping / active incident overlay — too dynamic; use CAL FIRE / NIFC directly
- National coverage beyond Oregon — jurisdiction chain system would need significant expansion
- Community/social features — this is a homeowner tool, not a neighborhood platform
