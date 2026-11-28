import { http, HttpResponse } from "msw";
import { CatalogueStub } from "@/mocks/catalogue-handlers";
import { CIN, CONTRIBUTOR, initialDocuments } from "@/mocks/data";
import type { Session } from "@/shared/session";
import type { DocumentView, Party } from "@/shared/types";

const CORRELATION = { "X-Correlation-Id": "demo-correlation-id" };
const PDF = "%PDF-1.7 démonstration";
/** Vignette factice (PNG d'un pixel). */
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

/** Point d'envoi de la quarantaine : une autre origine que le BFF, comme l'ECS (AUD-20261120-317). */
export const UPLOAD_URL = "https://stockage.example.test/quarantaine/objet";

const UPLOAD_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT",
  "Access-Control-Allow-Headers": "*",
};

interface Revision {
  number: number;
  metadata: Record<string, unknown>;
  reason: string | null;
  author: string;
  revisedAt: string;
}

function problem(status: number, detail: string, errors?: { field: string; code: string }[]) {
  return HttpResponse.json(
    { type: `https://errors.sijil/${String(status)}`, title: "Refus", status, detail, errors },
    { status, headers: { "Content-Type": "application/problem+json", ...CORRELATION } },
  );
}

/**
 * Bouchon de `admin-channel` (`contracts/admin-channel.yaml`) : documents, finalité exigée pour un autre
 * parcours, dépôt avec envoi direct et quarantaine simulée (admis au deuxième suivi), versions,
 * métadonnées, suppression logique et restauration.
 */
export class SijilStub extends CatalogueStub {
  override session: Session = CONTRIBUTOR;
  documents: DocumentView[] = initialDocuments();
  revisions: Record<string, Revision[]> = {};
  pending: Record<string, number> = {};
  deleted: string[] = [];

  override reset() {
    Object.assign(this, new SijilStub());
  }

  override handlers() {
    return [
      http.get("/api/session", () => HttpResponse.json(this.session)),
      ...super.handlers(),
      http.post("/api/completeness-evaluations", async ({ request }) =>
        HttpResponse.json(completeness((await request.json()) as CompletenessRequest)),
      ),
      http.get("/api/document-types", () =>
        HttpResponse.json({ items: [{ code: "CIN", label: CIN.definition.labels?.fr }] }),
      ),
      http.get("/api/document-types/:code", ({ params }) =>
        params["code"] === "CIN" ? HttpResponse.json(CIN) : problem(404, "Type inconnu."),
      ),
      http.get("/api/documents", ({ request }) => {
        const url = new URL(request.url);
        const party = url.searchParams.get("partyId");
        const items = this.visible().filter((d) => d.parties.some((p) => p.id === party));
        return HttpResponse.json({ items, page: { size: 20, hasMore: false } });
      }),
      http.get("/api/documents/:id", ({ params, request }) =>
        this.read(String(params["id"]), request, (d) =>
          HttpResponse.json(d, { headers: { ETag: `"v${String(this.revision(d.id))}"` } }),
        ),
      ),
      http.get("/api/documents/:id/versions", ({ params, request }) =>
        this.read(String(params["id"]), request, (d) =>
          HttpResponse.json({
            items: [
              {
                number: d.currentVersion,
                receivedAt: d.createdAt,
                status: "ACTIF",
                current: true,
                mediaType: d.content.mediaType,
                size: d.content.size,
                sha256: d.content.sha256,
              },
            ],
          }),
        ),
      ),
      http.get("/api/documents/:id/metadata-revisions", ({ params, request }) =>
        this.read(String(params["id"]), request, (d) =>
          HttpResponse.json({ items: this.revisionsOf(d) }),
        ),
      ),
      http.get("/api/documents/:id/usages", ({ params, request }) =>
        this.read(String(params["id"]), request, () => HttpResponse.json({ items: [] })),
      ),
      http.get("/api/documents/:id/preview", ({ params, request }) =>
        this.read(
          String(params["id"]),
          request,
          () => new HttpResponse(PDF, { headers: { "Content-Type": "application/pdf" } }),
        ),
      ),
      http.get("/api/search", ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").toLowerCase();
        const party = url.searchParams.get("partyId");
        const items = this.visible()
          .filter((d) => d.parties.some((p) => p.id === party))
          .filter((d) => JSON.stringify(d.metadata).toLowerCase().includes(q) || q === "carte")
          .map((d) => ({
            id: `v360-${d.id}`,
            type: { code: d.documentType, label: "Carte d'identité nationale" },
            createdAt: d.createdAt,
            sensitivity: d.sensitivity,
            source: { system: "SIJIL", sijilId: d.id },
          }));
        return HttpResponse.json({ items, page: { size: 20, hasMore: false } });
      }),
      http.get("/api/documents/:id/thumbnail", ({ params }) =>
        this.find(String(params["id"]))
          ? new HttpResponse(PNG, { headers: { "Content-Type": "image/png" } })
          : new HttpResponse(null, { status: 404 }),
      ),
      http.get("/api/documents/:id/reception", ({ params }) =>
        this.reception(String(params["id"])),
      ),
      http.post("/api/upload-sessions", () =>
        HttpResponse.json(
          {
            id: crypto.randomUUID(),
            upload: { method: "PUT", url: UPLOAD_URL, headers: {} },
          },
          { status: 201 },
        ),
      ),
      // CORS du bucket de quarantaine, à configurer aussi sur l'ECS (B-021).
      http.options(UPLOAD_URL, () => new HttpResponse(null, { status: 204, headers: UPLOAD_CORS })),
      http.put(UPLOAD_URL, () => new HttpResponse(null, { status: 200, headers: UPLOAD_CORS })),
      http.post("/api/documents", async ({ request }) =>
        this.create(
          (await request.json()) as { parties: Party[]; metadata: Record<string, unknown> },
        ),
      ),
      http.post("/api/documents/:id/versions", ({ params }) => {
        const d = this.find(String(params["id"]));
        if (!d) return problem(404, "Document inconnu.");
        d.currentVersion += 1;
        return HttpResponse.json(
          { documentId: d.id, version: d.currentVersion, status: "EN_QUARANTAINE" },
          { status: 202 },
        );
      }),
      http.patch("/api/documents/:id", async ({ params, request }) =>
        this.patch(String(params["id"]), request.headers.get("If-Match"), await request.json()),
      ),
      http.delete("/api/documents/:id", ({ params }) => {
        const id = String(params["id"]);
        this.deleted.push(id);
        return HttpResponse.json({
          documentId: id,
          status: "SUPPRIME_LOGIQUE",
          revision: this.revision(id) + 1,
        });
      }),
      http.post("/api/documents/:id/restorations", ({ params }) => {
        const id = String(params["id"]);
        this.deleted = this.deleted.filter((d) => d !== id);
        return HttpResponse.json({
          documentId: id,
          status: "ACTIF",
          revision: this.revision(id) + 2,
        });
      }),
    ];
  }

  private visible() {
    return this.documents.filter((d) => !this.deleted.includes(d.id) && !(d.id in this.pending));
  }

  private find(id: string) {
    return this.visible().find((d) => d.id === id);
  }

  private revision(id: string) {
    return this.revisions[id]?.length ?? 1;
  }

  private revisionsOf(d: DocumentView): Revision[] {
    return (
      this.revisions[d.id] ?? [
        { number: 1, metadata: d.metadata, reason: null, author: "T00002", revisedAt: d.createdAt },
      ]
    );
  }

  private read(id: string, request: Request, ok: (d: DocumentView) => Response) {
    const d = this.find(id);
    if (!d) return problem(404, "Document inconnu.");
    if (!this.session.parcours.includes(d.parcours) && !request.headers.get("X-Access-Purpose")) {
      return problem(
        403,
        "Finalité (X-Access-Purpose) obligatoire pour un document d'un autre parcours.",
      );
    }
    return ok(d);
  }

  private reception(id: string) {
    const polls = this.pending[id];
    if (polls === undefined) {
      const d = this.find(id);
      return d
        ? HttpResponse.json({
            id,
            status: "ACTIF",
            lastVersion: 1,
            pendingVersion: false,
            revision: 2,
          })
        : problem(404, "Document inconnu.");
    }
    if (polls >= 1) {
      // Contrôle de quarantaine terminé : le document devient actif.
      Reflect.deleteProperty(this.pending, id);
      return HttpResponse.json({
        id,
        status: "ACTIF",
        lastVersion: 1,
        pendingVersion: false,
        revision: 2,
      });
    }
    this.pending[id] = polls + 1;
    return HttpResponse.json({
      id,
      status: "EN_QUARANTAINE",
      lastVersion: 1,
      pendingVersion: false,
      revision: 1,
    });
  }

  private create(body: { parties: Party[]; metadata: Record<string, unknown> }) {
    if (typeof body.metadata["numero"] !== "string") {
      return problem(422, "Métadonnées invalides.", [
        { field: "metadata/numero", code: "REQUIRED" },
      ]);
    }
    const id = crypto.randomUUID();
    this.documents.push({
      id,
      documentType: "CIN",
      typeVersion: 2,
      parcours: this.session.parcours[0] ?? "eer",
      status: "ACTIF",
      sensitivity: "SENSIBLE",
      currentVersion: 1,
      createdAt: new Date().toISOString(),
      parties: body.parties,
      metadata: body.metadata,
      content: { mediaType: "application/pdf", size: 1024, sha256: "0".repeat(64) },
    });
    this.pending[id] = 0;
    return HttpResponse.json(
      { id, status: "EN_QUARANTAINE", documentType: "CIN", typeVersion: 2, version: 1 },
      { status: 202 },
    );
  }

  private patch(id: string, ifMatch: string | null, body: unknown) {
    const d = this.find(id);
    if (!d) return problem(404, "Document inconnu.");
    if (ifMatch !== `"v${String(this.revision(id))}"`) return problem(412, "Révision périmée.");
    const { metadata, reason } = body as { metadata: Record<string, unknown>; reason: string };
    const revisions = this.revisionsOf(d);
    d.metadata = { ...d.metadata, ...metadata };
    this.revisions[id] = [
      ...revisions,
      {
        number: revisions.length + 1,
        metadata: d.metadata,
        reason,
        author: this.session.user,
        revisedAt: new Date().toISOString(),
      },
    ];
    return HttpResponse.json({
      documentId: id,
      metadataRevision: revisions.length + 1,
      revision: this.revision(id),
    });
  }
}

type CompletenessRequest = import("@/features/completeness/completeness").CompletenessRequest;
type CompletenessResult = import("@/features/completeness/completeness").CompletenessResult;

/**
 * Calcul de démonstration : l'identité du titulaire P0012345 est satisfaite (CIN valide), toute
 * autre partie manque sa pièce ; une date après 2031 rend la CIN expirée.
 */
function completeness(request: CompletenessRequest): CompletenessResult {
  const date = request.evaluationDate ?? "2026-11-22";
  const parties = request.parties.map((party) => {
    const known = party.externalId === "P0012345";
    const state: CompletenessResult["requirements"][number]["parties"][number]["state"] = !known
      ? "MANQUANTE"
      : date > "2031-03-10"
        ? "EXPIREE"
        : "SATISFAITE";
    return {
      party,
      state,
      required: 1,
      candidates: known
        ? [
            {
              id: "doc-cin-1",
              type: "CIN",
              source: "FILENET",
              status: "VALIDE",
              createdAt: "2025-03-12T03:41:00Z",
              expiresAt: "2031-03-10",
            },
          ]
        : [],
    };
  });
  return {
    requirementSet: request.requirementSet ?? "SIMULATION",
    version: request.requirementSet ? 1 : 0,
    evaluationDate: date,
    complete: parties.every((p) => p.state === "SATISFAITE"),
    partial: false,
    hiddenByAccessPolicy: 0,
    requirements: [
      { id: "identite", label: "Pièce d'identité", anyOf: ["CIN", "PASSEPORT"], parties },
    ],
    toRequest: parties
      .filter((p) => p.state !== "SATISFAITE")
      .map((p) => ({
        requirementId: "identite",
        party: p.party,
        anyOf: ["CIN", "PASSEPORT"],
        state: p.state,
      })),
  };
}
