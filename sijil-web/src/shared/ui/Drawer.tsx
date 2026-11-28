import { useRef, type ReactNode } from "react";
import { CloseIcon } from "@/shared/ui/icons";
import { useModalFocus } from "@/shared/ui/modal";

/**
 * Volet latéral modal, à l'image du `SideDrawer` d'@awb/ui (bandeau blanc, titre, croix, ombre),
 * mais accessible : boîte de dialogue nommée, focus enfermé, Échap pour fermer, focus rendu à
 * l'élément qui l'a ouvert. Le `SideDrawer` d'@awb/ui ne fait ni l'un ni l'autre (ADR 0037).
 */
export function Drawer({
  label,
  title,
  side = "right",
  width = "max-w-5xl",
  closeLabel = "Fermer",
  onClose,
  children,
}: {
  /** Nom accessible de la boîte de dialogue. */
  label: string;
  /** Contenu du bandeau, à gauche de la croix. */
  title?: ReactNode;
  side?: "left" | "right";
  width?: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useModalFocus(panel, onClose);

  return (
    <div
      className={`fixed inset-0 z-40 flex ${side === "right" ? "justify-end" : "justify-start"}`}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`relative flex h-full w-full flex-col bg-white shadow-2xl ${width}`}
      >
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
          <div className="min-w-0 flex-1">{title}</div>
          <button
            type="button"
            data-autofocus
            aria-label={closeLabel}
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
