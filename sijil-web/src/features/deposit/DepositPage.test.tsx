import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { READER } from "@/mocks/data";
import { renderAt, seriousViolations } from "@/test/render";
import { receptionFollow } from "./DepositPage";
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
    // Le navigateur compile « pattern » avec le drapeau v : un motif invalide y est ignoré.
    const holder = screen.getByRole("textbox", { name: /Identifiant du titulaire/ });
    expect(() => new RegExp(holder.getAttribute("pattern") ?? "", "v")).not.toThrow();
    expect(await seriousViolations(container)).toEqual([]);

    await fillAndSend(user, "EE123456");

    expect(await screen.findByText("Document reçu : contrôle en cours…")).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Ouvrir le document" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(stub.documents.at(-1)?.metadata).toEqual({ numero: "EE123456" });
  });

  it("contrôle le formulaire avant d'envoyer le fichier", async () => {
    let sessions = 0;
    server.use(
      http.post("/api/upload-sessions", () => {
        sessions++;
        return HttpResponse.json({ title: "Inattendu", status: 500 }, { status: 500 });
      }),
    );
    renderAt("/depot");
    const user = userEvent.setup();
    await chooseCin(user);
    await user.click(await screen.findByRole("button", { name: "Déposer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Corrigez les champs signalés");
    expect(screen.getByRole("textbox", { name: /Numéro/ })).toHaveAccessibleDescription(
      /Obligatoire/,
    );
    expect(screen.getByText("Choisissez un fichier")).toBeVisible();

    // Le numéro de CIN en minuscules : la cause est nommée, rien ne part.
    await fillAndSend(user, "h338225");
    expect(screen.getByText("Lettres en majuscules attendues : H338225")).toBeVisible();
    expect(sessions).toBe(0);
  });

  it("rattache au champ les refus du serveur", async () => {
    server.use(
      http.post("/api/documents", () =>
        HttpResponse.json(
          {
            title: "Règle métier non respectée",
            status: 422,
            detail: "Parties ou métadonnées non conformes au type.",
            errors: [{ field: "metadata/numero", code: "PATTERN" }],
          },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    renderAt("/depot");
    const user = userEvent.setup();
    await chooseCin(user);
    await fillAndSend(user, "EE1");
    expect(await screen.findByText("Format incorrect pour ce champ")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Les champs concernés sont signalés.");
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

  it("propose de vérifier à nouveau quand le contrôle dure au-delà du suivi automatique", async () => {
    const maxPolls = receptionFollow.maxPolls;
    receptionFollow.maxPolls = 1;
    let calls = 0;
    server.use(
      http.get("/api/documents/:id/reception", ({ params }) => {
        calls += 1;
        return HttpResponse.json({
          id: params["id"],
          status: calls > 1 ? "ACTIF" : "EN_QUARANTAINE",
          lastVersion: 1,
          pendingVersion: false,
          revision: calls,
        });
      }),
    );
    try {
      renderAt("/depot");
      const user = userEvent.setup();
      await chooseCin(user);
      await fillAndSend(user, "EE123456");

      expect(await screen.findByText("Contrôle plus long que prévu")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ouvrir la fiche" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Vérifier à nouveau" }));
      expect(await screen.findByRole("link", { name: "Ouvrir le document" })).toBeInTheDocument();
    } finally {
      receptionFollow.maxPolls = maxPolls;
    }
  });

  it("refuse un fichier trop volumineux pour le type", async () => {
    renderAt("/depot");
    const user = userEvent.setup({ applyAccept: false });
    await chooseCin(user);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("champ fichier absent");
    const big = new File(["x"], "gros.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    await user.upload(input, big);
    await user.click(screen.getByRole("button", { name: "Déposer" }));
    expect(await screen.findByText(/Fichier trop volumineux : \d+ Mo au plus/)).toBeInTheDocument();
    await user.upload(input, new File(["x"], "note.txt", { type: "text/plain" }));
    expect(await screen.findByText(/Format non admis pour ce type/)).toBeInTheDocument();
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
