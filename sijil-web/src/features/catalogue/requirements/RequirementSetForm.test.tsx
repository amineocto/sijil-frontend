import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleaned,
  idOf,
  problemsOf,
  RequirementSetForm,
  type Definition,
} from "@/features/catalogue/requirements/RequirementSetForm";
import { renderAt } from "@/test/render";
import { server } from "@/test/setup";

function Harness({ initial, onValue }: { initial: Definition; onValue: (d: Definition) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <RequirementSetForm
      value={value}
      readOnly={false}
      showErrors
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

function renderForm(initial: Definition) {
  let last = initial;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness
        initial={initial}
        onValue={(d) => {
          last = d;
        }}
      />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), value: () => last };
}

const IDENTITY: Definition["requirements"][number] = {
  id: "identite",
  label: "Identité",
  anyOf: ["CIN"],
  freshness: "VALID_ON_DATE",
};
const ONE: Definition = { label: "Jeu de test", requirements: [IDENTITY] };

describe("Formulaire d'un jeu d'exigences", () => {
  it("tire un identifiant du libellé", () => {
    expect(idOf("Pièce d'identité")).toBe("piece-d-identite");
    expect(idOf("3 bulletins")).toBe("e-3-bulletins");
    expect(idOf("!!!")).toBe("");
  });

  it("signale les identifiants invalides ou en double et les rôles vides", () => {
    expect(
      problemsOf({
        label: "ab",
        requirements: [
          { id: "a", anyOf: ["CIN"], freshness: "VALID_ON_DATE", for: { roles: [] } },
          { id: "a", anyOf: [], freshness: "VALID_ON_DATE" },
          { id: "1x", anyOf: ["CIN"], freshness: "VALID_ON_DATE" },
        ],
      }),
    ).toEqual({
      label: "Au moins 3 caractères",
      "0.for": "Choisissez au moins un rôle",
      "1.id": "Déjà utilisé par une autre exigence",
      "1.anyOf": "Choisissez au moins un type",
      "2.id": "Une minuscule puis lettres, chiffres, - ou _",
    });
    expect(problemsOf({ label: "Jeu vide", requirements: [] })).toEqual({
      requirements: "Ajoutez au moins une exigence",
    });
  });

  it("retire les conditions restées vides avant l'envoi", () => {
    expect(
      cleaned({
        label: "  Jeu  ",
        requirements: [
          { id: "a", anyOf: ["CIN"], freshness: "VALID_ON_DATE", when: { segment: [] } },
          { id: "b", anyOf: ["CIN"], freshness: "VALID_ON_DATE", when: { segment: "PRO" } },
        ],
      }),
    ).toEqual({
      label: "Jeu",
      requirements: [
        { id: "a", anyOf: ["CIN"], freshness: "VALID_ON_DATE" },
        { id: "b", anyOf: ["CIN"], freshness: "VALID_ON_DATE", when: { segment: "PRO" } },
      ],
    });
  });

  it("règle les parties, la confiance, la réutilisation et les conditions", async () => {
    const { user, value } = renderForm({
      ...ONE,
      requirements: [{ ...IDENTITY, when: { canal: ["AGENCE", 2] } }],
    });
    const card = screen.getByRole("region", { name: "Identité" });

    await user.selectOptions(within(card).getByLabelText("Parties concernées"), "ROLES");
    await user.click(within(card).getByRole("checkbox", { name: "Garant" }));
    expect(value().requirements[0]?.for).toEqual({ roles: ["TITULAIRE", "GARANT"] });
    await user.click(within(card).getByRole("checkbox", { name: "Titulaire" }));
    await user.click(within(card).getByRole("checkbox", { name: "Garant" }));
    expect(within(card).getByText("Choisissez au moins un rôle")).toBeVisible();

    await user.selectOptions(within(card).getByLabelText("Parties concernées"), "LEVEL");
    await user.selectOptions(within(card).getByLabelText("Niveau"), "COMPTE");
    expect(value().requirements[0]?.for).toEqual({ level: "COMPTE" });
    await user.selectOptions(within(card).getByLabelText("Parties concernées"), "ALL");
    expect(value().requirements[0]?.for).toBeUndefined();

    await user.clear(within(card).getByLabelText(/Nombre de pièces/));
    await user.type(within(card).getByLabelText(/Nombre de pièces/), "3");
    await user.selectOptions(
      within(card).getByLabelText("Confiance minimale"),
      "SOURCE_OFFICIELLE",
    );
    await user.click(within(card).getByRole("switch", { name: /déjà connue/ }));
    expect(value().requirements[0]).toMatchObject({
      count: 3,
      minAssurance: "SOURCE_OFFICIELLE",
      reusable: false,
    });

    // Une valeur inchangée garde son type d'origine (2 reste un nombre).
    await user.click(within(card).getByRole("button", { name: "Retirer AGENCE" }));
    expect(value().requirements[0]?.when).toEqual({ canal: 2 });
    await user.type(within(card).getByLabelText(/Nouvelle condition/), "segment");
    await user.click(within(card).getByRole("button", { name: "Ajouter la condition" }));
    await user.type(within(card).getByLabelText(/Quand « segment » vaut/), "PRO{Enter}");
    expect(value().requirements[0]?.when).toEqual({ canal: 2, segment: "PRO" });
    await user.click(within(card).getByRole("button", { name: "Retirer 2" }));
    expect(value().requirements[0]?.when).toEqual({ segment: "PRO" });

    const accepted = within(card).getByRole("list", { name: "Types acceptés" });
    await user.click(within(accepted).getByRole("button", { name: /^Retirer/ }));
    expect(within(card).getByText("Choisissez au moins un type")).toBeVisible();
    await user.click(within(card).getByRole("button", { name: "Supprimer Identité" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ajoutez au moins une exigence");
  });

  it("dit les erreurs du serveur dans les mots du formulaire", async () => {
    server.use(
      http.post("/api/requirement-sets", () =>
        HttpResponse.json(
          {
            title: "Définition invalide",
            status: 422,
            detail: "Définition invalide",
            errors: [
              { field: "/requirements/0/anyOf", code: "UNKNOWN_TYPE" },
              { field: "/label", code: "TOO_SHORT" },
              { field: "", code: "INVALID" },
            ],
          },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAt("/catalogue/exigences/nouveau");
    await user.type(await screen.findByLabelText(/Code du jeu/), "pret_auto");
    await user.type(screen.getByLabelText(/Libellé du jeu/), "Prêt automobile");
    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    const refused = await screen.findByText("Enregistrement refusé");
    const notice = refused.closest("[role]") ?? refused.parentElement;
    expect(notice).toHaveTextContent("Exigence 1, types acceptés : UNKNOWN_TYPE");
    expect(notice).toHaveTextContent("libellé : TOO_SHORT");
    expect(notice).toHaveTextContent("Définition : INVALID");
  });
});
