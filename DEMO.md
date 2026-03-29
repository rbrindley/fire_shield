# Fire Shield — Demo Script

## Setup (before demo)

```bash
# Terminal 1: Backend
cd backend
.venv/bin/uvicorn app.config.main:app --reload --port 8000

# Terminal 2: Qdrant (if not running)
docker run -p 6333:6333 qdrant/qdrant

# Terminal 3: Frontend
cd frontend
npm run dev   # http://localhost:3100

# Terminal 4: MCP server
cd mcp_server
node index.js   # http://localhost:3101
```

---

## Demo Flow (~12 minutes)

### 1. Address Entry → Property Overview (2 min)

1. Open http://localhost:3100
2. Type: **1234 Greensprings Hwy, Ashland, OR 97520**
3. Submit → watch geocode + jurisdiction resolve
4. Show property overview page:
   - Jurisdiction badge: "Ashland, Jackson County, OR"
   - Seasonal banner (spring/fire season depending on month)
   - Priority zone cards (Layer 0 + Layer 1)

**Key talking point:** Jurisdiction chain — Ashland-specific docs rank higher than generic guidance.

---

### 2. HIZ Map (2 min)

1. Click **View map →**
2. Show the 4 concentric rings (red/orange/yellow/light) around the property point
3. Click **Layer 0 ring** → ZoneCard with 5 actions, effort badges, citations
4. Click **Layer 1 ring** → under-deck debris first, neighbor note on Layer 2

**Key talking point:** "Start with Layer 0 — it's where most homes are lost. Vent screening alone stops ember intrusion."

---

### 3. Jurisdiction Contrast (1 min)

1. Go back to home, enter: **175 S Oregon St, Jacksonville, OR 97530**
2. Show property overview → jurisdiction shows "Jacksonville, Jackson County, OR"
3. Mention: Jacksonville gets Jackson County + state docs (no city-specific code yet), not Ashland ordinances

---

### 4. Chat with Citations (3 min)

1. From either property page, click **Ask a question**
2. Ask: **"What should I do first around my house to reduce fire risk?"**
3. Show response:
   - Inline `[1]`, `[2]` citation markers
   - Sources panel below: color-coded by type (blue=document, purple=evidence, green=structured)
   - Jurisdiction note if applicable
4. Toggle **Simple → Pro** mode, ask again:
   - Pro response cites ORS/NFPA codes, uses HIZ layer framework
5. If fire season active: mention NWS tool-use (red flag warnings injected into response)

---

### 5. Plant Search (1 min)

1. Click **Plants** (or navigate to /plants?jurisdiction=ashland)
2. Search: **"low water natives near the house"**
3. Show results: zone eligibility badges, fire behavior notes, Ashland restricted flag
4. Mention: data synced live from Landscape West Foundation plant database

---

### 6. Admin UI (2 min)

Navigate to http://localhost:3100/admin

1. **Login** with admin token (set in `.env`)
2. **Corpus tab**: show source list with jurisdiction/trust-tier badges
   - Deprecate one source → status changes to "stale"
   - Show ingest form: paste a URL + select jurisdiction + trust tier → submit
   - Show jurisdiction chain preview (dropdown updates live)
3. **Plants tab**: "Sync from LWF" button, last synced date, sync log
4. **Zone Actions tab**: inline edit priority score on one action

---

### 7. MCP Server (1 min)

```bash
# Test get_zone_actions tool
curl -X POST http://localhost:3101/messages \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "get_zone_actions",
    "params": {"address": "1234 Greensprings Hwy, Ashland OR"}
  }'
```

Show: structured JSON with `jurisdiction_note`, per-zone actions, citations.

---

### 8. Agent Web Layer (30 sec)

```bash
# llms.txt
curl http://localhost:3100/llms.txt

# Full markdown dump (for AI agents)
curl -H "Accept: text/markdown" http://localhost:3100/plants
# → redirects to /api/llms-full → returns plants + zone actions as Markdown
```

---

## Key Numbers to Mention

- **17 zone actions** across 5 HIZ layers, all evidence-cited
- **Jurisdiction chain**: up to 5 levels (city → county → state → federal → universal)
- **Trust tier boost**: Tier 1 local code = 1.20× retrieval weight vs. generic guidance
- **3 citation types**: structured data (plants/zones), retrieved corpus, fire science evidence
- **NWS tool-use**: live red flag warning integration at query time
- **LWF plant database**: 14 fire-safety attributes per plant, Ashland restriction flags

---

## Fallback if Backend Is Down

All zone action content is seeded in SQLite — restart backend with:
```bash
cd backend && .venv/bin/python -m app.config.main
```
Or run migrations manually:
```bash
.venv/bin/python -c "
import sqlite3
conn = sqlite3.connect('data/app.db')
for f in sorted(__import__('glob').glob('app/migrations/*.sql')):
    conn.executescript(open(f).read())
conn.commit()
print('done')
"
```
