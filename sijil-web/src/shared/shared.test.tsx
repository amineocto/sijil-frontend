import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { accessHeaders } from "@/shared/access";
import { api, call, callWithETag, isApiError } from "@/shared/api";
import { formatSize, statusLabel } from "@/shared/labels";
import {
  displayValue,
  fieldsOf,
  formatValue,
  humanize,
  toMetadata,
  toValues,
} from "@/shared/metadata";
import { QueryState } from "@/shared/QueryState";
import { canContribute } from "@/shared/session";
import { CIN } from "@/mocks/data";
import { server } from "@/test/setup";

describe("code partagé", () => {
  it("convertit une erreur réseau en message lisible", async () => {
    server.use(http.get("/api/session", () => HttpResponse.error()));
    const error: unknown = await call(api.GET("/api/session")).catch((e: unknown) => e);
    expect(isApiError(error) && error.status).toBe(0);
  });

  it("rend l'ETag avec les données", async () => {
    server.use(
      http.get("/api/session", () =>
        HttpResponse.json({ user: "u", roles: [] }, { headers: { ETag: '"v3"' } }),
      ),
    );
    const { etag } = await callWithETag(api.GET("/api/session"));
    expect(etag).toBe('"v3"');
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

  it("relaie finalité et motif en en-têtes, sans valeur vide", () => {
    expect(accessHeaders({})).toEqual({});
    expect(accessHeaders({ purpose: " Contrôle ", breakGlassReason: "  " })).toEqual({
      "X-Access-Purpose": "Contrôle",
    });
    expect(accessHeaders({ breakGlassReason: "Litige" })).toEqual({
      "X-Break-Glass-Reason": "Litige",
    });
  });

  it("génère les champs depuis le schéma et type les valeurs", () => {
    const fields = fieldsOf(CIN.definition.metadataSchema);
    expect(fields.map((f) => [f.name, f.kind, f.required])).toEqual([
      ["numero", "text", true],
      ["dateExpiration", "date", false],
      ["nationalite", "choice", false],
      ["pages", "number", false],
      ["recto", "boolean", false],
    ]);
    expect(
      toMetadata(fields, { numero: " AB1 ", pages: "2", recto: "true", dateExpiration: "" }),
    ).toEqual({ numero: "AB1", pages: 2, recto: true });
    expect(fieldsOf(undefined)).toEqual([]);
    expect(toValues({ a: 1, b: null, c: { x: 1 } })).toEqual({ a: "1", b: "", c: '{"x":1}' });
    expect(formatValue(undefined)).toBe("");
  });

  it("rend lisibles les noms de champ sans libellé et les dates ISO", () => {
    expect(humanize("dateExpiration")).toBe("Date expiration");
    expect(humanize("numero_titre")).toBe("Numero titre");
    expect(displayValue("2030-06-30")).toBe("30/06/2030");
    expect(displayValue("AB123456")).toBe("AB123456");
    expect(displayValue(1200.5)).toBe("1200.5");
  });

  it("formate tailles et états", () => {
    expect(formatSize(12)).toBe("12 o");
    expect(formatSize(2048)).toBe("2 Ko");
    expect(formatSize(3 * 1024 * 1024)).toBe("3.0 Mo");
    expect(statusLabel("ACTIF")).toBe("Actif");
    expect(statusLabel("INCONNU")).toBe("INCONNU");
  });

  it("réserve les modifications aux contributeurs du parcours propriétaire", () => {
    const session = { user: "u", parcours: ["eer"], roles: ["sijil-contributeur" as const] };
    expect(canContribute(session)).toBe(true);
    expect(canContribute(session, "eer")).toBe(true);
    expect(canContribute(session, "credit-immo")).toBe(false);
    expect(canContribute({ user: "l", parcours: [], roles: ["sijil-lecteur"] })).toBe(false);
    expect(canContribute(undefined)).toBe(false);
  });
});
