import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { api, call, isApiError } from "@/shared/api";
import { errorLabel } from "@/shared/labels";
import { QueryState } from "@/shared/QueryState";
import { rubriqueOf, topLevelKey } from "@/shared/rubriques";
import { canContribute } from "@/shared/session";
import { server } from "@/test/setup";

describe("code partagé", () => {
  it("convertit une erreur réseau en message lisible", async () => {
    server.use(http.get("/api/parcours", () => HttpResponse.error()));
    const error: unknown = await call(api.GET("/api/parcours")).catch((e: unknown) => e);
    expect(isApiError(error) && error.status).toBe(0);
  });

  it("garde la référence de corrélation d'une réponse en erreur sans corps", async () => {
    server.use(
      http.get(
        "/api/parcours",
        () => new HttpResponse(null, { status: 502, headers: { "X-Correlation-Id": "c-1" } }),
      ),
    );
    const error: unknown = await call(api.GET("/api/parcours")).catch((e: unknown) => e);
    expect(isApiError(error) && error.correlationId).toBe("c-1");
  });

  it("affiche une erreur inattendue sans référence", () => {
    render(
      <QueryState
        query={{ data: undefined, error: new Error("x"), isPending: false, refetch: () => null }}
      >
        {() => null}
      </QueryState>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Une erreur inattendue est survenue.");
  });

  it("rattache les erreurs à leur rubrique et traduit les codes", () => {
    expect(topLevelKey("/retention/duration")).toBe("retention");
    expect(rubriqueOf("/formats/0").label).toBe("Stockage");
    expect(rubriqueOf("/inconnu").label).toBe("Identité");
    expect(errorLabel("REQUIRED")).toBe("obligatoire");
    expect(errorLabel("AUTRE")).toBe("AUTRE");
  });

  it("réserve la contribution aux contributeurs du parcours", () => {
    const session = { user: "u", roles: ["catalogue-contributeur" as const], parcours: ["eer"] };
    expect(canContribute(session)).toBe(true);
    expect(canContribute(session, "eer")).toBe(true);
    expect(canContribute(session, "credit-immo")).toBe(false);
    expect(canContribute(undefined)).toBe(false);
  });
});
