import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const openModals: symbol[] = [];

export function useModalFocus(panel: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const modal = Symbol("modal");
    openModals.push(modal);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusEntryPoint(panel.current);
    const onKeyDown = (event: KeyboardEvent) => {
      if (openModals.at(-1) !== modal) return;
      if (event.key === "Escape") {
        close.current();
        return;
      }
      if (event.key === "Tab" && panel.current) keepFocusInside(panel.current, event);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openModals.splice(openModals.indexOf(modal), 1);
      opener?.focus();
    };
  }, [panel]);
}

function focusEntryPoint(container: HTMLElement | null) {
  const entry =
    container?.querySelector<HTMLElement>("[data-autofocus]") ??
    container?.querySelector<HTMLElement>(FOCUSABLE);
  entry?.focus();
}

function keepFocusInside(container: HTMLElement, event: KeyboardEvent) {
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
