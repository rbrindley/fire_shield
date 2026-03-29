#!/usr/bin/env bash
# Fire Shield — Start all services
# Usage: ./start.sh [--no-mcp] [--no-qdrant]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Ports ─────────────────────────────────────────────────────────────────────
BACKEND_PORT=8100
FRONTEND_PORT=3100
MCP_PORT=3101
QDRANT_PORT=6333

# ── Flags ─────────────────────────────────────────────────────────────────────
SKIP_MCP=false
SKIP_QDRANT=false
for arg in "$@"; do
  case "$arg" in
    --no-mcp)    SKIP_MCP=true ;;
    --no-qdrant) SKIP_QDRANT=true ;;
    --help|-h)
      echo "Usage: ./start.sh [--no-mcp] [--no-qdrant]"
      echo ""
      echo "Starts all Fire Shield services:"
      echo "  Backend   (FastAPI)    → http://localhost:$BACKEND_PORT"
      echo "  Frontend  (Next.js)    → http://localhost:$FRONTEND_PORT"
      echo "  MCP Server             → http://localhost:$MCP_PORT"
      echo "  Qdrant                 → http://localhost:$QDRANT_PORT"
      echo ""
      echo "Options:"
      echo "  --no-mcp      Skip the MCP server"
      echo "  --no-qdrant   Skip Qdrant (if running externally)"
      exit 0
      ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BLUE}[fire-shield]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $*"; }
err()  { echo -e "${RED}  ✗${NC} $*"; }

# Track PIDs for cleanup
PIDS=()
cleanup() {
  echo ""
  log "Shutting down..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  # Kill process groups we started
  if [ -n "${BACKEND_PID:-}" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill -- -"$BACKEND_PID" 2>/dev/null || kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID:-}" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill -- -"$FRONTEND_PID" 2>/dev/null || kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [ -n "${MCP_PID:-}" ] && kill -0 "$MCP_PID" 2>/dev/null; then
    kill -- -"$MCP_PID" 2>/dev/null || kill "$MCP_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  log "All services stopped."
}
trap cleanup EXIT INT TERM

# ── Port check ────────────────────────────────────────────────────────────────
check_port() {
  local port=$1
  local service=$2

  if ! ss -tlnp 2>/dev/null | grep -q ":${port} " && \
     ! lsof -i :"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    return 0  # port is free
  fi

  # Port is busy — find what's using it
  local proc_info
  proc_info=$(lsof -i :"$port" -sTCP:LISTEN -t 2>/dev/null || ss -tlnp 2>/dev/null | grep ":${port} " | sed 's/.*pid=\([0-9]*\).*/\1/' || echo "unknown")
  local pid_on_port
  pid_on_port=$(echo "$proc_info" | head -1)
  local cmd_name=""
  if [ -n "$pid_on_port" ] && [ "$pid_on_port" != "unknown" ]; then
    cmd_name=$(ps -p "$pid_on_port" -o comm= 2>/dev/null || echo "unknown")
  fi

  warn "Port ${BOLD}$port${NC} ($service) is in use${cmd_name:+ by ${BOLD}$cmd_name${NC} (PID $pid_on_port)}"
  echo -en "     Kill it and continue? [y/N] "
  read -r answer
  if [[ "$answer" =~ ^[Yy] ]]; then
    if [ -n "$pid_on_port" ] && [ "$pid_on_port" != "unknown" ]; then
      kill "$pid_on_port" 2>/dev/null || true
      sleep 1
      # Force kill if still alive
      if kill -0 "$pid_on_port" 2>/dev/null; then
        kill -9 "$pid_on_port" 2>/dev/null || true
        sleep 0.5
      fi
      ok "Killed process on port $port"
    fi
  else
    err "Cannot start $service — port $port is busy. Aborting."
    exit 1
  fi
}

# ── Dependency checks ────────────────────────────────────────────────────────
check_deps() {
  local missing=()

  if [ ! -d "$ROOT_DIR/backend/.venv" ]; then
    missing+=("Python venv (backend/.venv)")
  fi
  if [ ! -f "$ROOT_DIR/backend/.env" ]; then
    missing+=("backend/.env (copy from .env.example)")
  fi
  if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    missing+=("Frontend deps (run: cd frontend && npm install)")
  fi
  if [ "$SKIP_MCP" = false ] && [ ! -d "$ROOT_DIR/mcp_server/node_modules" ]; then
    missing+=("MCP deps (run: cd mcp_server && npm install)")
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    err "Missing dependencies:"
    for m in "${missing[@]}"; do
      echo -e "     - $m"
    done
    exit 1
  fi
}

# ── Wait for service to be ready ─────────────────────────────────────────────
wait_for_port() {
  local port=$1
  local service=$2
  local timeout=${3:-30}
  local elapsed=0

  while [ $elapsed -lt $timeout ]; do
    if curl -sf "http://localhost:$port" >/dev/null 2>&1 || \
       curl -sf "http://localhost:$port/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1
}

# ── Qdrant ────────────────────────────────────────────────────────────────────
start_qdrant() {
  if [ "$SKIP_QDRANT" = true ]; then
    warn "Skipping Qdrant (--no-qdrant)"
    return
  fi

  # Check if already running and healthy
  if curl -sf "http://localhost:$QDRANT_PORT/readyz" >/dev/null 2>&1; then
    ok "Qdrant already running on port $QDRANT_PORT"
    return
  fi

  check_port "$QDRANT_PORT" "Qdrant"

  if ! command -v docker &>/dev/null; then
    warn "Docker not found — skipping Qdrant. Install Docker or run Qdrant manually."
    return
  fi

  log "Starting Qdrant..."
  # Remove old stopped container if exists
  docker rm -f fire-shield-qdrant 2>/dev/null || true
  docker run -d --name fire-shield-qdrant -p "$QDRANT_PORT":6333 qdrant/qdrant >/dev/null 2>&1

  if wait_for_port "$QDRANT_PORT" "Qdrant" 15; then
    ok "Qdrant ready on port $QDRANT_PORT"
  else
    warn "Qdrant started but not responding yet — backend will retry on connect"
  fi
}

# ── Backend ───────────────────────────────────────────────────────────────────
start_backend() {
  check_port "$BACKEND_PORT" "Backend"

  # Ensure .env.local exists for frontend
  if [ ! -f "$ROOT_DIR/frontend/.env.local" ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT" > "$ROOT_DIR/frontend/.env.local"
    ok "Created frontend/.env.local"
  fi

  log "Starting Backend (FastAPI)..."
  (
    cd "$ROOT_DIR/backend"
    .venv/bin/uvicorn app.config.main:app --reload --port "$BACKEND_PORT" 2>&1 | \
      sed "s/^/  ${CYAN}[backend]${NC} /"
  ) &
  BACKEND_PID=$!
  PIDS+=("$BACKEND_PID")

  if wait_for_port "$BACKEND_PORT" "Backend" 30; then
    ok "Backend ready on port $BACKEND_PORT"
  else
    err "Backend failed to start within 30s — check logs above"
    exit 1
  fi
}

# ── Frontend ──────────────────────────────────────────────────────────────────
start_frontend() {
  check_port "$FRONTEND_PORT" "Frontend"

  log "Starting Frontend (Next.js)..."
  (
    cd "$ROOT_DIR/frontend"
    npx next dev -p "$FRONTEND_PORT" 2>&1 | \
      sed "s/^/  ${GREEN}[frontend]${NC} /"
  ) &
  FRONTEND_PID=$!
  PIDS+=("$FRONTEND_PID")

  if wait_for_port "$FRONTEND_PORT" "Frontend" 30; then
    ok "Frontend ready on port $FRONTEND_PORT"
  else
    warn "Frontend still starting — may take a moment on first compile"
  fi
}

# ── MCP Server ────────────────────────────────────────────────────────────────
start_mcp() {
  if [ "$SKIP_MCP" = true ]; then
    warn "Skipping MCP server (--no-mcp)"
    return
  fi

  check_port "$MCP_PORT" "MCP Server"

  log "Starting MCP Server..."
  (
    cd "$ROOT_DIR/mcp_server"
    FIRE_SHIELD_API_URL="http://localhost:$BACKEND_PORT" MCP_PORT="$MCP_PORT" \
      node index.js 2>&1 | \
      sed "s/^/  ${YELLOW}[mcp]${NC} /"
  ) &
  MCP_PID=$!
  PIDS+=("$MCP_PID")

  if wait_for_port "$MCP_PORT" "MCP Server" 10; then
    ok "MCP Server ready on port $MCP_PORT"
  else
    warn "MCP Server started but health check pending"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}🔥 Fire Shield — Starting all services${NC}"
echo ""

check_deps
start_qdrant
start_backend
start_frontend
start_mcp

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Fire Shield is running${NC}"
echo ""
echo -e "  App:        ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  API:        ${CYAN}http://localhost:$BACKEND_PORT${NC}"
echo -e "  API Health:  http://localhost:$BACKEND_PORT/health"
if [ "$SKIP_MCP" = false ]; then
echo -e "  MCP SSE:    ${YELLOW}http://localhost:$MCP_PORT/sse${NC}"
fi
if [ "$SKIP_QDRANT" = false ]; then
echo -e "  Qdrant:      http://localhost:$QDRANT_PORT"
fi
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Wait for any child to exit
wait
