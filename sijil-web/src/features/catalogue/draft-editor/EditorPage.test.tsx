import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";
import { fieldOfPointer, toDefinition, toValues } from "@/features/catalogue/draft-editor/form";

function draftOf(code: string) {
  return stub.types.find((t) => t.code === code)?.versions[0];
}

describe("Éditeur de brouillon", () => {
  it("contrôle la forme de la définition avant d'enregistrer", async () => {
    let puts = 0;
    server.use(
      http.put("/api/types/:code/editor", () => {
        puts++;
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    renderAt("/catalogue/types/RIB/brouillon");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /Stockage/ }));
    const bucket = screen.getByRole("textbox", { name: /Emplacement de stockage/ });
    await user.clear(bucket);
    await user.type(bucket, "e");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(
      await screen.findByText(/Emplacement de stockage : Minuscules, chiffres et -/),
    ).toBeVisible();
    expect(puts).toBe(0);
  });

  it("dit qu'il n'y a pas de brouillon, au brouillon comme à la soumission", async () => {
    server.use(
      http.get("/api/types/:code/editor", () =>
        HttpResponse.json(
          { title: "Introuvable", status: 404, detail: "Aucun brouillon" },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    renderAt("/catalogue/types/RIB/brouillon");
    expect(await screen.findByText("Aucun brouillon en cours")).toBeVisible();
    expect(screen.getByRole("link", { name: "sa fiche" })).toHaveAttribute(
      "href",
      "/catalogue/types/RIB",
    );
    cleanup();
    renderAt("/catalogue/types/RIB/soumission");
    expect(await screen.findByText("Aucun brouillon en cours")).toBeVisible();
    expect(screen.getByRole("heading", { name: /Soumission du type RIB/ })).toBeVisible();
  });

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

  it("valide en ligne le libellé et compte l'erreur sur sa rubrique", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/types/RIB/brouillon");
    const label = await screen.findByLabelText(/Libellé français/);
    await user.clear(label);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("tab", { name: /Identité/ })).toHaveTextContent("1");
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

  it("n'offre ni JSON ni rendu PDF/A, et enregistre une rétention sans politique ni base légale", async () => {
    const user = userEvent.setup();
    renderAt("/catalogue/types/RIB/brouillon");
    await screen.findByLabelText(/Libellé français/);
    expect(screen.queryByRole("button", { name: /JSON/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/PDF\/A/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Rétention" }));
    const panel = screen.getByRole("tabpanel", { name: "Rétention" });
    expect(within(panel).getByLabelText(/Politique de rétention/)).not.toBeRequired();
    expect(within(panel).getByLabelText(/Base légale/)).not.toBeRequired();
    await user.selectOptions(within(panel).getByLabelText(/Point de départ/), "CREATION");
    await user.type(within(panel).getByLabelText("Durée de conservation : nombre"), "5");
    await user.selectOptions(within(panel).getByLabelText(/À l'échéance/), "NONE");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Brouillon enregistré");
    expect(draftOf("RIB")?.definition["retention"]).toEqual({
      startEvent: "CREATION",
      duration: "P5Y",
      onExpiry: "NONE",
    });
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
