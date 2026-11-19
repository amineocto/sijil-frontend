import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";
import { fieldOfPointer, toDefinition, toValues } from "@/features/draft-editor/form";

function draftOf(code: string) {
  return stub.types.find((t) => t.code === code)?.versions[0];
}

describe("Éditeur de brouillon", () => {
  it("enregistre le brouillon avec If-Match, sans violation axe", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/types/RIB/brouillon");
    const label = await screen.findByLabelText(/Libellé français/);
    expect(label).toHaveValue("Relevé d'identité bancaire");
    expect(await seriousViolations(container)).toEqual([]);

    await user.clear(label);
    await user.type(label, "RIB du client");
    await user.type(screen.getByLabelText("Famille"), "BANCAIRE");
    await user.selectOptions(screen.getByLabelText("Niveau de rattachement"), "COMPTE");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Brouillon enregistré");
    expect(draftOf("RIB")?.definition).toEqual({
      labels: { fr: "RIB du client" },
      family: "BANCAIRE",
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
    renderAt("/types/RIB/brouillon");
    const label = await screen.findByLabelText(/Libellé français/);
    await user.clear(label);
    await user.click(screen.getByRole("tab", { name: "Rétention" }));
    const retention = screen.getByLabelText("retention (JSON)");
    await user.type(retention, "{{ pas du json");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("JSON invalide")).toBeVisible();
    expect(screen.getByRole("tab", { name: /Rétention/ })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Identité/ })).toHaveTextContent("1");
    expect(draftOf("RIB")?.revision).toBe(0);
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
    renderAt("/types/RIB/brouillon");
    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("format incorrect")).toBeVisible();
    expect(screen.getByText("/inconnu : UNKNOWN")).toBeVisible();
  });

  it("signale une modification concurrente (412)", async () => {
    const user = userEvent.setup();
    renderAt("/types/RIB/brouillon");
    await screen.findByLabelText(/Libellé français/);
    const draft = draftOf("RIB");
    if (draft) draft.revision = 7;
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Le brouillon a été modifié entre-temps")).toBeVisible();
  });

  it("affiche l'aperçu du formulaire de métadonnées", async () => {
    const user = userEvent.setup();
    renderAt("/types/CIN/brouillon");
    await user.click(await screen.findByRole("tab", { name: "Métadonnées" }));
    const preview = screen.getByRole("group", { name: "Aperçu du formulaire généré" });
    expect(within(preview).getByLabelText(/Numéro/)).toBeDisabled();
    expect(within(preview).getByLabelText("Date d'expiration")).toHaveAttribute("type", "date");
    expect(screen.getByText("Préciser la base légale de la rétention.")).toBeVisible();
  });

  it("présente une version soumise en lecture seule", async () => {
    const draft = draftOf("RIB");
    if (draft) draft.status = "SOUMIS";
    renderAt("/types/RIB/brouillon");
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
