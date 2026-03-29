# Setup Guide

This guide covers prerequisites, environment configuration, and first-run instructions for running Fire Shield locally.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | Required for backend |
| Node.js | 18+ | Required for frontend and MCP server |
| Docker | Any recent | Required for Qdrant vector database |
| Git | Any | Clone the repo |

---

## 1. Clone and Navigate

```bash
git clone <repo-url>
cd fire_shield
```

---

## 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3.11 -m venv .venv
source .venv/bin/activate    # Linux/macOS
# .venv\Scripts\activate     # Windows

# Install dependencies
pip install -e ".[dev]"
```

### Configure Environment

Copy the example env file and fill in required values:

```bash
cp .env.example .env
```

**Required:**

| Variable | What to set |
|----------|------------|
| `ANTHROPIC_API_KEY` | Your Claude API key from console.anthropic.com |
| `ADMIN_TOKEN` | A secret string for admin UI access (any value locally) |

**Optional (defaults work locally):**

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `data/app.db` | SQLite file path |
| `QDRANT_HOST` | `localhost` | Qdrant hostname |
| `QDRANT_PORT` | `6333` | Qdrant port |
| `CORS_ORIGINS` | `["http://localhost:3100"]` | Frontend origin |
| `EMBEDDING_DEVICE` | `auto` | `cuda` if GPU available, else `cpu` |
| `HF_HOME` | None | Optional HuggingFace model cache dir |

> **Models download on first run.** `BAAI/bge-large-en-v1.5` (~1.3GB) and `BAAI/bge-reranker-large` (~1.3GB) are downloaded from HuggingFace automatically. Set `HF_HOME` to a persistent directory to avoid re-downloading after restarts.

---

## 3. Start Qdrant

```bash
docker run -d -p 6333:6333 --name qdrant qdrant/qdrant
```

Verify: `curl http://localhost:6333/readyz` → `{ "title": "qdrant - vector search engine" }`

---

## 4. Start the Backend

```bash
cd backend
source .venv/bin/activate

# Development (auto-reload)
uvicorn app.config.main:app --reload --port 8000
```

On startup, `init_db()` runs all pending migrations automatically. You'll see migration names printed in the logs.

Verify: `curl http://localhost:8100/health` → `{ "status": "healthy" }`

---

## 5. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file:

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:8100" > .env.local
```

```bash
npm run dev    # http://localhost:3100
```

---

## 6. MCP Server Setup (Optional)

The MCP server is only needed if using Claude Desktop or an external agent.

```bash
cd mcp_server
npm install
node index.js    # http://localhost:3101
```

Configure your MCP client to connect to `http://localhost:3101/sse`.

---

## 7. Verify Everything Works

```bash
# Backend health
curl http://localhost:8100/health

# Zone actions (no API key needed)
curl http://localhost:8100/api/zones/top?n=3

# Jurisdiction resolve (requires backend running)
curl -X POST http://localhost:8100/api/jurisdiction/resolve \
  -H "Content-Type: application/json" \
  -d '{"address": "1234 Greensprings Hwy, Ashland, OR 97520"}'

# RAG query (requires ANTHROPIC_API_KEY + Qdrant + documents ingested)
curl -X POST http://localhost:8100/api/query/ \
  -H "Content-Type: application/json" \
  -d '{"question": "What is a defensible space?", "jurisdiction_code": "ashland"}'
```

---

## 8. Ingest Initial Documents

The RAG chat feature is only useful once documents are ingested. Use the admin UI or the API:

1. Navigate to `http://localhost:3100/admin`
2. Enter your `ADMIN_TOKEN` value
3. Go to the Corpus tab → Add Document
4. Paste a document URL, set jurisdiction and trust tier, click Ingest

Or via API:
```bash
curl -X POST http://localhost:8100/api/ingest/url \
  -H "Content-Type: application/json" \
  -b "admin_token=your-admin-token" \
  -d '{
    "url": "https://example.com/ashland-fire-code.pdf",
    "title": "Ashland Fire Code 2024",
    "jurisdiction": "ashland",
    "trust_tier": 1
  }'
```

See [corpus-management.md](./corpus-management.md) for full ingestion guidance.

---

## 9. Sync Plants

Plants come from the Living with Fire API. Run the sync once to populate the plant database:

1. Admin UI → Plants tab → click "Sync Plants"
2. Or: `curl -X POST http://localhost:8100/api/admin/plants/sync -b "admin_token=your-token"`

See [plant-sync.md](./plant-sync.md) for details.

---

## Running Tests

```bash
# Backend
cd backend
.venv/bin/pytest tests/ -v

# Frontend
cd frontend
npm test
```

Backend tests use a temp SQLite file and mock the CrossEncoder — no Qdrant or Claude API needed.
