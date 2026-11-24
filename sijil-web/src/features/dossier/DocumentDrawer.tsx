import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { DocumentSheet } from "@/features/document/DocumentPage";
import { CloseIcon } from "@/shared/ui/icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fiche d'un document en volet, au-dessus du dossier : boîte de dialogue modale (focus enfermé,
 * Échap pour fermer, focus rendu à la ligne qui l'a ouverte).
 */
export function DocumentDrawer({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close.current();
        return;
      }
      if (event.key === "Tab" && panel.current) trapFocus(panel.current, event);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div aria-hidden="true" className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche : ${title}`}
        className="relative flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-3">
          <Link
            to={`/documents/${id}`}
            className="text-sm font-semibold text-orange-700 hover:text-orange-800 hover:underline"
          >
            Ouvrir en pleine page
          </Link>
          <button
            type="button"
            data-autofocus
            aria-label="Fermer la fiche"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-6">
          <DocumentSheet id={id} title={title} />
        </div>
      </div>
    </div>
  );
}

/** Garde le focus dans le volet : Tab sur le dernier élément revient au premier, et inversement. */
function trapFocus(container: HTMLElement, event: KeyboardEvent) {
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items.at(-1);
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first?.focus();
  }
}
