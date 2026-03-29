# Fire Shield

Property-specific wildfire prevention assistant for the Rogue Valley, Oregon. Enter an address and get a zone-based action plan, jurisdiction-scoped fire guidance via RAG chat, and fire-resistant plant recommendations.

## Quick Start

```bash
# 1. Start Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

# 2. Start backend
cd backend && python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # add ANTHROPIC_API_KEY and ADMIN_TOKEN
uvicorn app.config.main:app --reload --port 8000

# 3. Start frontend
cd frontend && npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8100" > .env.local
npm run dev   # http://localhost:3100

# 4. (Optional) MCP server
cd mcp_server && npm install && node index.js   # http://localhost:3101
```

## Documentation

| Guide | Audience |
|-------|---------|
| [docs/ai_quick_start.md](docs/ai_quick_start.md) | AI agents and new developers — start here |
| [docs/operations/setup.md](docs/operations/setup.md) | Full local setup with env vars and first-run steps |
| [docs/architecture/overview.md](docs/architecture/overview.md) | System diagram and data flows |
| [docs/api/endpoints.md](docs/api/endpoints.md) | All 25 API routes quick-reference |
| [docs/operations/corpus-management.md](docs/operations/corpus-management.md) | Adding and managing corpus documents |
| [docs/operations/deployment.md](docs/operations/deployment.md) | fly.io + Vercel + Railway deploy steps |
| [DEMO.md](DEMO.md) | Guided demo script (~12 minutes) |
| [backlog.md](backlog.md) | Roadmap and planned features |

## Tech Stack

FastAPI + SQLite + Qdrant · Next.js 16 + React 19 · Claude claude-sonnet-4-6 · BAAI/bge embeddings + reranker · Leaflet maps · Express MCP server
