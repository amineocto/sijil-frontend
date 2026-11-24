import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DOMAIN_ADMIN, SESSION } from "@/mocks/catalogue-data";
import { renderAt, seriousViolations } from "@/test/render";
import { stub } from "@/test/setup";

describe("Partage 360 (ADR 0025)", () => {
  it("liste les types éligibles du parcours et leur partage, sans violation axe", async () => {
    stub.session = DOMAIN_ADMIN;
    const { container } = renderAt("/catalogue/partage");

    const table = await screen.findByRole("table", { name: "Partage des types du parcours eer" });
    const cin = within(table).getByRole("row", { name: /CIN/ });
    expect(within(cin).getByText("Partagé")).toBeVisible();
    expect(await within(cin).findByText("Carte d'identité nationale")).toBeVisible();
    expect(within(cin).getByText("Pièce d'identité du portefeuille")).toBeVisible();
    expect(within(table).getByRole("row", { name: /RIB/ })).toHaveTextContent("Non partagé");
    expect(screen.getByRole("link", { name: "Partage 360" })).toBeVisible();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("partage un type avec un motif, puis l'annonce", async () => {
    stub.session = DOMAIN_ADMIN;
    const user = userEvent.setup();
    renderAt("/catalogue/partage");

    await user.click(await screen.findByRole("button", { name: "Partager RIB" }));
    const form = screen.getByRole("form", { name: "Décision de partage pour RIB" });
    expect(within(form).getByLabelText("Motif (facultatif)")).toHaveFocus();
    await user.type(within(form).getByLabelText("Motif (facultatif)"), "Justificatif bancaire");
    await user.click(within(form).getByRole("button", { name: "Confirmer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("RIB est partagé");
    const rib = await screen.findByRole("row", { name: /RIB.*Justificatif bancaire/ });
    expect(within(rib).getByText("Partagé")).toBeVisible();
    expect(stub.sharing.find((s) => s.typeCode === "RIB")?.decidedBy).toBe("admin-domaine.demo");
  });

  it("est réservé à l'administration du domaine", async () => {
    stub.session = SESSION;
    renderAt("/catalogue/partage");
    expect(
      await screen.findByText("Partage réservé à l'administration du domaine"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Partage 360" })).not.toBeInTheDocument();
  });
});
