# Addon — Seasonal Notification Agent

**Applies to:** Fire Shield Build Plan
**Priority:** Nice-to-have / Phase 2
**Connection to research:** Personalized, timely nudges are the second-strongest behavioral driver after in-person assessments. The research shows people act on prompts that are specific to their situation and arrive at the right moment — not generic reminders sent to everyone at once.

---

## What It Does

A background agent that sends personalized, seasonal notifications to subscribed homeowners based on their property profile, jurisdiction, resolved zone actions, and the current time of year.

Examples:
- "Fire season starts in 3 weeks. Your Layer 1 under-deck debris check is the single highest-impact action you can do this weekend. [30 minutes, zero cost]"
- "March is ideal for planting in the 5–30 foot zone in Jacksonville. Three native, low-water, deer-resistant options that work for your zone: Ceanothus cuneatus, Mahonia aquifolium, Arctostaphylos. [See details in Fire Shield]"
- "Red flag warning issued for Jackson County through Thursday. Move combustible patio items indoors. Confirm your go-bag is by the door. [Source: NWS]"
- "Oregon's Defensible Space Assessment Incentive is open — you may qualify for a $250 assessment. [Source: Oregon SB 762]"
- "Your neighbor at [street name] just completed their vent screening. Your block is 3 of 7 homes hardened." (Phase 3 — requires neighborhood layer and opt-in)

---

## What It Requires

### 1. User Subscription and Preferences (New)

A lightweight subscription flow where the user:
- Provides an email or phone number (or both).
- Opts into notification categories:
  - Seasonal maintenance reminders (monthly during fire season, quarterly off-season).
  - Plant recommendations by season and zone.
  - Grant/incentive alerts when new programs open.
  - Red flag / fire weather alerts (supplements, not replaces, Watch Duty and Genasys).
  - Neighborhood progress updates (Phase 3, requires opt-in from neighbors too).
- Selects notification frequency preference (weekly digest, individual, or critical-only).
- Can unsubscribe or change preferences at any time.

**Data model addition:** A `subscriptions` table in Supabase:
- user_id (or email hash — no auth required for MVP, just email)
- property_profile_id (links to their saved address and jurisdiction)
- notification_categories (array of opted-in categories)
- frequency (weekly_digest | individual | critical_only)
- channel (email | sms | both)
- created_at, updated_at

### 2. Notification Content Engine (New)

Generates personalized notification content by combining:
- The property's resolved jurisdiction and zone actions from the existing zone engine.
- The seasonal urgency calendar from layer_80_20_steps.md.
- Current month → which actions are highest priority right now.
- The property profile (if they've entered roof type, deck status, etc. — personalize further).
- Plant database filtered by zone, season, and jurisdiction.
- Grant/incentive data filtered by jurisdiction and eligibility windows.

The content engine does NOT use the LLM for every notification. Most notifications are template-based with variable insertion (action name, plant names, dates, jurisdiction). The LLM is used only for:
- Generating the initial template library (one-time during setup).
- Personalizing complex notifications that require synthesis (e.g., combining a weather alert with property-specific actions).
- Drafting new grant alert summaries when a new program is detected.

This keeps costs near zero for routine notifications.

### 3. Scheduling and Dispatch (New)

A cron-based scheduler that:
- Runs daily (or weekly for digest mode).
- Queries all active subscriptions.
- For each subscription, determines which notifications are due based on: current month, notification category, frequency preference, and last-sent timestamps.
- Generates content via the notification content engine.
- Dispatches via email (and/or SMS).

**Implementation options (lightest to heaviest):**

**Option A — Supabase Edge Functions + Resend (lightest, recommended for Phase 2)**
- Supabase pg_cron triggers a database function on schedule.
- The function queries subscriptions due for notification.
- Calls a Supabase Edge Function that generates content and sends via Resend (email API, generous free tier).
- For SMS: Twilio or a similar provider, but email-only is fine for initial launch.
- Total new infrastructure: one Edge Function, one Resend account, pg_cron config.

**Option B — Vercel Cron + Resend**
- Vercel supports cron jobs on API routes (Pro plan or with vercel.json config).
- A Next.js API route runs on schedule, queries Supabase, generates content, sends via Resend.
- Same outcome as Option A, just runs on Vercel instead of Supabase.

**Option C — Cloudflare Workers + Agents SDK (heaviest, most capable)**
- Uses Cloudflare's Agents SDK with scheduled tasks and durable state.
- Each subscriber could have their own agent instance with persistent state.
- Overkill for Phase 2, but interesting if the notification agent evolves into something more interactive (e.g., a conversational agent that responds to replies).

### 4. Red Flag / Weather Alert Integration (Extends Existing)

For critical weather notifications, the agent needs near-real-time awareness, not just monthly cron. This requires:
- A separate, more frequent check (every 1–4 hours during fire season) that queries NWS api.weather.gov for red flag warnings in the subscriber's county/zone.
- If a new red flag warning is detected that wasn't present at last check, trigger an immediate notification to all subscribers in that jurisdiction with critical_only or higher frequency.
- The notification content combines the NWS alert with property-specific actions from the zone engine: "Red flag warning for Jackson County. Wind gusts to 35 mph from the south. Based on your property profile, your highest-priority actions right now are: move combustible items off the deck, close all windows, confirm your go-bag is ready."

This is the only notification type that requires near-real-time dispatch. All other categories work fine on daily or weekly schedules.

### 5. Content Signal Integration (Optional, Connects to Agent Web Layer)

If the notification links back to Fire Shield pages (e.g., "See your full zone action plan"), those pages should work for both human visitors and AI agents. The agent web layer (llms.txt, Markdown endpoints) already handles this — an AI assistant helping the user can follow the link and get structured Markdown.

---

## What It Does NOT Require

- No new LLM infrastructure. The existing Claude API integration handles the rare cases where LLM generation is needed. Most notifications are template-based.
- No new database. Everything lives in the existing Supabase project (one new table).
- No new front-end framework. The subscription flow is a simple form on the existing PWA.
- No push notification infrastructure. Email (and optionally SMS) is sufficient and more reliable for this use case. Browser push notifications are fragile and have low opt-in rates.

---

## Notification Calendar (Maps to Seasonal Urgency Calendar)

| Month | Notification Type | Example Content |
|-------|------------------|-----------------|
| March | Seasonal maintenance | "Spring walkthrough time. Check vent screens for winter damage. Clear any debris that accumulated over winter." |
| March | Plant recommendation | "March is ideal for planting in the 5–30 ft zone. Here are 3 fire-resistant natives for your area." |
| April | Grant alert | "Oregon Defensible Space Assessment Incentive is accepting applications. $250 for a professional assessment. [Link]" |
| May | Pre-fire-season alert | "Fire season starts soon. Your #1 action: clean gutters, roof, and under-deck debris. [30 min, zero cost]" |
| June | Fire season start | "Fire season is here. Go-bag ready? Evacuation plan current? Combustible items off the deck? Quick checklist inside." |
| July–Sept | Monthly fire season check | "Monthly fire-ready check: gutters clear? Deck debris cleared? Grass mowed in the 5–30 ft zone?" |
| July–Sept | Red flag alerts | (Triggered by NWS, not calendar) "Red flag warning for Jackson County through Thursday. Here's what to do now for your property." |
| October | Post-season | "Fire season is winding down. Good time to assess what worked and schedule any larger projects for winter." |
| November | Off-season project prompt | "Winter is the best time for bigger projects: vent replacement, deck enclosure, tree thinning. These are easier and cheaper off-season." |
| January | Annual review | "New year, fresh start. Your Fire Shield profile shows 8 of 17 actions complete. Here are the 3 highest-impact remaining actions." |

---

## Privacy Considerations

- Email addresses are stored only for notification delivery.
- No property data is shared in notifications beyond what the homeowner has already entered.
- Notifications never include neighbor-specific information unless both parties have opted in (Phase 3).
- Unsubscribe link in every notification. One-click unsubscribe required.
- No selling or sharing of email/phone data. Ever.

---

## What It Would Take to Add to the Build

### If added during the code-a-thon (not recommended, but possible as a stretch goal):
- 2–3 hours additional work in Block 5 (polish).
- Build the subscriptions table in Supabase (15 min).
- Build a simple email signup form on the property overview page (30 min).
- Create 3–5 notification templates as static content (30 min).
- Set up Resend account and a single Supabase Edge Function or Vercel API route that sends a test notification (1 hour).
- Demo: enter address → subscribe → receive a personalized seasonal notification within 60 seconds (triggered manually for demo, not cron).
- Skip: cron scheduling, red flag integration, SMS, digest mode. Those are Phase 2.

### If added as Phase 2 (recommended):
- 1–2 days of work.
- Full subscription management UI with category and frequency selection.
- Template library covering all 12 months.
- pg_cron or Vercel cron scheduling.
- NWS red flag polling (4-hour interval during fire season).
- Email via Resend, optional SMS via Twilio.
- Unsubscribe flow.
- Basic analytics (open rates, link clicks, unsubscribe rates) to measure which notifications drive action.

### If evolved to Phase 3 (with neighborhood layer):
- Neighbor progress notifications ("Your street is 4 of 7 homes hardened").
- Community challenge notifications ("Ashland's Spring Fire Ready Challenge starts April 15").
- This connects to the gamification concept discussed earlier — the notification agent becomes the nudge engine for the competitive/collaborative neighborhood model.

---

## Why This Matters (Research Connection)

The behavior change research is clear: the intention-action gap is the core problem. Over 90% of Colorado mountain residents reported doing some mitigation, but fewer than half took any structural action. People know what to do. They don't do it because nothing prompts them at the right moment with the right specificity.

This notification agent directly addresses two of the five evidence-based principles from the research:

1. **Make mitigation social and visible** — neighborhood progress notifications leverage descriptive social norms, the strongest behavioral driver.
2. **Connect to tangible incentives** — grant alerts arrive when programs open, not months later when the homeowner happens to check a government website.

It also addresses the seasonal timing gap: the actions in layer_80_20_steps.md are time-sensitive, but the app itself is pull-only (the user has to come to it). The notification agent makes it push — the right action, for the right property, at the right time of year.
