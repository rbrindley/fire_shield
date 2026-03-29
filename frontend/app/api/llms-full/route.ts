import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
  const lines: string[] = [
    "# Fire Shield — Full Content Dump",
    `> Generated: ${new Date().toISOString()}`,
    "> This file is intended for AI agent consumption. Content: fire-resistant plants + HIZ zone actions.",
    "",
    "---",
    "",
    "## Home Ignition Zone (HIZ) Framework",
    "",
    "Fire Shield uses a 5-layer HIZ model based on NFPA 1144 and IBHS research:",
    "- Layer 0 (The Structure): Roof, vents, eaves, gaps — highest ignition risk from embers",
    "- Layer 1 (0–5 ft): Immediate zone around house — no combustibles, noncombustible mulch",
    "- Layer 2 (5–30 ft): Lean, Clean, Green — fire-resistant plants, cleared dead vegetation",
    "- Layer 3 (30–100 ft): Tree spacing, ladder fuel removal",
    "- Layer 4 (100+ ft): Driveway access, address visibility",
    "",
  ];

  // Fetch zone actions
  try {
    const zonesRes = await fetch(`${API_URL}/api/zones/`, { cache: "no-store" });
    if (zonesRes.ok) {
      const zonesData = await zonesRes.json();
      const zones = zonesData.zones ?? zonesData ?? [];

      lines.push("## Zone Actions");
      lines.push("");

      for (const zone of zones) {
        lines.push(`### Layer ${zone.layer}: ${zone.layer_name}`);
        lines.push(zone.layer_description ?? "");
        lines.push("");

        for (const action of zone.actions ?? []) {
          lines.push(`#### ${action.rank_in_layer ?? ""}. ${action.action_title}`);
          lines.push(`**Why it matters:** ${action.why_it_matters}`);
          lines.push(`**Effort:** ${action.effort_level} | **Cost:** ${action.cost_estimate ?? "varies"} | **Time:** ${action.time_estimate ?? "varies"}`);
          lines.push(`**Priority score:** ${action.priority_score}`);
          if (action.evidence_citation) {
            lines.push(`**Citation:** ${action.evidence_citation}`);
          }
          lines.push("");
        }
      }
    }
  } catch {
    lines.push("_Zone actions unavailable_");
    lines.push("");
  }

  // Fetch plants
  try {
    const plantsRes = await fetch(
      `${API_URL}/api/plants/search?limit=200&exclude_noxious=true`,
      { cache: "no-store" }
    );
    if (plantsRes.ok) {
      const plantsData = await plantsRes.json();
      const plants = plantsData.plants ?? [];

      lines.push("---");
      lines.push("");
      lines.push("## Fire-Resistant Plant Database");
      lines.push(`> ${plants.length} plants from the Living with Fire database`);
      lines.push("");
      lines.push("| Common Name | Scientific Name | Type | Zone 0–5ft | Zone 5–30ft | Water | Native | Deer Resistant | Ashland Restricted |");
      lines.push("|---|---|---|---|---|---|---|---|---|");

      for (const p of plants) {
        lines.push(
          `| ${p.common_name} | ${p.scientific_name ?? ""} | ${p.plant_type ?? ""} | ${p.zone_0_5ft ? "✓" : ""} | ${p.zone_5_30ft ? "✓" : ""} | ${p.water_need ?? ""} | ${p.is_native ? "✓" : ""} | ${p.deer_resistant ? "✓" : ""} | ${p.ashland_restricted ? "⚠" : ""} |`
        );
      }
      lines.push("");
    }
  } catch {
    lines.push("_Plant data unavailable_");
    lines.push("");
  }

  const markdown = lines.join("\n");
  const tokenEstimate = Math.ceil(markdown.length / 4);

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "x-markdown-tokens": String(tokenEstimate),
      "Content-Signal": "ai-train=no, search=yes, ai-input=yes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
