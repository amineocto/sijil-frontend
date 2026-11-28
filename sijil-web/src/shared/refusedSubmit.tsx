import { useEffect, useRef, useState, type ReactNode } from "react";

export function ProblemSummary({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p role="alert" className="text-sm font-medium text-red-700">
      {count === 1 ? "1 champ à corriger" : `${String(count)} champs à corriger`} : rien n&apos;a
      été envoyé.
    </p>
  );
}

export function useRefusedSubmit<Container extends HTMLElement = HTMLFormElement>(
  problemCount: number,
): { container: React.RefObject<Container | null>; refuse: () => void; summary: ReactNode } {
  const container = useRef<Container>(null);
  const [refusals, setRefusals] = useState(0);
  useEffect(() => {
    if (refusals > 0) focusFirstInvalidField(container.current);
  }, [refusals]);
  return {
    container,
    refuse: () => {
      setRefusals((count) => count + 1);
    },
    summary: refusals > 0 ? <ProblemSummary count={problemCount} /> : null,
  };
}

function focusFirstInvalidField(container: HTMLElement | null) {
  container?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
