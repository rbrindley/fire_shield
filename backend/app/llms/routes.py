"""Full knowledge-base dump as Markdown + public document listing."""

from typing import Any

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.config.database import get_db

router = APIRouter()


@router.get("/documents")
async def list_documents() -> dict[str, Any]:
    """Public listing of all ingested documents (no content, just metadata)."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT id, title, jurisdiction, trust_tier, source_url, status "
            "FROM documents ORDER BY trust_tier ASC, title ASC"
        )
        rows = await cursor.fetchall()
    return {"documents": [dict(r) for r in rows]}

HEADER = """\
# Fire Shield — Full Knowledge Base
> Property-specific wildfire prevention for Southern Oregon's Rogue Valley.
> This document contains everything Fire Shield knows: zone actions, fire-resistant
> plants, and evidence from ingested fire science documents and local codes.
> Paste it into any AI chat to give that AI access to Fire Shield's data.

"""


def _fmt_bool(val: int | None) -> str:
    return "Yes" if val else "No"


def _fmt_zones(row: dict) -> str:
    zones = []
    if row["zone_0_5ft"]:
        zones.append("0–5 ft")
    if row["zone_5_30ft"]:
        zones.append("5–30 ft")
    if row["zone_30_100ft"]:
        zones.append("30–100 ft")
    if row["zone_100ft_plus"]:
        zones.append("100+ ft")
    return ", ".join(zones) if zones else "Not specified"


LAYER_LABELS = {
    0: "Layer 0 — The House Itself",
    1: "Layer 1 — 0–5 Feet (Noncombustible Zone)",
    2: "Layer 2 — 5–30 Feet (Lean, Clean, Green)",
    3: "Layer 3 — 30–100 Feet (Reduced Fuel Zone)",
    4: "Layer 4 — 100+ Feet (Access & Community)",
}


@router.get("/llms-full", response_class=PlainTextResponse)
async def llms_full():
    """Dump the entire Fire Shield knowledge base as a single Markdown document."""
    parts: list[str] = [HEADER]

    async with get_db() as db:
        # ── Zone Actions ────────────────────────────────────────────────
        parts.append("## Home Ignition Zone Actions\n\n")
        parts.append(
            "The Home Ignition Zone (HIZ) framework breaks wildfire prevention "
            "into concentric layers around the home. These 17 prioritized, "
            "evidence-based actions are ordered by impact within each layer.\n\n"
        )

        cursor = await db.execute(
            "SELECT * FROM zone_actions ORDER BY layer ASC, rank_in_layer ASC"
        )
        rows = await cursor.fetchall()
        current_layer = -1
        for row in rows:
            r = dict(row)
            if r["layer"] != current_layer:
                current_layer = r["layer"]
                parts.append(f"### {LAYER_LABELS.get(current_layer, f'Layer {current_layer}')}\n\n")
            parts.append(f"**{r['rank_in_layer']}. {r['action_title']}**\n\n")
            parts.append(f"{r['action_detail']}\n\n")
            parts.append(f"*Why it matters:* {r['why_it_matters']}\n\n")
            parts.append(f"*Evidence:* {r['evidence_citation']}\n\n")
            parts.append(
                f"Effort: {r['effort_level']} · Cost: {r['cost_estimate']} · "
                f"Time: {r['time_estimate']} · Priority: {r['priority_score']}\n\n"
            )

        # ── Plants ──────────────────────────────────────────────────────
        parts.append("---\n\n## Fire-Resistant Plant Database\n\n")

        cursor = await db.execute(
            "SELECT common_name, scientific_name, plant_type, "
            "zone_0_5ft, zone_5_30ft, zone_30_100ft, zone_100ft_plus, "
            "water_need, is_native, deer_resistant, pollinator_support, "
            "sun, mature_height_min_ft, mature_height_max_ft, "
            "fire_behavior_notes, placement_notes, "
            "ashland_restricted, ashland_restriction_type "
            "FROM plants WHERE is_noxious_weed = 0 ORDER BY common_name ASC"
        )
        plants = await cursor.fetchall()
        parts.append(f"{len(plants)} fire-resistant plants for the Rogue Valley.\n\n")

        for p in plants:
            r = dict(p)
            parts.append(f"### {r['common_name']}")
            if r["scientific_name"]:
                parts.append(f" (*{r['scientific_name']}*)")
            parts.append("\n\n")

            attrs: list[str] = []
            if r["plant_type"]:
                attrs.append(f"Type: {r['plant_type']}")
            attrs.append(f"Zones: {_fmt_zones(r)}")
            if r["water_need"]:
                attrs.append(f"Water: {r['water_need']}")
            if r["sun"]:
                attrs.append(f"Sun: {r['sun']}")
            if r["is_native"]:
                attrs.append("Native: Yes")
            if r["deer_resistant"]:
                attrs.append("Deer resistant: Yes")
            if r["pollinator_support"]:
                attrs.append("Pollinator support: Yes")
            if r["mature_height_min_ft"] and r["mature_height_max_ft"]:
                attrs.append(
                    f"Height: {r['mature_height_min_ft']}–{r['mature_height_max_ft']} ft"
                )
            parts.append(" · ".join(attrs) + "\n\n")

            if r["fire_behavior_notes"]:
                parts.append(f"*Fire behavior:* {r['fire_behavior_notes']}\n\n")
            if r["placement_notes"]:
                parts.append(f"*Placement:* {r['placement_notes']}\n\n")
            if r["ashland_restricted"]:
                parts.append(
                    f"**Ashland restriction:** {r['ashland_restriction_type'] or 'Restricted'}\n\n"
                )

        # ── Knowledge Base Chunks ───────────────────────────────────────
        parts.append("---\n\n## Evidence & Local Codes\n\n")
        parts.append(
            "Source documents ingested from fire science research, "
            "local building codes, and grant/incentive programs.\n\n"
        )

        cursor = await db.execute(
            "SELECT c.content, c.section_title, c.jurisdiction, c.trust_tier, "
            "d.title AS doc_title, d.source_url "
            "FROM chunks c "
            "JOIN document_versions dv ON c.doc_version_id = dv.id "
            "JOIN documents d ON dv.document_id = d.id "
            "WHERE d.status = 'active' "
            "ORDER BY c.trust_tier ASC, d.title ASC, c.chunk_index ASC"
        )
        chunks = await cursor.fetchall()

        TIER_LABELS = {
            1: "Local Code",
            2: "Authoritative (State/County)",
            3: "Fire Science Research",
            4: "Community/Educational",
            5: "Grants & Incentives",
            6: "Educational",
        }

        current_doc = ""
        for ch in chunks:
            r = dict(ch)
            doc_key = r["doc_title"] or "Untitled"
            if doc_key != current_doc:
                current_doc = doc_key
                tier = TIER_LABELS.get(r["trust_tier"], f"Tier {r['trust_tier']}")
                parts.append(f"### {doc_key}\n\n")
                meta = [f"Trust tier: {tier}"]
                if r["jurisdiction"]:
                    meta.append(f"Jurisdiction: {r['jurisdiction']}")
                if r["source_url"]:
                    meta.append(f"Source: {r['source_url']}")
                parts.append(" · ".join(meta) + "\n\n")

            if r["section_title"]:
                parts.append(f"**{r['section_title']}**\n\n")
            parts.append(f"{r['content']}\n\n")

    return PlainTextResponse(
        content="".join(parts),
        media_type="text/markdown",
    )
