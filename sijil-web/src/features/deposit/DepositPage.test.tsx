import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { READER } from "@/mocks/data";
import { renderAt, seriousViolations } from "@/test/render";
import { server, stub } from "@/test/setup";

async function chooseCin(user: ReturnType<typeof userEvent.setup>) {
  const select = await screen.findByRole("combobox", { name: /Type de document/ });
  await user.selectOptions(
    select,
    await screen.findByRole("option", { name: "Carte d'identité nationale" }),
  );
}

async function fillAndSend(user: ReturnType<typeof userEvent.setup>, numero: string) {
  if (numero) await user.type(await screen.findByRole("textbox", { name: /Numéro/ }), numero);
  await user.type(screen.getByRole("textbox", { name: /Identifiant du titulaire/ }), "CLI-42");
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("champ fichier absent");
  await user.upload(input, new File(["%PDF-1.7 cin"], "cin.pdf", { type: "application/pdf" }));
  await user.click(screen.getByRole("button", { name: "Déposer" }));
}

describe("Dépôt", () => {
  it("dépose, envoie le fichier et suit la quarantaine jusqu'à l'admission", async () => {
    const { container } = renderAt("/depot");
    const user = userEvent.setup();
    await chooseCin(user);
    expect(await screen.findByRole("textbox", { name: /Numéro/ })).toBeRequired();
    expect(await seriousViolations(container)).toEqual([]);

    await fillAndSend(user, "EE123456");

    expect(await screen.findByText("Document reçu : contrôle en cours…")).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Ouvrir le document" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(stub.documents.at(-1)?.metadata).toEqual({ numero: "EE123456" });
  });

  it("montre les erreurs de métadonnées par champ", async () => {
    renderAt("/depot");
    const user = userEvent.setup();
    await chooseCin(user);
    // Le navigateur exigerait le numéro : on l'omet en supprimant la contrainte.
    (await screen.findByRole("textbox", { name: /Numéro/ })).removeAttribute("required");
    await fillAndSend(user, "");
    expect(await screen.findByText("REQUIRED")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Métadonnées invalides.");
  });

  it("garde la clé d'un fichier d'un essai à l'autre, et en change avec le fichier", async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post("/api/documents", ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.json({ title: "Indisponible", status: 503 }, { status: 503 });
      }),
    );
    renderAt("/depot");
    const user = userEvent.setup();
    await chooseCin(user);
    await fillAndSend(user, "EE1");
    await screen.findByText("Dépôt refusé");
    await user.click(screen.getByRole("button", { name: "Déposer" }));
    await waitFor(() => {
      expect(keys).toHaveLength(2);
    });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("champ fichier absent");
    await user.upload(
      input,
      new File(["%PDF-1.7 autre"], "autre.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Déposer" }));
    await waitFor(() => {
      expect(keys).toHaveLength(3);
    });
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("signale un rejet au contrôle", async () => {
    server.use(
      http.get("/api/documents/:id/reception", ({ params }) =>
        HttpResponse.json({
          id: params["id"],
          status: "REJETE_TECHNIQUE",
          lastVersion: 1,
          pendingVersion: false,
          revision: 2,
        }),
      ),
    );
    renderAt("/depot");
    const user = userEvent.setup();
    await chooseCin(user);
    await fillAndSend(user, "EE1");
    expect(await screen.findByText(/n'a pas passé le contrôle/)).toBeInTheDocument();
  });

  it("refuse un fichier trop volumineux pour le type", async () => {
    renderAt("/depot");
    const user = userEvent.setup();
    await chooseCin(user);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("champ fichier absent");
    const big = new File(["x"], "gros.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    await user.upload(input, big);
    expect(await screen.findByText("Fichier trop volumineux pour ce type.")).toBeInTheDocument();
  });

  it("est réservé aux contributeurs", async () => {
    stub.session = READER;
    renderAt("/depot");
    expect(await screen.findByText("Dépôt réservé aux contributeurs")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Déposer un document" })).not.toBeInTheDocument();
    });
  });
});
