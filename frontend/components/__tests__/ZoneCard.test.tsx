/**
 * Tests for components/ZoneCard.tsx
 *
 * Covers:
 * - Layer name and description rendered in header
 * - All action titles from layer.actions rendered
 * - Effort badge text per effort_level value
 * - is_seasonal_peak=true renders 'Now' badge on that action
 * - is_seasonal_peak=false renders no 'Now' badge
 * - currentSeason='summer' + layer 0 or 1 renders 'Fire Season Priority' badge
 * - currentSeason='summer' + layer 2 does NOT render 'Fire Season Priority' badge
 * - currentSeason='winter' renders no 'Fire Season Priority' badge on any layer
 * - neighborNote prop renders the neighbor impact section
 * - No neighborNote renders no neighbor impact section
 *
 * Does NOT test:
 * - CitationLink behavior (tested separately in CitationLink.test.tsx)
 * - Layer color classes (visual regression; use Storybook or screenshot tests)
 * - Mobile layout responsiveness
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ZoneCard from "../ZoneCard";

// ── Test data factories ───────────────────────────────────────────────────────

function makeAction(overrides: Partial<{
  id: string;
  layer: number;
  action_title: string;
  action_detail: string;
  why_it_matters: string;
  evidence_citation: string;
  effort_level: string;
  cost_estimate: string;
  time_estimate: string;
  is_seasonal_peak: boolean;
  effective_priority: number;
}> = {}) {
  return {
    id: "test-action-1",
    layer: 0,
    action_title: "Screen all vents",
    action_detail: "Use 1/8-inch mesh",
    why_it_matters: "Embers enter through vents",
    evidence_citation: "IBHS 2025",
    effort_level: "low",
    cost_estimate: "$15–50",
    time_estimate: "1–2 weekends",
    is_seasonal_peak: false,
    effective_priority: 0.98,
    ...overrides,
  };
}

function makeLayer(layer: number, actions = [makeAction({ layer })]) {
  return {
    layer,
    layer_name: `Layer ${layer} Name`,
    layer_description: `Layer ${layer} description text`,
    actions,
  };
}

// ── Header rendering ──────────────────────────────────────────────────────────

describe("layer header", () => {
  it("renders the layer name as a heading", () => {
    /**
     * The layer_name must appear as visible text in the card header.
     * This is the primary label users see when scanning zone cards.
     */
    render(<ZoneCard layer={makeLayer(0)} />);
    expect(screen.getByText("Layer 0 Name")).toBeInTheDocument();
  });

  it("renders the layer description", () => {
    /**
     * The layer_description provides context about what actions in this
     * layer address. It must appear below the layer name.
     */
    render(<ZoneCard layer={makeLayer(1)} />);
    expect(screen.getByText("Layer 1 description text")).toBeInTheDocument();
  });
});

// ── Action list rendering ─────────────────────────────────────────────────────

describe("action titles", () => {
  it("renders all action titles in the actions list", () => {
    /**
     * Every action title must appear in the DOM. Missing actions would
     * hide critical fire-prevention guidance from the user.
     */
    const layer = makeLayer(0, [
      makeAction({ action_title: "First action title" }),
      makeAction({ id: "a2", action_title: "Second action title" }),
      makeAction({ id: "a3", action_title: "Third action title" }),
    ]);
    render(<ZoneCard layer={layer} />);
    expect(screen.getByText("First action title")).toBeInTheDocument();
    expect(screen.getByText("Second action title")).toBeInTheDocument();
    expect(screen.getByText("Third action title")).toBeInTheDocument();
  });
});

// ── Effort badges ─────────────────────────────────────────────────────────────

describe("effort badges", () => {
  it("renders 'Free' for zero_cost effort level", () => {
    /**
     * zero_cost actions must display 'Free' — a clear call to action
     * for homeowners who are price-sensitive.
     */
    const layer = makeLayer(0, [makeAction({ effort_level: "zero_cost" })]);
    render(<ZoneCard layer={layer} />);
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("renders 'Low cost' for low effort level", () => {
    const layer = makeLayer(0, [makeAction({ effort_level: "low" })]);
    render(<ZoneCard layer={layer} />);
    expect(screen.getByText("Low cost")).toBeInTheDocument();
  });

  it("renders 'Moderate' for moderate effort level", () => {
    const layer = makeLayer(0, [makeAction({ effort_level: "moderate" })]);
    render(<ZoneCard layer={layer} />);
    expect(screen.getByText("Moderate")).toBeInTheDocument();
  });

  it("renders 'High effort' for high effort level", () => {
    const layer = makeLayer(0, [makeAction({ effort_level: "high" })]);
    render(<ZoneCard layer={layer} />);
    expect(screen.getByText("High effort")).toBeInTheDocument();
  });
});

// ── Seasonal peak badge ───────────────────────────────────────────────────────

describe("seasonal peak 'Now' badge", () => {
  it("shows 'Now' badge when is_seasonal_peak is true", () => {
    /**
     * Actions with is_seasonal_peak=true are boosted in the current month.
     * A 'Now' badge draws attention to time-sensitive actions.
     */
    const layer = makeLayer(0, [makeAction({ is_seasonal_peak: true })]);
    render(<ZoneCard layer={layer} />);
    expect(screen.getByText("Now")).toBeInTheDocument();
  });

  it("does NOT show 'Now' badge when is_seasonal_peak is false", () => {
    /**
     * Off-peak actions must not show the 'Now' badge to avoid creating
     * false urgency.
     */
    const layer = makeLayer(0, [makeAction({ is_seasonal_peak: false })]);
    render(<ZoneCard layer={layer} />);
    expect(screen.queryByText("Now")).not.toBeInTheDocument();
  });

  it("shows 'Now' only on the peak action when multiple actions are present", () => {
    /**
     * In a mixed list (some peak, some not), only peak actions get 'Now'.
     */
    const layer = makeLayer(0, [
      makeAction({ id: "a1", is_seasonal_peak: true }),
      makeAction({ id: "a2", is_seasonal_peak: false }),
    ]);
    render(<ZoneCard layer={layer} />);
    // Only one 'Now' badge should exist
    const nowBadges = screen.queryAllByText("Now");
    expect(nowBadges).toHaveLength(1);
  });
});

// ── Fire Season Priority badge ────────────────────────────────────────────────

describe("fire season priority badge", () => {
  it("renders badge on Layer 0 when currentSeason is summer", () => {
    /**
     * Layer 0 is the highest-priority layer during fire season.
     * The badge must appear to highlight urgency in June–September.
     */
    render(<ZoneCard layer={makeLayer(0)} currentSeason="summer" />);
    expect(screen.getByText(/fire season priority/i)).toBeInTheDocument();
  });

  it("renders badge on Layer 1 when currentSeason is summer", () => {
    /**
     * Layer 1 (0–5ft zone) also receives the fire season badge.
     * Both layers 0 and 1 are in the fire zone boost.
     */
    render(<ZoneCard layer={makeLayer(1)} currentSeason="summer" />);
    expect(screen.getByText(/fire season priority/i)).toBeInTheDocument();
  });

  it("does NOT render badge on Layer 2 even in summer", () => {
    /**
     * Fire season badge is only for layers 0 and 1. Layer 2 (5–30ft)
     * does not receive the badge to avoid diluting the urgency signal.
     */
    render(<ZoneCard layer={makeLayer(2)} currentSeason="summer" />);
    expect(screen.queryByText(/fire season priority/i)).not.toBeInTheDocument();
  });

  it("does NOT render badge in winter even on Layer 0", () => {
    /**
     * Outside fire season, the badge must not appear even on high-priority
     * layers. Off-season, different actions are prioritized.
     */
    render(<ZoneCard layer={makeLayer(0)} currentSeason="winter" />);
    expect(screen.queryByText(/fire season priority/i)).not.toBeInTheDocument();
  });

  it("does NOT render badge when currentSeason is undefined", () => {
    /**
     * Absence of currentSeason prop must not crash and must not show badge.
     * The prop is optional — the property overview may not pass it.
     */
    render(<ZoneCard layer={makeLayer(0)} />);
    expect(screen.queryByText(/fire season priority/i)).not.toBeInTheDocument();
  });
});

// ── Neighbor note ─────────────────────────────────────────────────────────────

describe("neighborNote", () => {
  it("renders neighbor note section when neighborNote is provided", () => {
    /**
     * Layer 2 cards show a neighbor interdependency note. The text must
     * appear in the card when the prop is passed.
     */
    render(
      <ZoneCard
        layer={makeLayer(2)}
        neighborNote="Your neighbors affect your defensible space."
      />
    );
    expect(
      screen.getByText("Your neighbors affect your defensible space.")
    ).toBeInTheDocument();
  });

  it("does NOT render neighbor note section when neighborNote is not provided", () => {
    /**
     * When neighborNote is omitted, no empty neighbor section should
     * appear — it would add visual noise with no content.
     */
    render(<ZoneCard layer={makeLayer(0)} />);
    expect(screen.queryByText(/neighbor impact/i)).not.toBeInTheDocument();
  });
});
