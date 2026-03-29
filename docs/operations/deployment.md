# Deployment

Fire Shield uses three separate deployment targets:

| Component | Platform | Config file |
|-----------|----------|-------------|
| Backend (FastAPI) | fly.io | `backend/fly.toml` |
| Frontend (Next.js) | Vercel | `frontend/vercel.json` |
| MCP Server (Express) | Railway | `mcp_server/railway.json` |

---

## Backend — fly.io

### Prerequisites

- `flyctl` CLI installed and authenticated (`fly auth login`)
- Existing fly.io app named `fire-shield-api` (or update `app` in `fly.toml`)

### First Deploy

```bash
cd backend

# Create the persistent volume (run once)
fly volumes create fire_shield_data --region sea --size 1

# Deploy
fly deploy
```

### Subsequent Deploys

```bash
cd backend
fly deploy
```

The `start.sh` script runs migrations before starting uvicorn, so schema changes apply automatically on deploy.

### Environment Variables on fly.io

Set secrets (not committed to `fly.toml`):

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly secrets set ADMIN_TOKEN=your-secret-admin-token
fly secrets set SECRET_KEY=your-random-secret-key
```

Other variables with non-default production values:

```bash
fly secrets set APP_ENV=production
fly secrets set CORS_ORIGINS='["https://your-frontend.vercel.app"]'
fly secrets set QDRANT_HOST=localhost    # Qdrant runs as a separate process on the same machine
fly secrets set NWS_USER_AGENT="fire-shield contact@yourdomain.com"
```

### Architecture on fly.io

The `fly.toml` runs two processes on the same machine:

```toml
[processes]
app = "uvicorn app.config.main:app --host 0.0.0.0 --port 8000"
qdrant = "qdrant --storage-path /data/qdrant"
```

Both share the persistent volume at `/data`. SQLite lives at `/data/app.db` and Qdrant storage at `/data/qdrant`.

> This is a cost-optimized single-machine setup. For production load, separate Qdrant to a dedicated service.

### Scaling

```bash
fly scale count app=1    # Start with 1 instance (SQLite is single-writer)
fly scale memory 2048    # 2GB RAM recommended for embedding models
```

### Logs

```bash
fly logs              # Tail live logs
fly logs -i app       # Backend process only
fly logs -i qdrant    # Qdrant process only
```

---

## Frontend — Vercel

### Prerequisites

- Vercel CLI installed (`npm i -g vercel`) or use the Vercel dashboard
- Repository connected to a Vercel project

### Deploy

```bash
cd frontend
vercel --prod
```

Or push to the connected git branch — Vercel deploys automatically on push.

### Environment Variables on Vercel

Set in Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://fire-shield-api.fly.dev` |

The `vercel.json` sets this for production builds, but you can override it in the dashboard for staging environments.

### Build Settings

`vercel.json` is pre-configured:
- Framework: `nextjs`
- Build command: `next build`
- Cache headers for `/llms.txt` (24h) and `/api/llms-full` (1h)

---

## MCP Server — Railway

### Prerequisites

- Railway account and CLI installed (`npm i -g @railway/cli`)
- Project created on Railway

### Deploy

```bash
cd mcp_server
railway up
```

Or connect the `mcp_server/` directory to a Railway service via the dashboard.

### Environment Variables on Railway

Set in Railway dashboard → Service → Variables:

| Variable | Value |
|----------|-------|
| `FIRE_SHIELD_API_URL` | `https://fire-shield-api.fly.dev` |
| `MCP_PORT` | `3001` |

### Health Check

Railway uses `GET /health` (configured in `railway.json`). The health endpoint returns `{ "status": "ok" }`.

---

## Production Checklist

Before going live:

- [ ] `ANTHROPIC_API_KEY` set on fly.io
- [ ] `ADMIN_TOKEN` set to a strong random value on fly.io
- [ ] `SECRET_KEY` set to a strong random value on fly.io
- [ ] `CORS_ORIGINS` updated to allow the Vercel domain
- [ ] `NEXT_PUBLIC_API_URL` set to the fly.io URL on Vercel
- [ ] `FIRE_SHIELD_API_URL` set to the fly.io URL on Railway
- [ ] Persistent volume created on fly.io
- [ ] At least one admin LWF plant sync run
- [ ] Priority documents ingested (see [corpus-management.md](./corpus-management.md))
- [ ] Smoke test: resolve an address, get zone actions, run a chat query

---

## Domain / Custom URL

After deploying to Vercel, set a custom domain in the Vercel dashboard. Then update `CORS_ORIGINS` on fly.io to include the new domain:

```bash
fly secrets set CORS_ORIGINS='["https://yourdomain.com"]'
```
