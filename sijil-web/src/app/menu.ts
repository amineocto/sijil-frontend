import { useCallback, useState } from "react";

/** Menu latéral replié ou non, dans ce navigateur (commodité : rien n'en dépend). */
const COLLAPSED_KEY = "sijil-menu-replie";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function useCollapsedMenu() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Stockage indisponible (navigation privée) : le choix vaut pour cette page seulement.
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}
