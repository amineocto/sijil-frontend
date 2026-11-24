import { Link } from "react-router";
import { DocumentSheet } from "@/features/document/DocumentPage";
import { Drawer } from "@/shared/ui/Drawer";

/** Fiche d'un document en volet, au-dessus du dossier (focus rendu à la ligne qui l'a ouverte). */
export function DocumentDrawer({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <Drawer
      label={`Fiche : ${title}`}
      closeLabel="Fermer la fiche"
      onClose={onClose}
      title={
        <Link
          to={`/documents/${id}`}
          className="text-sm font-semibold text-orange-700 hover:text-orange-800 hover:underline"
        >
          Ouvrir en pleine page
        </Link>
      }
    >
      <div className="bg-gray-50 p-4 sm:p-6">
        <DocumentSheet id={id} title={title} />
      </div>
    </Drawer>
  );
}
