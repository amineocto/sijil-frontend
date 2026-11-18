import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { ApiError } from "@/http/ApiError";

async function expectNoAxeViolations(container: HTMLElement) {
  // Le contraste ne se mesure pas sous jsdom (pas de rendu) : il est garanti par les jetons du thème.
  const results = await axe.run(container, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  });
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

describe("LoadingState", () => {
  it("announces loading politely", async () => {
    const { container } = render(<LoadingState />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Chargement…");
    expect(status).toHaveAttribute("aria-live", "polite");
    await expectNoAxeViolations(container);
  });

  it("accepts a translated label", () => {
    render(<LoadingState label="جار التحميل" />);
    expect(screen.getByRole("status")).toHaveTextContent("جار التحميل");
  });
});

describe("EmptyState", () => {
  it("shows title, description and action", async () => {
    const { container } = render(
      <EmptyState
        title="Aucun document"
        description="Ce client n'a encore aucun document."
        action={<button type="button">Déposer un document</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Aucun document" })).toBeInTheDocument();
    expect(screen.getByText("Ce client n'a encore aucun document.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Déposer un document" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("has a default title", () => {
    render(<EmptyState />);
    expect(screen.getByRole("heading", { name: "Aucun élément" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  const error = new ApiError(500, { detail: "Service indisponible.", correlationId: "c1f6-0001" });

  it("shows the message and the correlation id", async () => {
    const { container } = render(<ErrorState error={error} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Service indisponible.");
    expect(alert).toHaveTextContent("c1f6-0001");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("offers a retry when asked", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={error} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the reference when there is none", () => {
    render(<ErrorState error={{ message: "Hors ligne", correlationId: undefined }} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent("Référence");
  });
});
