import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState, LoadingState } from "@sijil/ui-kit";
import { api, call, isApiError, type Schemas } from "@/shared/api";
import { formatDate } from "@/shared/labels";
import { DataTable, Page } from "@/shared/ui/page";
import { QueryState } from "@/shared/QueryState";
import { canAdministerSharing, useSession } from "@/shared/session";
import { Button, Heading, Notice, Panel, SelectField, Tag, TextAreaField } from "@/shared/ui";

type Sharing = Schemas["TypeSharing"];

/**
 * Écran « Partage 360 » (ADR 0025) : l'administrateur du domaine choisit les types éligibles de son
 * parcours qui apparaissent dans le portefeuille client 360. Le partage n'abaisse jamais la
 * protection d'un document : la couche 3 s'applique toujours à la lecture.
 */
export function SharingPage() {
  const session = useSession();
  const parcoursList = session.data?.parcours ?? [];
  const [chosen, setChosen] = useState<string | null>(null);
  const parcours = chosen ?? parcoursList[0];

  if (session.isPending) return <LoadingState />;
  if (!canAdministerSharing(session.data) || parcours === undefined) {
    return (
      <Page title="Partage 360">
        <EmptyState
          title="Partage réservé à l'administration du domaine"
          description="Votre profil ne permet pas de régler le partage dans le portefeuille client."
        />
      </Page>
    );
  }
  return (
    <Page
      title="Partage dans le portefeuille client 360"
      subtitle="Un type partagé apparaît dans le 360 pour les documents actifs rattachés à un client ; chaque lecteur reste soumis à ses droits sur la sensibilité du document."
    >
      {parcoursList.length > 1 && (
        <div className="max-w-xs">
          <SelectField
            label="Parcours"
            options={parcoursList.map((p) => ({ value: p, label: p }))}
            value={parcours}
            onChange={(e) => {
              setChosen(e.currentTarget.value);
            }}
          />
        </div>
      )}
      <SharingList key={parcours} parcours={parcours} />
    </Page>
  );
}

function SharingList({ parcours }: { parcours: string }) {
  const [selected, setSelected] = useState<Sharing | null>(null);
  const [done, setDone] = useState<Sharing | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const sharing = useQuery({
    queryKey: ["sharing", parcours],
    queryFn: () =>
      call(api.GET("/api/parcours/{parcours}/sharing", { params: { path: { parcours } } })),
  });
  // Libellés lus dans le catalogue ; sans eux, le code suffit.
  const types = useQuery({
    queryKey: ["types", { parcours }],
    queryFn: () => call(api.GET("/api/types", { params: { query: { parcours } } })),
  });
  const labels = new Map((types.data?.items ?? []).map((t) => [t.code, t.label]));
  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ block: "nearest" });
  }, [done]);
  const decided = (s: Sharing) =>
    s.decidedBy ? `${s.decidedBy}${s.decidedAt ? `, le ${formatDate(s.decidedAt)}` : ""}` : "—";
  const action = (s: Sharing) => (
    <Button
      variant="secondary"
      size="sm"
      aria-label={`${s.shared ? "Ne plus partager" : "Partager"} ${s.typeCode}`}
      onClick={() => {
        setDone(null);
        setSelected(s);
      }}
    >
      {s.shared ? "Ne plus partager" : "Partager"}
    </Button>
  );
  return (
    <QueryState query={sharing}>
      {({ items }) =>
        items.length === 0 ? (
          <EmptyState
            title="Aucun type éligible"
            description="Le catalogue ne déclare aucun type éligible au portefeuille client."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {done && (
              <div ref={doneRef}>
                <Notice tone="success" role="status" title="Partage enregistré">
                  {done.typeCode} est {done.shared ? "partagé" : "retiré du partage"} pour le
                  parcours {parcours}.
                </Notice>
              </div>
            )}
            <DataTable
              label={`Partage des types du parcours ${parcours}`}
              rows={items}
              rowKey={(s) => s.typeCode}
              columns={[
                {
                  header: "Type",
                  cell: (s) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{labels.get(s.typeCode) ?? s.typeCode}</span>
                      <span className="font-mono text-xs text-gray-600">{s.typeCode}</span>
                    </div>
                  ),
                },
                {
                  header: "État",
                  cell: (s) =>
                    s.shared ? <Tag variant="success">Partagé</Tag> : <Tag>Non partagé</Tag>,
                },
                { header: "Décidé par", cell: (s) => decided(s) },
                { header: "Motif", cell: (s) => s.reason ?? "—", className: "max-xl:hidden" },
                { header: "Action", align: "end", cell: (s) => action(s) },
              ]}
              mobile={(s) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-semibold">{labels.get(s.typeCode) ?? s.typeCode}</span>
                      <span className="font-mono text-xs text-gray-600">{s.typeCode}</span>
                    </div>
                    {s.shared ? <Tag variant="success">Partagé</Tag> : <Tag>Non partagé</Tag>}
                  </div>
                  <span className="text-sm text-gray-600">{decided(s)}</span>
                  <div>{action(s)}</div>
                </div>
              )}
            />
            {selected && (
              <Decision
                key={selected.typeCode}
                parcours={parcours}
                current={selected}
                onCancel={() => {
                  setSelected(null);
                }}
                onDone={(saved) => {
                  setSelected(null);
                  setDone(saved);
                }}
              />
            )}
          </div>
        )
      }
    </QueryState>
  );
}

function Decision({
  parcours,
  current,
  onCancel,
  onDone,
}: {
  parcours: string;
  current: Sharing;
  onCancel: () => void;
  onDone: (saved: Sharing) => void;
}) {
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  // Le formulaire s'ouvre sous la liste : il est amené à l'écran, le motif prêt à saisir.
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "nearest" });
    panel.current?.querySelector("textarea")?.focus();
  }, []);
  const shared = !current.shared;
  const decide = useMutation({
    mutationFn: () =>
      call(
        api.PUT("/api/parcours/{parcours}/sharing/{code}", {
          params: { path: { parcours, code: current.typeCode } },
          body: { shared, ...(reason.trim() ? { reason: reason.trim() } : {}) },
        }),
      ),
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: ["sharing", parcours] });
      onDone(saved);
    },
  });
  return (
    <div ref={panel}>
      <Panel>
        <form
          aria-label={`Décision de partage pour ${current.typeCode}`}
          className="flex max-w-xl flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            decide.mutate();
          }}
        >
          <Heading level={3}>
            {shared ? "Partager" : "Ne plus partager"} {current.typeCode}
          </Heading>
          <TextAreaField
            label="Motif (facultatif)"
            description="Enregistré avec la décision."
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => {
              setReason(e.currentTarget.value);
            }}
          />
          {decide.error && (
            <Notice tone="danger" role="alert" title="Décision refusée">
              {isApiError(decide.error) ? decide.error.message : "Une erreur est survenue."}
            </Notice>
          )}
          <div className="flex gap-3">
            <Button type="submit" loading={decide.isPending}>
              Confirmer
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Annuler
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
