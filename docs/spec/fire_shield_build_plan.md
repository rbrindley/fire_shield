# Fire Shield — Build Plan

## Context

This plan was synthesized from an original product spec, a landscape review of wildfire apps and nonprofit resources in Southern Oregon, a deep research pass on evidence-based wildfire mitigation interventions, and architectural discussions about LLM integration, MCP servers, citation systems, jurisdiction-aware retrieval, and agent-friendly site configuration.

It is designed to be built in 24 hours for a code-a-thon focused on wildfire prevention in the Rogue Valley (Ashland, Medford, Jacksonville, Applegate Valley). It will be open source and designed for extension.

The builder (Claude Code / Opus) should treat this document as the single source of truth for what to build, why, and in what order.

---

## 1) What This Is

A progressive web app that turns a property address into a zone-based wildfire action plan with plant recommendations, home hardening guidance, and jurisdiction-aware local rule/grant awareness — all grounded in fire science with cited sources.

It is also:
- An **MCP server** that exposes the plant database and zone-action engine to any AI agent via structured tool calls.
- An **agent-friendly website** that serves its knowledge as structured Markdown via `llms.txt` and `Accept: text/markdown` content negotiation, so any AI agent browsing the web can discover and consume Fire Shield's data without MCP.

This is not a generic wildfire chatbot. It is not a plant directory. It is not a static document library. It is a property-specific decision assistant for landscaping, home hardening, and inspection prep — with three open integration layers (MCP, llms.txt, Markdown endpoints) so other tools can build on it.

---

## 2) Why This Matters — The Evidence Base

The prioritization logic, zone model, and action rankings in this app are grounded in specific fire science findings. The builder should understand these because they drive architectural decisions.

### Structure-to-structure spread is the primary kill mechanism
In the 2018 Camp Fire, 73% of destroyed homes had a burning structure within 59 feet. Proximity to an unmitigated neighbor is the strongest predictor of loss. The 2021 Marshall Fire study found that neighborhood-level characteristics — not individual homeowner actions — encompassed 78–100% of top predictors of survival.

### Home hardening outperforms defensible space as a survival predictor
IBHS analysis of the 2025 LA fires found homes with four key hardening features (Class A roof, noncombustible siding, double-pane windows, enclosed eaves) had a 54% likelihood of avoiding damage vs 36% with a single feature. Syphard and Keeley's statewide California analysis of 40,000+ structures found enclosed eaves, vent screens, and multi-pane windows explained more survival variance than vegetation distance.

### Building codes produce the largest measurable effect
Camp Fire data: homes built before 1997 survived at 11.5%; homes built after 1997 survived at 38.5% — a 3.3x improvement. The California Department of Insurance's 2026 study modeled IBHS standards and found the Wildfire Prepared Home standard reduces average annual loss by 31–35% at a marginal construction cost of roughly 3% per home.

### The 0–5 foot zone is the highest-ROI intervention
Berkeley FireSafe research: clearing the first five feet around a home is the single most important step to prevent ignition. Syphard et al. found the most effective treatment distance was 5–20 meters (16–58 feet), with distances beyond 30 meters providing no additional protection.

### Community-wide adoption multiplies individual action
A 2025 Nature Communications study modeled five major California WUI fires and found hypothetical community-wide hardening and defensible space could reduce losses by up to 52%. The benefit of community-wide adoption exceeds the sum of individual upgrades because it disrupts the chain of ignition at every link.

### Awareness does not equal action
USDA Forest Service researcher Sarah McCaffrey's synthesis found risk perception is "weakly predictive" of mitigation behavior. Fear appeals backfire — a 2022 field experiment found negative wildfire imagery decreased information-seeking among the highest-risk homeowners. What works: personalized home assessments, insurance-linked incentives, and descriptive social norms (showing what neighbors are actually doing).

### The Almeda Fire is local context
The 2020 Almeda Fire destroyed 2,600+ homes in Talent and Phoenix — five miles from Ashland. Communication systems failed. Many residents received no advance notification. Five years later, recovery is incomplete. Ashland's 2025 CWPP reveals only 15% of homes meet wildfire-resistant construction standards against a goal of 90% by 2036.

### The builder should use these findings to
- Weight home hardening actions above vegetation-only actions in the prioritization model.
- Emphasize Zone 0 (the house itself) and the 0–5 foot zone as highest priority.
- Include neighbor interdependency awareness in zone recommendations.
- Ground every recommendation in citable evidence, not opinion.
- Frame actions in terms of effectiveness data, not fear.

---

## 3) Product Thesis

Most wildfire information is fragmented across plant databases, city code pages, best-practice PDFs, grant listings, nonprofit guidance, and inspection requirements. Normal users will not read all of it. Worse, each jurisdiction (Ashland, Jacksonville, Medford, Talent, unincorporated Jackson County) has different local rules, and no tool currently resolves which rules apply to a specific address.

The product opportunity: one entry point that answers "What matters most around this house, what should I do first, what can I plant where, what rules apply in my city, and what grants might help?" — with every answer citing its source and scoped to the correct jurisdiction.

### Core Promise
"Tell me what matters most around this house, what I can plant where, what rules apply here, and what I should do next — and show me where you got that information."

---

## 4) Primary Users

### A. Homeowner / "Grandma" Mode
- Simple language, clear next steps, top 2–3 actions not long checklists.
- Easy plant suggestions with zone placement.
- Confidence that recommendations are grounded in trusted, cited sources.
- Seasonal awareness ("It's May — here's what to prioritize now").
- Correct local rules for their city, not a neighboring city's code.

### B. Builder / Landscaper / Inspection-Prep Mode
- Zone-by-zone requirements with code citations scoped to the correct jurisdiction.
- Structured plant filters with tradeoffs.
- Exportable checklist or report.
- Stronger provenance and auditability.

### C. AI Agent (via MCP or Web)
- Any MCP-connected AI can search the plant database and get zone-based action recommendations.
- Any web-browsing AI can discover and consume Fire Shield's knowledge via `llms.txt` and Markdown endpoints.
- Enables ecosystem growth without requiring users to use this specific app.

### D. Neighborhood / Community Admin (Phase 2+)
- Aggregate readiness insights without exposing private household details.
- Opt-in verification status and neighborhood progress indicators.

---

## 5) Product Goals

### Primary Goals
- Turn a property address into a zone-based wildfire action plan scoped to the correct jurisdiction.
- Help users find appropriate plants by zone using natural language and structured filters.
- Surface the 20% of actions likely to create the most benefit for that property.
- Make local wildfire guidance, grants, ordinances, and inspection criteria usable by non-experts.
- Cite every substantive recommendation to its source.
- Expose plant and zone-action data via MCP and agent-friendly web endpoints.

### Secondary Goals
- Create reusable outputs such as checklists and inspection-prep summaries.
- Provide a path to future neighborhood-level readiness views.
- Enable future background agents to watch for grants and ordinance changes.

### Non-Goals (for MVP)
- Real-time incident command or evacuation decision-making.
- Autonomous emergency advice.
- Public address-level maps showing who is or is not hardened.
- Fully automated property assessment from imagery alone.
- Complex neighborhood dashboards.
- Autonomous agents or social media workflows.

---

## 6) Zone Model

Use a house-centered wildfire zone model based on NFPA Home Ignition Zone concepts.

### Layers

**Layer 0 — The House Itself**
Roof, gutters, vents, attached deck, attached fence transitions, eaves, soffits, windows, siding, garage door weatherstripping. This is where most homes are lost — embers enter through vents and ignite the attic. This layer should be visually and verbally emphasized as highest priority.

Top actions:
1. Screen all vents with 1/8-inch noncombustible metal mesh or install ember-resistant vents.
2. Clean gutters and roof of all debris; install noncombustible gutter guards.

**Layer 1 — 0 to 5 Feet (Immediate / Noncombustible Zone)**
The single most important exterior zone. No combustible materials: no bark mulch, no firewood, no wooden furniture, no propane. Replace organic ground cover with gravel, rock, or concrete.

Top actions:
1. Remove all combustible materials within 5 feet of the structure.
2. Replace combustible fencing/deck attachments where they connect to the house with noncombustible material.

**Layer 2 — 5 to 30 Feet (Intermediate / Lean, Clean, Green Zone)**
Spaced, irrigated, well-maintained, fire-resistant vegetation. No ladder fuels.

Top actions:
1. Eliminate ladder fuels — prune tree branches up to 6–10 feet from ground, remove shrubs growing under trees.
2. Create horizontal spacing between plants and tree canopies (10+ feet between canopies).

**Layer 3 — 30 to 100 Feet (Extended / Reduced Fuel Zone)**
Interrupt fire's path and keep flames small and on the ground.

Top actions:
1. Thin trees and remove dead/dying vegetation; increase spacing on slopes.
2. Clear vegetation around any outbuildings, propane tanks, or sheds.

**Layer 4 — 100+ Feet (Access and Community Zone)**
Relevant for rural properties. Fire crew access and broader landscape context.

Top actions:
1. Ensure driveway/access road is passable for fire engines (12-foot width, 13.5-foot clearance, turnaround space).
2. Clear vegetation along driveway and install reflective address signage.

**Layer 5 — Readiness and Response (Non-Spatial Overlay)**
Evacuation planning and household preparedness. Not a ring on the map but a checklist overlay.

Top actions:
1. Create a go-bag and household evacuation plan with documented meeting point and two evacuation routes.
2. Download Watch Duty and sign up for Genasys Protect alerts.

### Neighbor Interdependency Note
When showing the 5–30 and 30–100 foot zones, the app should note: "Your defensible space effectiveness depends on neighboring properties too. In the Camp Fire, 73% of destroyed homes had a burning structure within 59 feet. Working with neighbors multiplies your protection." This sets up the Phase 2+ neighborhood layer and creates a natural "invite your neighbor" pathway.

### Seasonal Weighting
The 80/20 prioritization should factor in time of year. "Clean your gutters" is urgent in June and lower priority in January. Even a simple seasonal calendar overlay on action ranking (Southern Oregon fire season roughly June through October) makes the app feel dramatically more relevant.

### Product Rule
Recommendations are shown by zone, not as one undifferentiated checklist. The house itself and the first 5 feet are always emphasized as highest priority.

---

## 7) Core Functional Modules

### A. Property Profile Module
Captures: address, geocoded location, resolved jurisdiction, structure type, roof type, siding type, attached deck/fence status, slope, owner goals, optional user-entered details.

### B. Jurisdiction Resolution Module
Resolves the correct city, county, and state from the geocoded address. Maps to a jurisdiction value used to filter all retrieval and rule lookups. See Section 12 for full specification.

### C. Zone Engine
Creates property-centered wildfire zones, attaches rules and action templates to each zone, applies seasonal weighting, and surfaces top-priority actions with citations and evidence-based prioritization scores. Actions are filtered by resolved jurisdiction.

### D. Plant Selection Engine
Plant search, structured filtering, zone-aware suitability, tradeoff explanations, and ranking against user goals. Primary data source: the Living with Fire plant database (lwf-app.vercel.app). Adapter pattern normalizes into internal canonical schema.

### E. Knowledge Retrieval Layer (RAG)
Ingests, chunks, indexes, and retrieves from the wildfire knowledge corpus. Every retrieved chunk carries metadata: source document, section, trust tier, jurisdiction, URL. Retrieval is filtered by the property's resolved jurisdiction. This metadata flows through to the citation system.

### F. Rules / Decision Engine
Prioritization, compliance logic, hard constraints, recommendation ranking, conflict detection. Deterministic — the LLM does not make these decisions. Rules are jurisdiction-scoped.

### G. LLM Orchestration Layer
Interprets natural-language requests, translates guidance into plain English, synthesizes retrieved content, generates cited responses, asks limited follow-up questions when necessary. Uses tool-calling to query live APIs (NWS weather alerts, NIFC fire data) at conversation time. Receives resolved jurisdiction in its context so it references the correct city by name and distinguishes city-level from county-level from state-level requirements.

### H. Citation System
Every LLM response that makes a factual claim carries an inline citation back to its source. The front end renders citations as tappable links. The UI visually distinguishes three source types: structured data (plant records, zone rules), retrieved documents (PDFs, code pages, guidance), and fire science evidence (peer-reviewed studies, post-fire investigations). Citations are not optional — they are a core product feature.

### I. MCP Server
Exposes two primary tools to any MCP-connected AI agent:
- `search_plants` — accepts zone, water needs, native status, deer resistance, sun requirements; returns ranked plant recommendations with fire-science context and source citations.
- `get_zone_actions` — accepts address or lat/lng; returns top actions per HIZ zone with citations, priority scores, seasonal weighting, and jurisdiction-scoped local rules.

The MCP server uses SSE transport and runs as a lightweight service alongside the main app.

### J. Agent-Friendly Web Layer
Serves the app's knowledge as structured Markdown for AI agents that browse the web (as opposed to using MCP). Includes:
- `/llms.txt` — structured index of all available content.
- `/llms-full.txt` — complete plant database, zone actions, and key knowledge in one file.
- `Accept: text/markdown` content negotiation on content pages.
- Per-section index files for plants, zones, grants, and fire science.

### K. Checklist / Report Module
Action tracking, inspection-prep summaries, future export artifacts. Phase 1 completion, not required for code-a-thon demo.

### L. Grant / Opportunity Watcher (Phase 2+)
Scans trusted sources for new incentives, classifies by geography and eligibility, proposes matches for saved properties.

### M. Neighborhood Readiness Layer (Phase 2+)
Aggregate neighborhood views, opt-in certification indicators, privacy-preserving progress summaries.

---

## 8) System Architecture

### A. Structured Data Layer
Canonical records for: plants, plant traits, zone eligibility, action templates, property profiles, jurisdictions, grants, ordinances, inspection criteria, and verification status. This is the authoritative operational layer. Supabase (Postgres) is the recommended store.

The `jurisdictions` table maps jurisdiction codes to display names and parent relationships (e.g., `jacksonville` → parent `jackson_county` → parent `oregon_state`).

### B. Retrieval Layer (RAG)
Ingested, chunked, indexed resources. Vector search with provenance metadata on every chunk. Qdrant is the recommended vector store. Every chunk carries: source_url, source_title, trust_tier (1–6), jurisdiction, section_heading, document_date, ingestion_date. Retrieval queries are filtered by the property's resolved jurisdiction chain.

### C. Live Context Layer (API Tool-Use)
At query time, the LLM calls external APIs for current conditions. No storage needed — fresh every query. This is Claude function-calling / tool-use, not RAG.

### D. Orchestration Layer
Combines structured queries, retrieval calls, live API calls, rule evaluation, and response synthesis. Routes between deterministic (zone geometry, plant filters, jurisdiction resolution, code lookup) and probabilistic (LLM explanation, synthesis) components.

### E. Presentation Layer
PWA with: mobile-first but desktop-capable design, map view, chat view, property summary view, plant search/compare view, and checklist view.

### F. MCP Server Layer
Express or Fastify server implementing MCP SSE transport. Exposes plant search and zone-action tools. Runs alongside the main app. Can be deployed independently.

### G. Agent Web Layer
Next.js routes and middleware that serve Markdown to AI agents. Includes `/llms.txt`, `/llms-full.txt`, per-section indexes, and `Accept: text/markdown` content negotiation. Runs as part of the main Next.js app — no separate deployment needed.

---

## 9) Deterministic vs Probabilistic Responsibilities

### Deterministic (rule-bound, testable, no LLM)
- Address geocoding and jurisdiction resolution.
- Zone geometry.
- Plant hard filters (zone eligibility, noxious weed exclusion, Ashland restricted list).
- Code / ordinance applicability (jurisdiction-scoped).
- Action scoring inputs and priority ranking.
- Grant eligibility rules where explicit.
- Seasonal weighting calendar.
- Checklist logic.
- Citation source-type classification.
- Jurisdiction-to-corpus filtering.
- Neighborhood aggregation logic.
- MCP tool parameter validation and response formatting.
- llms.txt and Markdown endpoint generation.

### Probabilistic (LLM-assisted)
- Natural-language query interpretation.
- Summarizing long-form guidance.
- Explaining tradeoffs in plain English.
- Converting technical language for non-experts.
- Synthesizing retrieved context across multiple sources.
- Generating cited, contextualized action explanations.
- Interpreting live weather/fire data into household-level recommendations.
- Drafting milestone summaries or outreach copy.

### Critical Design Rule
The LLM must not be the authority for: code compliance, live emergency truth, zone geometry, plant hard eligibility, jurisdiction resolution, or priority ranking. It explains and translates decisions made by deterministic systems.

---

## 10) 80/20 Prioritization Model

The app ranks recommended actions using an explicit, evidence-based prioritization model.

### Prioritization Factors (weighted)
1. Estimated ignition-risk reduction (highest weight) — grounded in IBHS, Camp Fire, and LA fire evidence.
2. Zone proximity — Layer 0 and 0–5 feet actions always rank above outer zones.
3. Seasonal urgency — actions relevant to current time of year rank higher.
4. Ease of completion / cost — low-cost, high-impact actions surface first.
5. Code compliance impact — actions required by local code (jurisdiction-specific) rank above optional best practices.
6. Neighbor effect — actions that also reduce risk to adjacent properties get a bonus.
7. Whether the action unlocks other actions (e.g., clearing debris enables vent screening).

### Product Outcome
Each zone shows top 2–3 actions with: a short explanation, expected effort, why those actions matter more than lower-ranked items, and a citation to the evidence or code that supports the ranking.

This ranking is the product's most important differentiator.

---

## 11) Plant Database Strategy

### Primary Source
The Living with Fire (LWF) plant database at lwf-app.vercel.app. This is the most locally relevant, zone-aware, fire-science-grounded plant database for the Rogue Valley. It already uses the HIZ framework, includes Ashland-specific restricted plants, and has curated lists (native + deer resistant + low water, noxious weeds, HIZ-specific recommendations).

### Adapter Pattern
Create an internal adapter layer that: connects to the LWF data source, normalizes fields into the app's canonical plant schema, stores normalized records locally, and protects the rest of the application from external changes. The adapter should also be extensible — future sources (Oregon State Extension, USDA PLANTS) can be added without changing the core schema.

### Plant Query Experience
Support both natural-language queries ("Show me natives that help pollinators and are okay near the house") and structured filters (zone, native status, pollinator support, deer resistance, water needs, sun, mature size, maintenance burden, wildfire placement restrictions).

Responses include: recommended plants, why each plant fits, any conflicts or caveats, zone placement guidance, and source citations.

### MCP and Web Exposure
The plant search capability is exposed three ways:
1. Through the app's own UI (chat and structured filters).
2. Via the MCP server's `search_plants` tool for agent tool-call access.
3. Via `/api/plants/llms.txt` and `/llms-full.txt` for agent web-browsing access.

---

## 12) Jurisdiction Resolution

### Problem
The RAG corpus contains documents from multiple jurisdictions. Without jurisdiction filtering, a Jacksonville resident asking about local code may receive Ashland-specific ordinances. This erodes trust and could cause compliance errors.

### Jurisdiction Values
- `ashland`
- `jacksonville`
- `medford`
- `talent`
- `phoenix`
- `central_point`
- `eagle_point`
- `jackson_county` (unincorporated areas and county-wide rules)
- `josephine_county` (for Applegate Valley properties in Josephine County)
- `oregon_state`
- `federal`
- `universal` (NFPA, IBHS, fire science evidence, general best practices)

### Resolution Flow
Address input → geocode (Nominatim or Google) → extract city and county from structured response → map to jurisdiction value → store on property profile → pass to retrieval filter.

Edge cases:
- Unincorporated Jackson County addresses → `jackson_county` + `oregon_state` + `universal`.
- Applegate Valley (may span Jackson and Josephine counties) → resolve by county from geocoder.
- Addresses that don't match any known city → fall back to county + state + universal.

### Retrieval Filter
When querying the vector store, include chunks tagged with:
1. The resolved city (e.g., `jacksonville`).
2. The resolved county (e.g., `jackson_county`).
3. `oregon_state`.
4. `federal`.
5. `universal`.

A Jacksonville query retrieves Jacksonville + Jackson County + Oregon + federal + universal documents. It never retrieves Ashland-specific documents.

### LLM Context Injection
The system prompt includes the resolved jurisdiction so the LLM:
- References the correct city by name.
- Distinguishes city-level, county-level, and state-level requirements.
- Notes when city-specific sources are not yet available: "Jacksonville-specific wildfire ordinances are not yet in our database. The following recommendations are based on Jackson County requirements, Oregon state code, and national fire science standards — all of which apply to your property."

### Corpus Tagging
Every document ingested into the corpus is tagged with its jurisdiction. See the tagging guide in Section 13.

---

## 13) Knowledge Corpus Strategy

### Corpus Categories (with trust hierarchy)

**Tier 1 — Local Code and Official Rules (highest authority)**
- City of Ashland wildfire ordinances and fire-reluctant landscaping requirements → `ashland`
- Ashland restricted plant list → `ashland`
- Jacksonville municipal code wildfire sections → `jacksonville`
- Medford wildfire ordinances → `medford`
- Talent wildfire-related rebuilding standards → `talent`
- Phoenix rebuilding standards (post-Almeda) → `phoenix`
- Jackson County fire code → `jackson_county`
- Oregon building code wildfire provisions → `oregon_state`

**Tier 2 — Authoritative Technical Guidance**
- NFPA Firewise / Home Ignition Zone framework → `universal`
- IBHS Wildfire Prepared Home standards → `universal`
- UC ANR Publication 8695 (Reducing Vulnerability of Buildings to Wildfire) → `universal`
- CAL FIRE Home Hardening guidance → `universal`
- City of Ashland Fire-Reluctant Landscaping Best Practices PDF → `ashland`

**Tier 3 — Fire Science Evidence Base**
- IBHS 2025 LA fires investigation findings → `universal`
- Camp Fire structure survival studies (Knapp et al. 2021, Syphard et al. 2019) → `universal`
- Marshall Fire study (Fischer et al. 2024, Fire Technology) → `universal`
- Nature Communications 2025 WUI fire risk modeling (Zamanialaei et al.) → `universal`
- NIBS Mitigation Saves cost-benefit data → `universal`
- Almeda Fire post-incident reports and lessons learned → `jackson_county`

**Tier 4 — Local Community and Nonprofit Guidance**
- Ashland Forest Resiliency project materials → `ashland`
- Living-with-Fire.org resources → `universal`
- LWF plant database documentation → `universal`
- Ashland 2025 Community Wildfire Protection Plan → `ashland`
- Lomakatsi Restoration Project guidance → `jackson_county`
- Rogue Valley Firewise neighborhood materials → `jackson_county`

**Tier 5 — Grant and Incentive Sources**
- Oregon Fire Hardening Grant Program → `oregon_state`
- Oregon Defensible Space Assessment Incentive Pilot ($250/assessment) → `oregon_state`
- USFS Community Wildfire Defense Grant program → `federal`
- FEMA Hazard Mitigation Grant Program → `federal`
- Insurance-linked incentives (CSAA/AAA wildfire discount, IBHS WPH certification) → `universal`
- Oregon SB 762 programs → `oregon_state`

**Tier 6 — Supporting Educational Resources**
- OSU Extension wildfire preparedness publications → `oregon_state`
- Ready, Set, Go! program materials → `universal`
- Watch Duty, Genasys Protect, PulsePoint app information → `universal`

### Chunk Metadata Requirements
Every chunk in the retrieval layer must carry: source_url, source_title, trust_tier (1–6), jurisdiction, section_heading, document_date, ingestion_date. This metadata is used by the citation system, the jurisdiction filter, and the trust-weighted retrieval ranking.

---

## 14) Live API Integrations (Tool-Use at Query Time)

These are not stored in the vector DB. They are called at conversation time via LLM tool-use.

### Available Now (open, free, no auth)
- **NWS api.weather.gov** — Red flag warnings, fire weather zones, alerts by lat/long. Example: `api.weather.gov/alerts/active?point=42.1946,-122.7095` returns all active alerts for Ashland.
- **NIFC/WFIGS Open Data** (data-nifc.opendata.arcgis.com) — Current wildland fire locations, perimeters, refreshed every 5 minutes. ArcGIS REST API.
- **NASA FIRMS** — Near-real-time MODIS/VIIRS satellite thermal detections.
- **EPA AirNow** — Air quality index. Free API key.

### Available with Outreach
- **Watch Duty API** — They have a developer API and are open to partnerships. Contact for access.

### Not Available (use underlying sources directly)
- Genasys Protect — enterprise platform, no consumer API. Use NWS alerts directly.
- Apple Weather — no public API. Use NWS directly.
- Wildfire Info — aggregates federal sources you can hit directly via NIFC.

### Query-Time Integration Pattern
When a user asks "Is it safe to do yard work today?" or "What should I prioritize this week?", the LLM calls NWS and optionally NIFC/AirNow, interprets the response in context of the user's property profile and jurisdiction, and generates a personalized, cited recommendation.

---

## 15) Citation System Architecture

### Principle
Every substantive recommendation must cite its source. This is a core product feature, not a nice-to-have. It is what distinguishes this app from a generic chatbot and what makes it trustworthy for inspection prep and professional use.

### Three Citation Types (visually distinguished in UI)

**Structured Data Citation** — From the plant database or zone rules engine.
Format: "Source: LWF Plant Database" or "Source: NFPA Home Ignition Zone Framework"
These are deterministic and always accurate.

**Retrieved Document Citation** — From the RAG corpus.
Format: "Source: [Document Title], [Section/Page]" with link to source.
Example: "Source: City of Ashland Fire-Reluctant Landscaping Best Practices, p.4"
These carry the trust tier and jurisdiction of the source document.

**Fire Science Evidence Citation** — From peer-reviewed research or post-fire investigations.
Format: "Evidence: [Study shortname], [Finding]"
Example: "Evidence: IBHS 2025 LA Fire Investigation — homes with 4 hardening features survived 54% vs 36% with 1 feature"
These ground the prioritization logic in measurable outcomes.

### Implementation
- RAG retrieval chunks carry source metadata (url, title, tier, jurisdiction, section).
- The LLM system prompt instructs Claude to cite sources inline using a consistent format.
- The front end parses citation markers and renders them as tappable links or expandable cards.
- For MCP responses, citations are included in the structured JSON response.
- For Markdown / llms.txt responses, citations are inline Markdown links.

---

## 16) MCP Server Specification

### Purpose
Expose the plant database and zone-action engine to any MCP-connected AI agent. This makes Fire Shield's knowledge available as infrastructure, not just through the app's own UI.

### Transport
SSE (Server-Sent Events) — the standard MCP transport for web-accessible servers.

### Tools

**Tool 1: `search_plants`**
Description: Search the Living with Fire plant database for wildfire-appropriate plants filtered by Home Ignition Zone placement, water needs, native status, deer resistance, sun requirements, and other traits. Returns ranked recommendations with fire-science context.

Input parameters:
- zone (optional): "0-5ft", "5-30ft", "30-100ft", "100+ft"
- water_need (optional): "low", "medium", "high"
- native (optional): boolean
- deer_resistant (optional): boolean
- sun (optional): "full", "partial", "shade"
- pollinator_support (optional): boolean
- query (optional): free-text natural language query
- max_results (optional): integer, default 10

Output: Array of plant objects with: name, scientific_name, zone_suitability, traits, placement_notes, fire_behavior_notes, source_citation.

**Tool 2: `get_zone_actions`**
Description: Get prioritized wildfire mitigation actions for a property organized by Home Ignition Zone. Returns evidence-based recommendations with citations, priority scores, seasonal relevance, and jurisdiction-scoped local rules.

Input parameters:
- address (optional): street address string
- latitude (optional): number
- longitude (optional): number
- season (optional): "spring", "summer", "fall", "winter" — defaults to current
- include_grants (optional): boolean, default true

Output: Object with resolved_jurisdiction, zones array (each containing: zone_name, zone_description, distance_range, top_actions with action, why_it_matters, evidence_citation, effort_level, cost_estimate, seasonal_urgency, priority_score), applicable_grants, neighbor_note, jurisdiction_note (if city-specific docs are unavailable).

### Deployment
Runs as a lightweight Express or Fastify server alongside the main app. Can be deployed independently on Vercel, Railway, or similar. Should be stateless — all data comes from the plant database and zone rules engine.

---

## 17) Agent-Friendly Web Layer

### Purpose
Make Fire Shield's knowledge discoverable and consumable by any AI agent that browses the web — even without MCP support. This complements the MCP server by serving the "web browsing" agent pattern alongside the "structured tool call" pattern.

### Implementation

**`/llms.txt` — Site Index for Agents**
Static file or API route at the root. Provides a structured table of contents:

```
# Fire Shield
> A property-specific wildfire decision assistant for Southern Oregon.
> Plant database, Home Ignition Zone guidance, and local code/grant awareness.

## Plant Database
- [All Plants](/api/plants/llms.txt): Complete plant database with fire-science traits
- [Search Plants](/api/mcp/search_plants): MCP tool for plant search

## Zone Actions
- [Zone Action Framework](/zones/llms.txt): HIZ model with evidence-based top actions
- [Get Zone Actions](/api/mcp/get_zone_actions): MCP tool for property-specific recommendations

## Knowledge Base
- [Fire Science Evidence](/knowledge/fire-science/llms.txt): Key research findings
- [Local Code and Ordinances](/knowledge/local-code/llms.txt): Jurisdiction-specific requirements
- [Grants and Incentives](/knowledge/grants/llms.txt): Financial assistance programs

## About
- [How Fire Shield Works](/about/llms.txt): Architecture, data sources, citation methodology
- [MCP Server](/mcp/llms.txt): How to connect AI agents
```

**`/llms-full.txt` — Bulk Content for Ingestion**
Dynamic route that returns the complete plant database, zone action framework, key fire science findings, and grant summaries as a single Markdown file. Intended for offline indexing, bulk vectorization, or large-context models.

Response headers:
- `Content-Type: text/markdown; charset=utf-8`
- `x-markdown-tokens: [estimated count]`
- `Content-Signal: ai-train=no, search=yes, ai-input=yes`

**`Accept: text/markdown` Content Negotiation**
Next.js middleware checks incoming requests for `Accept: text/markdown`. When detected on content pages, serve a Markdown version instead of HTML. Plant detail pages, zone guides, and knowledge pages all support this.

**Per-Section Index Files**
- `/api/plants/llms.txt` — lists all plant entries with Markdown links.
- `/zones/llms.txt` — describes each HIZ zone with top actions and citations.
- `/knowledge/grants/llms.txt` — lists available grants with eligibility summaries.

### Content-Signal Policy
`ai-train=no, search=yes, ai-input=yes` — The curated knowledge should be usable by agents for reasoning and discoverable via search, but not used to train foundation models without permission. This is a policy decision that can be changed later.

---

## 18) Recommended Screens (PWA)

### 1. Home / Ask
- Address entry (prominent).
- Free-text question prompt.
- Sample questions for discoverability.
- Simple / Pro mode toggle.

### 2. Property Overview
- Structure summary with key vulnerability indicators.
- Resolved jurisdiction displayed (e.g., "Jacksonville, Jackson County, Oregon").
- Zone cards showing completion status.
- Top 3 overall actions with citations.
- Current conditions summary (if live APIs connected).
- Seasonal context note.
- Grants and local-rule summary (jurisdiction-scoped).

### 3. Map / Zones
- Property-centered map with concentric HIZ rings.
- Color-coded zones (red = incomplete, green = complete — Phase 1+ when checklist exists).
- Clickable zones revealing: top actions, why they matter, effort/cost, plant guidance, citations.
- Neighbor interdependency note on 5–30 and 30–100 foot zones.

### 4. Plants
- Natural language search.
- Structured filters.
- Plant cards with zone placement, traits, fire behavior notes.
- Compare mode.
- Source citations on every recommendation.

### 5. Chat / Ask
- Conversational interface for follow-up questions.
- Inline citations in every response.
- Visual distinction between structured-data answers, retrieved-document answers, and LLM synthesis.
- Jurisdiction context in responses (references correct city name, notes when city-specific docs are unavailable).

### 6. Checklist / Report (Phase 1 completion)
- Action tracking by zone.
- Unresolved blockers.
- Citations for each item.
- Future: export to PDF for inspection prep.

---

## 19) UX Modes

### Simple Mode
For homeowners and non-experts.
- Fewer options, larger text, less jargon.
- Top priorities first with strong visual hierarchy.
- "Why this matters" explanations using fire science storytelling, not fear.
- Example: "Screen your vents — in recent LA fires, homes with four hardening features including vent screening survived 54% of the time vs 36% without. This is one of the highest-impact steps you can take."

### Pro Mode
For builders, landscapers, and inspection-prep users.
- Richer filters and stronger citations.
- Code section references and compliance indicators (jurisdiction-scoped).
- Comparison support and structured reports.

### Key Principle
One shared engine, two presentations. Do not build two separate products.

---

## 20) Privacy, Trust, and Safety

### Privacy
- Property-level data is private by default.
- Neighborhood rollups are aggregate by default.
- Exact-address sharing is opt-in only.
- User-generated data is minimized where possible.

### Trust
- Show citations for every meaningful recommendation.
- Distinguish structured-rule outputs from LLM-generated explanation.
- Identify uncertainty where rules are ambiguous.
- Visually distinguish the three citation types.
- Be transparent about jurisdiction coverage — say when city-specific docs are missing.

### Safety
- Avoid implying professional certification unless verified.
- Avoid making emergency-response decisions for users.
- Avoid public shaming or exposure of non-compliant properties.
- Frame recommendations in terms of effectiveness, not fear. The research shows fear appeals decrease action among the highest-risk homeowners.

---

## 21) Technology Stack

### Front End
- Next.js on Vercel (PWA-capable, SSR for SEO, API routes for backend and agent endpoints).
- Leaflet with OpenStreetMap for the map layer (no API key needed for the demo).
- Tailwind CSS for styling.

### Backend / Data
- Supabase (Postgres) for structured data: property profiles, plant canonical schema, zone rules, action templates, grants, jurisdictions table, corpus_sources with jurisdiction tags.
- Qdrant for vector storage / RAG retrieval with jurisdiction metadata on every chunk.
- Supabase Edge Functions or Next.js API routes for orchestration.

### AI / LLM
- Claude API (Sonnet for speed during demo, Opus-quality system prompts).
- Tool-use / function-calling for live API integrations (NWS, NIFC).
- RAG retrieval with citation and jurisdiction metadata passthrough.

### MCP Server
- Express or Fastify with MCP SDK.
- SSE transport.
- Stateless — reads from Supabase plant database and zone rules.
- Deployable independently on Vercel or Railway.

### Agent Web Layer
- Next.js API routes for `/llms.txt`, `/llms-full.txt`, per-section indexes.
- Next.js middleware for `Accept: text/markdown` content negotiation.
- No additional infrastructure — runs as part of the main app.

### Map / Geospatial
- Leaflet for rendering.
- Turf.js for buffer/ring geometry around the property point.
- Google Geocoding API or Nominatim (free) for address resolution with city/county extraction for jurisdiction mapping.

### External APIs (tool-use at query time)
- NWS api.weather.gov (open, no auth).
- NIFC/WFIGS ArcGIS REST services (open, no auth).
- EPA AirNow (free API key).

---

## 22) Code-a-Thon Demo Scope (What to Build in 24 Hours)

### Must Have for Demo
1. Address entry → geocode → resolve jurisdiction → property point on map.
2. Concentric HIZ zone rings rendered on the map (Turf.js buffers).
3. Clickable zones → top 2 actions per zone with citations and "why this matters."
4. Natural-language chat interface → RAG-grounded answers with inline citations, filtered by jurisdiction.
5. Plant search (at least natural language) → zone-appropriate results with citations.
6. MCP server running with `search_plants` and `get_zone_actions` tools.
7. At least one live API call (NWS alerts for the property location) integrated into the experience.
8. `/llms.txt` static file at the root indexing the app's content for agents.
9. `/llms-full.txt` dynamic route dumping plant database and zone actions as Markdown.

### Should Have for Demo
10. Simple / Pro mode toggle.
11. Seasonal context note on the property overview.
12. Neighbor interdependency callout on the 5–30 foot zone.
13. Property profile basics (roof type, siding type selector).
14. `Accept: text/markdown` content negotiation on plant pages.
15. Jurisdiction displayed on property overview ("Jacksonville, Jackson County, OR").
16. Transparency note when city-specific docs are unavailable.

### Defer to Phase 1 (post-code-a-thon)
- Checklist / progress persistence.
- Structured plant filters UI.
- Exportable reports.
- Grant matching beyond static display.
- Admin / source status dashboard.
- Full content negotiation middleware on all pages.

### Defer to Phase 2+
- Neighborhood readiness layer.
- Verification workflows.
- Background agents (grant watcher, ordinance watcher).
- Social sharing tools.

---

## 23) Recommended Build Order (24-Hour Sequence)

### Block 1 — Foundation (Hours 0–6)
1. Set up Next.js project on Vercel with Tailwind.
2. Set up Supabase project with tables: plants, plant_traits, zone_actions, action_templates, property_profiles, jurisdictions, corpus_sources (with jurisdiction column).
3. Seed jurisdictions table with the jurisdiction hierarchy (city → county → state → universal).
4. Ingest LWF plant data into Supabase (scrape or manual entry of core plant records with zone eligibility and traits).
5. Seed zone_actions table with the evidence-based top actions per zone from this document.
6. Set up Qdrant (cloud free tier) and ingest initial corpus chunks with metadata including jurisdiction tags. Start with: City of Ashland fire-reluctant landscaping PDF (`ashland`), NFPA HIZ framework summary (`universal`), IBHS key findings summary (`universal`), Ashland CWPP key excerpts (`ashland`), Jackson County fire code excerpts (`jackson_county`), Oregon state wildfire requirements (`oregon_state`), top fire science findings (`universal`).
7. Create `/public/llms.txt` static file with the site index.

### Block 2 — Map, Zones, and Jurisdiction (Hours 6–10)
8. Build address entry → geocoding → city/county extraction → jurisdiction resolution.
9. Display map with Leaflet, property point centered.
10. Generate HIZ buffer rings using Turf.js (0–5ft, 5–30ft, 30–100ft, 100+ft).
11. Make zones clickable → display zone card with top actions from zone_actions table, filtered by jurisdiction.
12. Add citations to each action card (link to source in corpus_sources table).
13. Show resolved jurisdiction on property overview.

### Block 3 — LLM and RAG (Hours 10–16)
14. Build Claude API integration with system prompt that includes: zone model, citation instructions, property context injection, resolved jurisdiction, seasonal awareness, transparency instructions for missing jurisdiction-specific sources.
15. Connect RAG retrieval with jurisdiction filtering: user question → Qdrant similarity search filtered by jurisdiction chain → top chunks with metadata → Claude with citation instructions → response with inline citations.
16. Build chat UI that renders citations as tappable links with visual source-type distinction.
17. Integrate NWS alert API as a Claude tool-use function.
18. Build plant search through chat: user asks about plants → query hits Supabase plant table + Qdrant plant guidance chunks → Claude synthesizes with citations.

### Block 4 — MCP Server and Agent Layer (Hours 16–20)
19. Set up Express/Fastify MCP server with SSE transport.
20. Implement `search_plants` tool (queries Supabase, returns structured plant results with citations).
21. Implement `get_zone_actions` tool (queries zone_actions table, resolves jurisdiction, applies seasonal weighting, returns prioritized actions with citations).
22. Test MCP server with Claude desktop or another MCP client.
23. Build `/llms-full.txt` dynamic route (queries Supabase plants + zone_actions, formats as Markdown with headers and citations).

### Block 5 — Polish and Demo Prep (Hours 20–24)
24. Add Simple/Pro mode toggle.
25. Add seasonal context note to property overview.
26. Add neighbor interdependency callout on relevant zones.
27. Add jurisdiction transparency note when city-specific docs are missing.
28. Polish map UX, chat UX, citation rendering.
29. Add `Accept: text/markdown` middleware for plant pages if time permits.
30. Write demo script: address entry (try both Ashland and Jacksonville) → zone exploration → ask a question → get cited answer with correct jurisdiction → plant search → show MCP working → show llms.txt.
31. Deploy to Vercel. Test end-to-end.

---

## 24) Corpus Ingestion Priority (What to Ingest First)

Given 24 hours, prioritize ingestion of these documents in this order. Tag jurisdiction on every chunk.

1. **City of Ashland Fire-Reluctant Landscaping Best Practices PDF** → `ashland`
2. **NFPA Home Ignition Zone summary** → `universal`
3. **IBHS key findings from 2025 LA fires** → `universal`
4. **Ashland 2025 CWPP key sections** → `ashland`
5. **Jackson County fire code key sections** → `jackson_county` (ensures Jacksonville/Medford queries return something local)
6. **Fire science evidence summaries** → `universal` (Camp Fire, Marshall Fire, Nature Comms 2025 — can be manually written summaries)
7. **Oregon state wildfire building requirements** → `oregon_state`
8. **CAL FIRE Home Hardening guidance page** → `universal`
9. **Oregon grant program pages** → `oregon_state`
10. **LWF plant database documentation and zone guidance** → `universal`

For the demo, 5–10 well-chunked documents with proper metadata and jurisdiction tags will outperform 50 poorly chunked ones.

---

## 25) Source Trust Hierarchy

The retrieval system should weight sources in this order:

1. Local code / official rule source (jurisdiction-specific).
2. Federal/national authoritative guidance (NFPA, IBHS, CAL FIRE, NIFC).
3. Peer-reviewed fire science research with quantitative findings.
4. Trusted local nonprofit and community guidance (LWF, Lomakatsi, Ashland Forest Resiliency).
5. Curated supporting educational resources.

The user should always be able to see whether an answer came from: a structured rule, a plant record, a retrieved document (with jurisdiction noted), fire science evidence, or LLM synthesis.

---

## 26) Existing App Ecosystem (Don't Compete, Complement)

This app sits in a specific niche that no existing tool fills. The builder should understand what already exists to avoid duplication.

**Watch Duty** — Real-time wildfire tracking with human-verified reports. 501(c)(3) nonprofit. Has an API (contact for access). Active in Southern Oregon via Grants Pass Fire partnership. Do not replicate fire tracking. Deep-link to Watch Duty when relevant.

**Genasys Protect** — Official government emergency alerts. Zone-based evacuation orders. No public API. Do not replicate alert delivery. Reference it in the Readiness layer.

**PulsePoint** — 911-connected emergency dispatch. CPR alerts, fire/EMS incident notifications. Do not replicate. Reference in Readiness layer.

**LWF Plant Database (lwf-app.vercel.app)** — The fire-resistant plant selection tool Fire Shield builds on. Use as primary plant data source via adapter. Complement, don't replace.

**Watch Duty + NWS + NIFC** — For live conditions. Use their APIs as tool-use inputs to the LLM, not as data to replicate.

**Firewise USA** — Community recognition program. 2,452 sites nationwide, 35 in Ashland. Strong community building, unproven loss reduction. Fire Shield provides the personalized property-level experience Firewise doesn't have.

---

## 27) Success Metrics

### Demo Metrics (code-a-thon)
- Address entry → zone display works end-to-end for both Ashland and Jacksonville addresses.
- Jurisdiction resolves correctly and filters retrieval appropriately.
- At least 5 distinct user questions produce grounded, cited answers.
- Plant search returns zone-appropriate results with sources.
- MCP server responds correctly to external agent queries.
- NWS live API integration returns current conditions for the property.
- `/llms.txt` and `/llms-full.txt` return structured Markdown content.

### Product Metrics (post-launch)
- Number of saved properties across jurisdictions.
- Completion rate of top-priority actions.
- Plant-search to shortlist conversion.
- Citation click-through rate.
- Repeat usage during landscaping or inspection workflows.

### Outcome Metrics (long-term)
- Number of verified mitigation actions completed.
- Number of grants identified or applied for.
- Neighborhood-level participation where applicable.
- Reduction in the 15% → 90% gap in Ashland wildfire-resistant homes.
- Expansion of jurisdiction coverage across the Rogue Valley.

---

## 28) Risks and Mitigations

### Risk: LLM Fabricates Recommendations
Mitigation: Citation system makes grounding visible. Deterministic rules engine handles compliance and prioritization. LLM only explains and synthesizes.

### Risk: Wrong Jurisdiction's Rules Served
Mitigation: Jurisdiction resolution is deterministic (geocoder → city extraction → jurisdiction mapping). Retrieval is filtered by jurisdiction chain. LLM context includes resolved jurisdiction. Transparency note when city-specific docs are unavailable.

### Risk: Plant Data Becomes Stale
Mitigation: Adapter pattern with local cache. Source freshness tracked in corpus_sources table. Admin dashboard flags stale sources in Phase 2.

### Risk: Overpromising Compliance
Mitigation: Distinguish "guidance" from "verified compliance." Show citations and known limitations. Never imply professional certification.

### Risk: Privacy in Neighborhood Features
Mitigation: Aggregate by default. Require explicit opt-in for address-level visibility. No public map of private vulnerabilities.

### Risk: Demo Scope Creep
Mitigation: The 24-hour build order is explicit. If Block 4 (MCP + agent layer) runs long, ship the app without it and demo the concept. The map + zones + cited chat with jurisdiction awareness is the "aha" moment.

### Risk: Fear-Based Framing Backfires
Mitigation: Frame all recommendations in terms of effectiveness and capability, not catastrophe.

---

## 29) Open Questions

- What exact data format does the LWF plant database use? Confirm before building the adapter.
- Is the Ashland 2025 CWPP publicly available as a downloadable document? Confirm URL.
- What geocoding service to use? Google requires a key; Nominatim is free but slower. For demo, Nominatim is fine. Confirm it returns city-level resolution for Rogue Valley addresses.
- Do Jacksonville, Medford, and Talent have publicly available wildfire-specific municipal code? Research and ingest if available.
- Should the MCP server require authentication? For demo, no. For production, yes.
- What is the property-profile persistence model? For demo, session-only (no auth). For Phase 1, Supabase auth with magic links.

---

## 30) What Makes This Win the Code-a-Thon

1. **It's grounded in fire science, not opinion.** Every recommendation cites evidence from peer-reviewed research and post-fire investigations. The judges can check.
2. **It solves the fragmentation problem.** One entry point that synthesizes a dozen nonprofit outputs, city codes, plant databases, and grant programs. The community has been asking for this.
3. **It knows where you live.** Jurisdiction-aware retrieval means an Ashland resident gets Ashland code and a Jacksonville resident gets Jackson County code — not the wrong city's rules.
4. **It's an open platform, not a walled garden.** Three integration layers — MCP server for structured tool calls, llms.txt for agent discovery, Markdown endpoints for web browsing agents. This is infrastructure, not just an app.
5. **It's locally relevant.** Built for Ashland/Medford/Jacksonville/Applegate with local plant data, local code, local grants, and Almeda Fire context. Not a generic national tool.
6. **The map-with-zones is a visual "aha."** Enter an address, see the rings, click a zone, get your top actions. Judges will immediately understand the value.
7. **The citation system builds trust.** In a domain where bad advice can cost lives and homes, showing sources is a feature, not a footnote.
8. **It bridges prevention and response.** It's a prevention tool that naturally connects users to response tools (Watch Duty, Genasys) when conditions warrant.

---

## 31) Final Definition

Fire Shield is:

**A PWA and open platform that turns a property address, plant data, wildfire guidance, fire science evidence, and jurisdiction-specific local rules into a zone-based action plan with cited recommendations, plant selection support, and inspection-ready decision support — accessible through its own UI, via MCP for AI agents, and via structured Markdown for any tool browsing the web.**

It is the layer that sits between the fragmented wildfire information ecosystem and the individual homeowner, builder, or AI agent — making all of it usable, personal, cited, jurisdiction-aware, and actionable.

That is the product. Build it.
