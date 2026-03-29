"""
Integration test fixtures.

Extends the top-level test_db with plant seed data, since plants are NOT
seeded by migrations (they come from the LWF sync). Zone actions ARE seeded
by migrations, so no additional zone seeding is needed here.

Also provides app_client for HTTP-level integration tests. This overrides
the top-level app_client to use the seeded_db instead of the bare test_db.
"""

import pytest
import pytest_asyncio
import app.config.database as db_module


# ── Test plant records ────────────────────────────────────────────────────────

PLANT_SEED = [
    # (id, common_name, scientific_name, zone_0_5ft, zone_5_30ft, is_native,
    #  deer_resistant, water_need, is_noxious_weed)
    ("plant-1", "Oregon White Oak",   "Quercus garryana",     0, 1, 1, 0, "low",    0),
    ("plant-2", "Pacific Madrone",    "Arbutus menziesii",    0, 0, 1, 1, "low",    0),
    ("plant-3", "Manzanita",          "Arctostaphylos spp.",  1, 1, 1, 0, "low",    0),
    ("plant-4", "English Ivy",        "Hedera helix",         1, 1, 0, 0, "medium", 0),
    # Noxious weed — should be excluded by default (exclude_noxious=True)
    ("plant-5", "Himalayan Blackberry","Rubus armeniacus",    0, 1, 0, 0, "high",   1),
]


@pytest_asyncio.fixture
async def seeded_db(test_db):
    """
    Add test plant records to the test database.

    Plants:
      1 – Oregon White Oak: native, zone_5_30ft, low water, not noxious
      2 – Pacific Madrone:  native, no zone match, deer resistant, low water
      3 – Manzanita:        native, zone_0_5ft + zone_5_30ft, low water
      4 – English Ivy:      non-native, zone_0_5ft + zone_5_30ft
      5 – Himalayan Blackberry: noxious weed (excluded by default filter)

    Does NOT seed zone_actions or jurisdictions (already in migrations).
    """
    async with db_module.get_db() as db:
        for plant_id, common_name, sci_name, z0, z5, native, deer, water, noxious in PLANT_SEED:
            await db.execute(
                """INSERT OR IGNORE INTO plants
                   (id, common_name, scientific_name,
                    zone_0_5ft, zone_5_30ft,
                    is_native, deer_resistant, water_need, is_noxious_weed)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (plant_id, common_name, sci_name, z0, z5, native, deer, water, noxious),
            )
        await db.commit()
    yield test_db


@pytest_asyncio.fixture
async def app_client(seeded_db):
    """
    HTTPX AsyncClient with the FastAPI app and seeded plant data.
    Overrides the top-level app_client fixture for integration tests.
    """
    from httpx import AsyncClient, ASGITransport
    from app.config.main import create_app

    application = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        yield client
