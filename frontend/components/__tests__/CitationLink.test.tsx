/**
 * Tests for components/CitationLink.tsx
 *
 * Covers:
 * - Color/badge class assignment per citation_type
 * - Collapsed-by-default behavior (text hidden until clicked)
 * - Expand/collapse toggle via click
 * - 'url' prop renders an anchor tag when expanded
 * - Missing 'url' prop renders no anchor (even when expanded)
 * - Empty citation string renders null (nothing mounted)
 *
 * Does NOT test:
 * - Icon emoji rendering (emoji rendering is environment-dependent)
 * - Keyboard accessibility (not yet implemented)
 * - External link navigation (jsdom doesn't navigate)
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import CitationLink from "../CitationLink";

// ── Color class assertions ────────────────────────────────────────────────────

describe("citation_type color classes", () => {
  it("renders blue classes for the default type (retrieved_document)", () => {
    /**
     * retrieved_document is the default type. It should use blue Tailwind
     * classes to distinguish corpus documents from science evidence and data.
     */
    const { container } = render(
      <CitationLink citation="Some document excerpt" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain("text-blue-700");
    expect(wrapper?.className).toContain("bg-blue-50");
  });

  it("renders purple classes for fire_science_evidence", () => {
    /**
     * Fire science evidence uses purple to distinguish peer-reviewed studies
     * from agency documents, reinforcing source credibility.
     */
    const { container } = render(
      <CitationLink citation="Study excerpt" type="fire_science_evidence" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain("text-purple-700");
    expect(wrapper?.className).toContain("bg-purple-50");
  });

  it("renders green classes for structured_data", () => {
    /**
     * Structured data (plant records, zone actions from DB) uses green to
     * indicate machine-generated, structured citations vs prose documents.
     */
    const { container } = render(
      <CitationLink citation="Plant record excerpt" type="structured_data" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain("text-green-700");
    expect(wrapper?.className).toContain("bg-green-50");
  });
});

// ── Expand / collapse behavior ────────────────────────────────────────────────

describe("expand/collapse", () => {
  it("citation text is NOT visible before interaction (collapsed by default)", () => {
    /**
     * The component starts collapsed. Citation text should not be rendered
     * in the DOM (or visible) until the user clicks the toggle button.
     * This keeps the chat interface clean for long citation lists.
     */
    render(<CitationLink citation="Secret citation text" type="retrieved_document" />);
    expect(screen.queryByText("Secret citation text")).not.toBeInTheDocument();
  });

  it("citation text IS visible after clicking the toggle", async () => {
    /**
     * A single click on the header button must expand the component and
     * render the citation text in the document.
     */
    const user = userEvent.setup();
    render(<CitationLink citation="Revealed citation text" type="retrieved_document" />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(screen.getByText("Revealed citation text")).toBeInTheDocument();
  });

  it("citation text is hidden again after a second click (collapse toggle)", async () => {
    /**
     * Two clicks: expand then collapse. The citation text must be removed
     * from the DOM on the second click.
     */
    const user = userEvent.setup();
    render(<CitationLink citation="Toggle citation text" type="retrieved_document" />);

    const button = screen.getByRole("button");
    await user.click(button);
    expect(screen.getByText("Toggle citation text")).toBeInTheDocument();

    await user.click(button);
    expect(screen.queryByText("Toggle citation text")).not.toBeInTheDocument();
  });
});

// ── Source URL link ───────────────────────────────────────────────────────────

describe("source URL", () => {
  it("renders an anchor tag when url prop is provided and component is expanded", async () => {
    /**
     * When a source URL is available and the component is expanded, a
     * 'View source →' link must be present and point to the correct URL
     * with target='_blank' for external navigation.
     */
    const user = userEvent.setup();
    render(
      <CitationLink
        citation="Cited content"
        type="retrieved_document"
        url="https://example.com/source"
      />
    );

    const button = screen.getByRole("button");
    await user.click(button);

    const link = screen.getByRole("link", { name: /view source/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com/source");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does NOT render an anchor tag when url prop is not provided (even when expanded)", async () => {
    /**
     * Many corpus chunks do not have a source URL (e.g., PDF pages without
     * a canonical URL). No broken link should be rendered in this case.
     */
    const user = userEvent.setup();
    render(<CitationLink citation="No URL citation" type="retrieved_document" />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

// ── Empty citation guard ──────────────────────────────────────────────────────

it("renders nothing when citation prop is an empty string", () => {
  /**
   * The component returns null for empty citations. This prevents
   * rendering empty, clickable citation badges in the chat UI.
   */
  const { container } = render(<CitationLink citation="" />);
  expect(container.firstChild).toBeNull();
});
