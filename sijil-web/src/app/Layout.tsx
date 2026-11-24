import { lazy, Suspense, useCallback, useState } from "react";
import { Avatar } from "@awb/ui";
import awbLogo from "@awb-logo";
import { NavLink, Outlet } from "react-router";
import { hasSeenTour, markTourSeen, tourSettings } from "@/features/tour/seen";
import { tourSteps } from "@/features/tour/steps";
import { logout } from "@/shared/logout";
import {
  canAdministerSharing,
  canContribute,
  canReview,
  canSeeCatalogue,
  useSession,
  type Session,
} from "@/shared/session";
import { Button } from "@/shared/ui";

const GuidedTour = lazy(() => import("@/features/tour/GuidedTour"));

interface NavItem {
  to: string;
  label: string;
  /** Repère de la visite guidée. */
  tour: string;
  end?: boolean;
  visible: (session: Session | undefined) => boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Recherche", tour: "nav-recherche", end: true, visible: () => true },
  {
    to: "/depot",
    label: "Déposer un document",
    tour: "nav-depot",
    visible: (s) => canContribute(s),
  },
  {
    to: "/catalogue",
    label: "Catalogue",
    tour: "nav-catalogue",
    end: true,
    visible: (s) => canSeeCatalogue(s),
  },
  {
    to: "/catalogue/exigences",
    label: "Exigences",
    tour: "nav-exigences",
    visible: (s) => canSeeCatalogue(s),
  },
  {
    to: "/catalogue/revues",
    label: "File de revue",
    tour: "nav-revues",
    visible: (s) => canReview(s),
  },
  {
    to: "/catalogue/partage",
    label: "Partage 360",
    tour: "nav-partage",
    visible: (s) => canAdministerSharing(s),
  },
];

/** Visite guidée : ouverte à la première connexion de l'utilisateur, puis à la demande. */
function useGuidedTour(user: string | undefined) {
  // « auto » tant que l'utilisateur n'a rien choisi : la visite s'ouvre si elle est encore à voir.
  const [choice, setChoice] = useState<"auto" | "open" | "closed">("auto");
  const open =
    choice === "open" ||
    (choice === "auto" && user !== undefined && tourSettings.autoStart && !hasSeenTour(user));
  const start = useCallback(() => {
    setChoice("open");
  }, []);
  const close = useCallback(() => {
    setChoice("closed");
    if (user) markTourSeen(user);
  }, [user]);
  return { open, start, close };
}

/**
 * Gabarit commun, sur le modèle du poste de travail CRC (ADR 0037) : barre latérale avec le logo,
 * la navigation permise par les rôles et l'utilisateur connecté ; contenu sur fond gris clair.
 */
export function Layout() {
  const session = useSession();
  const tour = useGuidedTour(session.data?.user);
  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-gray-50">
      <a href="#contenu" className="sijil-skip-link">
        Aller au contenu
      </a>
      <aside className="flex w-64 shrink-0 flex-col border-e border-gray-200 bg-white">
        <div
          className="flex items-center gap-3 border-b border-gray-100 px-5 py-4"
          data-tour="accueil"
        >
          <img src={awbLogo} alt="" className="size-10" />
          <h1 className="text-xl font-bold text-gray-900">
            <NavLink to="/">Sijil</NavLink>
          </h1>
        </div>
        <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {NAV.filter((item) => item.visible(session.data)).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end ?? false}
                  data-tour={item.tour}
                  className="flex w-full items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-100 aria-[current=page]:bg-orange-50 aria-[current=page]:text-orange-700"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {session.data && (
          <div className="flex flex-col gap-3 border-t border-gray-100 p-4">
            <div
              className="flex min-w-0 items-center gap-3"
              role="group"
              aria-label="Utilisateur connecté"
              data-tour="utilisateur"
            >
              {/* Teinte fixe : la couleur tirée du nom par @awb/ui descend jusqu'à 3,8:1 sous ses initiales. */}
              <Avatar
                size="sm"
                name={session.data.user}
                style={{ backgroundColor: "var(--color-orange-700)" }}
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-gray-900">
                  {session.data.user}
                </span>
                {session.data.parcours.length > 0 && (
                  <span className="truncate text-xs text-gray-600">
                    {session.data.parcours.join(", ")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm" data-tour="visite" onClick={tour.start}>
                Visite guidée
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void logout();
                }}
              >
                Se déconnecter
              </Button>
            </div>
          </div>
        )}
        {tour.open && session.data && (
          <Suspense fallback={null}>
            <GuidedTour steps={tourSteps(session.data)} onClose={tour.close} />
          </Suspense>
        )}
      </aside>
      <main id="contenu" className="min-h-0 flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
