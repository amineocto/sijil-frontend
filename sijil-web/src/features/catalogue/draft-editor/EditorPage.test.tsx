import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";
import { fieldOfPointer, toDefinition, toValues } from "@/features/catalogue/draft-editor/form";

function draftOf(code: string) {
  return stub.types.find((t) => t.code === code)?.versions[0];
}

describe("Éditeur de brouillon", () => {
  it("enregistre le brouillon avec If-Match, sans violation axe", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/catalogue/types/RIB/brouillon");
    const label = await screen.findByLabelText(/Libellé français/);
    expect(label).toHaveValue("Relevé d'identité bancaire");
    expect(await seriousViolations(container)).toEqual([]);

    await user.clear(label);
    await user.type(label, "RIB du client");
    await user.selectOptions(screen.getByLabelText("Famille"), "COMPTE");
    await user.selectOptions(screen.getByLabelText("Niveau de rattachement"), "COMPTE");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Brouillon enregistré");
    expect(draftOf("RIB")?.definition).toEqual({
      labels: { fr: "RIB du client" },
      family: "COMPTE",
      level: "COMPTE",
    });

    // Second enregistrement : l'ETag renvoyé par le premier est utilisé (sinon 412).
    await user.type(screen.getByLabelText("Libellé anglais"), "Bank details");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(draftOf("RIB")?.revision).toBe(2);
    });
  });

  it("valide en ligne le libellé et le JSON des rubriques", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/types/RIB/brouillon");
    const label = await screen.findByLabelText(/Libellé français/);
    await user.clear(label);
    await user.click(screen.getByRole("tab", { name: "Rétention" }));
    await user.click(screen.getByRole("button", { name: "Modifier en JSON (avancé)" }));
    const retention = screen.getByLabelText("retention (JSON)");
    await user.type(retention, "{{ pas du json");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect((await screen.findAllByText("JSON invalide"))[0]).toBeVisible();
    expect(screen.getByRole("tab", { name: /Rétention/ })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Identité/ })).toHaveTextContent("1");
    expect(draftOf("RIB")?.revision).toBe(0);
  });

  it("renseigne la rétention par des champs, durée comprise, sans violation axe", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/catalogue/types/RIB/brouillon");
    await screen.findByLabelText(/Libellé français/);
    await user.click(screen.getByRole("tab", { name: "Rétention" }));
    const panel = screen.getByRole("tabpanel", { name: "Rétention" });

    await user.type(within(panel).getByLabelText(/Politique de rétention/), "kyc_10a");
    await user.selectOptions(within(panel).getByLabelText(/Point de départ/), "FIN_RELATION");
    await user.type(within(panel).getByLabelText("Durée de conservation : nombre"), "10");
    await user.selectOptions(within(panel).getByLabelText(/À l'échéance/), "NONE");
    await user.type(within(panel).getByLabelText(/Base légale/), "Loi 43-05");
    expect(await seriousViolations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Brouillon enregistré");
    expect(draftOf("RIB")?.definition["retention"]).toEqual({
      policy: "KYC_10A",
      startEvent: "FIN_RELATION",
      duration: "P10Y",
      onExpiry: "NONE",
      legalBasis: "Loi 43-05",
    });
  });

  it("ajoute une métadonnée du dictionnaire et la propose pour la validité", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/types/RIB/brouillon");
    await screen.findByLabelText(/Libellé français/);
    await user.click(screen.getByRole("tab", { name: "Métadonnées" }));
    const panel = screen.getByRole("tabpanel", { name: "Métadonnées" });

    await user.selectOptions(
      await within(panel).findByLabelText("Métadonnée du dictionnaire"),
      "dateExpiration",
    );
    await user.click(within(panel).getByRole("button", { name: "Ajouter" }));
    const field = within(panel).getByRole("listitem", { name: /Métadonnée 1 : Date d'expiration/ });
    await user.click(within(field).getByRole("switch", { name: "Obligatoire au dépôt" }));
    const preview = within(panel).getByRole("group", { name: "Aperçu du formulaire généré" });
    expect(within(preview).getByLabelText(/Date d'expiration/)).toHaveAttribute("type", "date");

    await user.click(screen.getByRole("tab", { name: "Validité" }));
    const validity = screen.getByRole("tabpanel", { name: "Validité" });
    await user.selectOptions(
      within(validity).getByLabelText("Expiration de la pièce"),
      "FROM_METADATA",
    );
    await user.selectOptions(
      within(validity).getByLabelText("Métadonnée qui porte la date d'expiration"),
      "dateExpiration",
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Brouillon enregistré");
    const definition = draftOf("RIB")?.definition;
    expect(definition?.["metadataSchema"]).toEqual({
      type: "object",
      required: ["dateExpiration"],
      properties: {
        dateExpiration: { type: "string", format: "date", title: "Date d'expiration" },
      },
    });
    expect(definition?.["validity"]).toEqual({
      expiresAt: "FROM_METADATA",
      field: "dateExpiration",
    });
  });

  it("garde le mode avancé tant que le JSON d'une rubrique est invalide", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/types/RIB/brouillon");
    await screen.findByLabelText(/Libellé français/);
    await user.click(screen.getByRole("tab", { name: "FileNet" }));
    const panel = screen.getByRole("tabpanel", { name: "FileNet" });
    await user.click(within(panel).getByRole("button", { name: "Modifier en JSON (avancé)" }));
    await user.type(within(panel).getByLabelText("filenet (JSON)"), "{{ cassé");

    expect(within(panel).getByRole("status")).toHaveTextContent("JSON invalide");
    expect(
      within(panel).queryByRole("button", { name: "Revenir aux champs" }),
    ).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText("Classe documentaire FileNet")).not.toBeInTheDocument();
  });

  it("affiche les erreurs du serveur sur le champ ou, à défaut, en liste", async () => {
    const user = userEvent.setup();
    server.use(
      http.put("/api/types/:code/editor", () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Définition invalide",
            status: 422,
            errors: [
              { field: "/family", code: "PATTERN" },
              { field: "/inconnu", code: "UNKNOWN" },
            ],
          },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    renderAt("/catalogue/types/RIB/brouillon");
    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("format incorrect")).toBeVisible();
    expect(screen.getByText("/inconnu : UNKNOWN")).toBeVisible();
  });

  it("signale une modification concurrente (412)", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/types/RIB/brouillon");
    await screen.findByLabelText(/Libellé français/);
    const draft = draftOf("RIB");
    if (draft) draft.revision = 7;
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Le brouillon a été modifié entre-temps")).toBeVisible();
  });

  it("affiche l'aperçu du formulaire de métadonnées", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/types/CIN/brouillon");
    await user.click(await screen.findByRole("tab", { name: "Métadonnées" }));
    const preview = screen.getByRole("group", { name: "Aperçu du formulaire généré" });
    expect(within(preview).getByLabelText(/Numéro/)).toBeDisabled();
    expect(within(preview).getByLabelText("Date d'expiration")).toHaveAttribute("type", "date");
    expect(screen.getByText("Préciser la base légale de la rétention.")).toBeVisible();
  });

  it("présente une version soumise en lecture seule", async () => {
    const draft = draftOf("RIB");
    if (draft) draft.status = "SOUMIS";
    renderAt("/catalogue/types/RIB/brouillon");
    expect(await screen.findByText("Version non modifiable")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("convertit définition et formulaire dans les deux sens", () => {
    const values = toValues({
      labels: { fr: "A", ar: "ب" },
      level: "INCONNU",
      sensitivity: "SENSIBLE",
      formats: ["application/pdf"],
    });
    expect(values.level).toBe("");
    expect(values.json["formats"]).toContain("application/pdf");
    expect(toDefinition(values)).toEqual({
      labels: { fr: "A", ar: "ب" },
      sensitivity: "SENSIBLE",
      formats: ["application/pdf"],
    });
    expect(fieldOfPointer("/labels/fr")).toBe("labelFr");
    expect(fieldOfPointer("/retention/duration")).toBe("json.retention");
    expect(fieldOfPointer("/autre")).toBeUndefined();
  });
});
