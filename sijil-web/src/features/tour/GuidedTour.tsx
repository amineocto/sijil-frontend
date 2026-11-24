import { useEffect, useLayoutEffect, useRef } from "react";
import { TourProvider, useTour, type PopoverContentProps } from "@reactour/tour";
import { Button } from "@/shared/ui";
import { tourSelector, type TourStep } from "./steps";

const TITLE_ID = "sijil-visite-titre";

/**
 * Visite guidée (@reactour/tour) : met en valeur chaque écran ouvert au profil, dans une boîte de
 * dialogue accessible (titre, étape courante, boutons au clavier, Échap pour quitter). Chargée à
 * la demande : elle ne pèse pas sur le premier affichage.
 */
export default function GuidedTour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  return (
    <TourProvider
      defaultOpen
      steps={steps.map((step) => ({
        selector: tourSelector(step.target),
        content: step.title,
        ...(step.centered && { position: "center" as const }),
        ...(step.below && { position: "bottom" as const }),
      }))}
      ContentComponent={(props) => <StepDialog {...props} steps={steps} />}
      // Repères du menu latéral : la bulle à sa droite ; ceux de l'en-tête la placent dessous.
      position="right"
      padding={{ mask: 6, popover: 16 }}
      styles={{
        maskArea: (base) => ({ ...base, rx: 10 }),
        popover: (base) => ({ ...base, borderRadius: 12, padding: 0, maxWidth: 380 }),
      }}
      accessibilityOptions={{
        closeButtonAriaLabel: "Fermer la visite",
        showNavigationScreenReaders: false,
      }}
    >
      <CloseWatcher onClose={onClose} />
    </TourProvider>
  );
}

/** Signale la fermeture, quelle qu'en soit la cause (bouton, Échap, clic hors de la boîte). */
function CloseWatcher({ onClose }: { onClose: () => void }) {
  const { isOpen } = useTour();
  const opened = useRef(false);
  useEffect(() => {
    if (isOpen) opened.current = true;
    else if (opened.current) onClose();
  }, [isOpen, onClose]);
  return null;
}

function StepDialog({
  currentStep,
  setCurrentStep,
  setIsOpen,
  steps,
}: Omit<PopoverContentProps, "steps"> & { steps: TourStep[] }) {
  const step = steps[currentStep];
  const last = currentStep === steps.length - 1;
  const actions = useRef<HTMLDivElement>(null);
  // « Suivant » (ou « Terminer ») reçoit le focus avant l'affichage de l'étape : Entrée fait
  // avancer la visite, sans fenêtre où le focus reste sur le bouton qui l'a lancée.
  useLayoutEffect(() => {
    actions.current?.querySelector<HTMLButtonElement>("button:last-of-type")?.focus();
  }, [currentStep]);
  if (!step) return null;
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      className="flex flex-col gap-3 p-5 text-gray-900"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold tracking-wide text-orange-700 uppercase">
          Visite guidée · étape {currentStep + 1} sur {steps.length}
        </p>
        <button
          type="button"
          aria-label="Fermer la visite"
          className="-m-1 rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => {
            setIsOpen(false);
          }}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <h2 id={TITLE_ID} className="text-lg font-bold">
        {step.title}
      </h2>
      <p className="text-sm leading-relaxed text-gray-700">{step.body}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsOpen(false);
          }}
        >
          Passer la visite
        </Button>
        <div ref={actions} className="flex gap-2">
          {currentStep > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCurrentStep(currentStep - 1);
              }}
            >
              Précédent
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              if (last) setIsOpen(false);
              else setCurrentStep(currentStep + 1);
            }}
          >
            {last ? "Terminer" : "Suivant"}
          </Button>
        </div>
      </div>
    </section>
  );
}
