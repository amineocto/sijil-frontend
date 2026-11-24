import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/shared/ui/icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
