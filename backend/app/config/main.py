"""FastAPI application factory and main entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.config.database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    await init_db()
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Fire Shield API",
        version="1.0.0",
        description="Property-specific wildfire prevention assistant for the Rogue Valley",
        debug=settings.debug,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Property / geocoding
    from app.jurisdiction.routes import router as jurisdiction_router
    app.include_router(jurisdiction_router, prefix="/api/jurisdiction", tags=["jurisdiction"])

    # Zone engine
    from app.zone.routes import router as zone_router
    app.include_router(zone_router, prefix="/api/zones", tags=["zones"])

    # RAG query
    from app.rag.routes import router as rag_router
    app.include_router(rag_router, prefix="/api/query", tags=["query"])

    # Plant database
    from app.plant.routes import router as plant_router
    app.include_router(plant_router, prefix="/api/plants", tags=["plants"])

    # Document ingestion
    from app.ingest.routes import router as ingest_router
    app.include_router(ingest_router, prefix="/api/ingest", tags=["ingest"])

    # Admin
    from app.admin.routes import router as admin_router
    app.include_router(admin_router, prefix="/api/admin", tags=["admin"])

    # Conversation memory
    from app.memory.routes import router as memory_router
    app.include_router(memory_router, prefix="/api/memory", tags=["memory"])

    # Nursery search
    from app.nursery.routes import router as nursery_router
    app.include_router(nursery_router, prefix="/api/nursery", tags=["nursery"])

    # Building footprints
    from app.building.routes import router as building_router
    app.include_router(building_router, prefix="/api/buildings", tags=["buildings"])

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "app": "fire_shield", "version": "1.0.0"}

    return app


app = create_app()
