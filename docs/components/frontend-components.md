# Frontend Component Reference

The frontend is a Next.js 16 PWA in `frontend/`. Pages live in `frontend/app/` (App Router); shared components in `frontend/components/`.

## Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Home — address entry, sample questions, evidence strip |
| `/map` | `app/map/page.tsx` | Interactive HIZ map with zone action sidebar |
| `/plants` | `app/plants/page.tsx` | Searchable fire-resistant plant database |
| `/chat` | `app/chat/page.tsx` | RAG chat — ask wildfire questions with cited answers |
| `/property/[id]` | `app/property/[id]/page.tsx` | Static property overview with priority zone cards |
| `/admin` | `app/admin/page.tsx` | Admin token login |

**Note on `useSearchParams()`:** In Next.js 16, any page using `useSearchParams()` must wrap the component in `<Suspense>`. The chat, map, and plants pages follow this pattern:

```tsx
// Default export (the page component)
export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatInner />  {/* inner component uses useSearchParams() */}
    </Suspense>
  );
}
```

---

## Components

### `ZoneCard`

**File:** `components/ZoneCard.tsx`

Renders a single HIZ zone layer with all its prioritized actions.

```typescript
interface ZoneCardProps {
  layer: Layer;
  neighborNote?: string;
  currentSeason?: string;
}

interface Layer {
  layer: number;          // 0–4
  layer_name: string;     // "The House Itself", "Noncombustible Zone", etc.
  layer_description: string;
  actions: ZoneAction[];
}

interface ZoneAction {
  id: string;
  layer: number;
  action_title: string;
  action_detail: string;
  why_it_matters: string;
  evidence_citation: string;
  effort_level: string;           // "zero_cost" | "low" | "moderate" | "high"
  cost_estimate: string;
  time_estimate: string;
  is_seasonal_peak: boolean;      // true if current month is in seasonal_peak
  effective_priority: number;     // 0.0–1.0 after seasonal boost
}
```

**Behavior:**
- Color-coded ring by layer (red → orange → amber → yellow → green)
- Effort badge labels: `zero_cost` → "Free", `low` → "Low cost", `moderate` → "Moderate", `high` → "High effort"
- "Now" badge shown when `is_seasonal_peak` is true
- "Fire Season Priority" badge shown when `currentSeason === "summer"` AND `layer.layer` is 0 or 1
- `neighborNote` rendered as a callout below the actions (only when provided)

---

### `CitationLink`

**File:** `components/CitationLink.tsx`

Expandable inline citation component. Renders collapsed by default; click expands to show full text and optional source link.

```typescript
type CitationType = "structured_data" | "retrieved_document" | "fire_science_evidence";

interface CitationLinkProps {
  citation: string;        // Full citation text; returns null if empty
  type?: CitationType;     // Controls icon and color
  url?: string;            // Optional source link (shown when expanded)
}
```

**Visual behavior by type:**

| Type | Icon | Text color | Background |
|------|------|-----------|------------|
| `retrieved_document` (default) | 📄 | blue | `bg-blue-50` |
| `fire_science_evidence` | 🔬 | purple | `bg-purple-50` |
| `structured_data` | 🗄 | green | `bg-green-50` |

- Returns `null` when `citation` is an empty string
- Collapsed state: only the icon and a summary label are visible
- Expanded state: full `citation` text visible; if `url` is set, renders `<a href={url} target="_blank">`
- No anchor tag is rendered when `url` is absent, even when expanded

---

### `HIZMap`

**File:** `components/HIZMap.tsx`

Client-side interactive map (Leaflet + Turf.js). Renders 4 concentric zone rings around the property address and links them to zone action cards.

```typescript
interface HIZMapProps {
  lat: number;
  lng: number;
  jurisdictionDisplay: string;
  profileId: string;
}
```

**Behavior:**
- Renders as `"use client"` — Leaflet requires browser APIs
- Fetches zone data from `GET /api/zones/` on mount
- Draws 4 Turf.js buffer circles:
  - 0–5 ft: red (#ef4444)
  - 5–30 ft: orange (#f97316)
  - 30–100 ft: amber (#f59e0b)
  - 100+ ft: green (#22c55e)
- Property marker at lat/lng
- Clicking a zone ring opens a `ZoneCard` sidebar
- Layer selection buttons above map (one per zone)
- Legend in lower-left corner

---

### `Nav`

**File:** `components/Nav.tsx`

Sticky top navigation bar.

**Props:** None

**Behavior:**
- Displays Fire Shield logo and nav links: Home, Map & Zones, Plants, Ask
- Active link highlighted using `usePathname()`
- No server-side state — purely presentational

---

## Data Flow Summary

```
sessionStorage
  └── property_profile_id, lat, lng, jurisdiction_code, address
          │
          ├── HIZMap: reads profile, fetches /api/zones/, renders rings
          ├── ChatPage: reads jurisdiction + lat/lng, sends with POST /api/query/
          └── PlantsPage: reads jurisdiction (optional filter context)
```

Property data is persisted in `sessionStorage` (not localStorage) — cleared on tab close. The backend `property_profiles` table provides a durable record if the profile ID is bookmarked or shared.
