import { lazy, Suspense, useCallback, useState, type ComponentType, type SVGProps } from "react";
import { Avatar } from "@awb/ui";
import awbLogo from "@awb-logo";
import { NavLink, Outlet, useLocation } from "react-router";
import { useCollapsedMenu } from "@/app/menu";
import { PartyLookup } from "@/features/dossier/PartyLookup";
import { hasSeenTour, markTourSeen, tourSettings } from "@/features/tour/seen";
import { profileLabel, tourSteps } from "@/features/tour/steps";
import { logout } from "@/shared/logout";
import {
  canAdministerSharing,
  canContribute,
  canReview,
  canSeeCatalogue,
  useSession,
  type Session,
} from "@/shared/session";
import { Drawer } from "@/shared/ui/Drawer";
import {
  CatalogueIcon,
  ChecklistIcon,
  DictionaryIcon,
  CompassIcon,
  ChevronIcon,
  LogoutIcon,
  ReviewIcon,
  SearchIcon,
  ShareIcon,
  UploadIcon,
} from "@/shared/ui/icons";
import { COMPACT, useMedia } from "@/shared/ui/media";

const GuidedTour = lazy(() => import("@/features/tour/GuidedTour"));

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Repère de la visite guidée. */
  tour: string;
  end?: boolean;
  visible: (session: Session | undefined) => boolean;
}

const NAV: NavItem[] = [
  {
    to: "/",
    label: "Recherche",
    icon: SearchIcon,
    tour: "nav-recherche",
    end: true,
    visible: () => true,
  },
  {
    to: "/depot",
    label: "Déposer un document",
    icon: UploadIcon,
    tour: "nav-depot",
    visible: (s) => canContribute(s),
  },
  {
    to: "/catalogue",
    label: "Catalogue",
    icon: CatalogueIcon,
    tour: "nav-catalogue",
    end: true,
    visible: (s) => canSeeCatalogue(s),
  },
  {
    to: "/catalogue/exigences",
    label: "Exigences",
    icon: ChecklistIcon,
    tour: "nav-exigences",
    visible: (s) => canSeeCatalogue(s),
  },
  {
    to: "/catalogue/dictionnaire",
    label: "Dictionnaire",
    icon: DictionaryIcon,
    tour: "nav-dictionnaire",
    visible: (s) => canSeeCatalogue(s),
  },
  {
    to: "/catalogue/revues",
    label: "File de revue",
    icon: ReviewIcon,
    tour: "nav-revues",
    visible: (s) => canReview(s),
  },
  {
    to: "/catalogue/partage",
    label: "Partage 360",
    icon: ShareIcon,
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
 * Coquille du poste CRC (ADR 0037) : grand écran, menu latéral de 280 px repliable à 80 px par une
 * bascule ronde sur sa bordure, choix mémorisé ; sous 1024 px, barre supérieure et menu en tiroir.
 * La recherche de dossier est dans la barre supérieure de chaque écran.
 */
export function Layout() {
  const session = useSession();
  const tour = useGuidedTour(session.data?.user);
  const menu = useCollapsedMenu();
  const compact = useMedia(COMPACT);
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  // Le tiroir se referme quand l'écran change (lien suivi).
  const [drawerPath, setDrawerPath] = useState(location.pathname);
  if (drawerPath !== location.pathname) {
    setDrawerPath(location.pathname);
    setDrawer(false);
  }
  const expanded = compact || !menu.collapsed;
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-gray-50 text-gray-900">
      <a href="#contenu" className="sijil-skip-link">
        Aller au contenu
      </a>
      {!compact && (
        <aside
          className="relative flex shrink-0 flex-col border-e border-gray-200 bg-white transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: expanded ? 280 : 80 }}
        >
          <button
            type="button"
            aria-controls="menu-principal"
            aria-expanded={expanded}
            aria-label={expanded ? "Réduire le menu" : "Déplier le menu"}
            title={expanded ? "Réduire le menu" : "Déplier le menu"}
            onClick={menu.toggle}
            data-tour="menu"
            className="absolute top-16 -right-4 z-30 flex size-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:border-orange-300 hover:text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none"
          >
            <ChevronIcon
              className={`size-4 transition-transform ${expanded ? "" : "rotate-180"}`}
            />
          </button>
          <Brand expanded={expanded} />
          <Menu id="menu-principal" session={session.data} expanded={expanded} />
          {session.data && (
            <UserBlock session={session.data} expanded={expanded} onTour={tour.start} />
          )}
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6">
          {compact && (
            <>
              <button
                type="button"
                aria-label="Ouvrir le menu"
                aria-expanded={drawer}
                onClick={() => {
                  setDrawer(true);
                }}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <img src={awbLogo} alt="" className="size-9 shrink-0 max-sm:hidden" />
            </>
          )}
          <PartyLookup className="ms-auto w-full lg:max-w-xl" tour="recherche-globale" />
        </header>
        <main id="contenu" className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      {compact && drawer && (
        <Drawer
          label="Menu"
          side="left"
          width="max-w-xs"
          closeLabel="Fermer le menu"
          onClose={() => {
            setDrawer(false);
          }}
          title={<Brand expanded inline />}
        >
          <div className="flex h-full flex-col">
            <Menu session={session.data} expanded />
            {session.data && <UserBlock session={session.data} expanded onTour={tour.start} />}
          </div>
        </Drawer>
      )}
      {tour.open && session.data && (
        <Suspense fallback={null}>
          <GuidedTour steps={tourSteps(session.data)} onClose={tour.close} />
        </Suspense>
      )}
    </div>
  );
}

function Brand({ expanded, inline = false }: { expanded: boolean; inline?: boolean }) {
  return (
    <div
      className={
        inline
          ? "flex items-center gap-2.5"
          : "flex h-20 shrink-0 items-center justify-center gap-3 border-b border-gray-100 px-4"
      }
      data-tour={inline ? undefined : "accueil"}
    >
      <img src={awbLogo} alt="" className={inline ? "size-8" : "size-12"} />
      {expanded && (
        <NavLink to="/" className="text-xl font-bold text-gray-900">
          Sijil
        </NavLink>
      )}
      {!expanded && <span className="sr-only">Sijil</span>}
    </div>
  );
}

function Menu({
  id,
  session,
  expanded,
}: {
  id?: string;
  session: Session | undefined;
  expanded: boolean;
}) {
  return (
    <nav
      id={id}
      aria-label="Navigation principale"
      className="flex-1 overflow-x-hidden overflow-y-auto p-3"
    >
      <ul className="flex flex-col gap-1">
        {NAV.filter((item) => item.visible(session)).map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end ?? false}
              data-tour={id ? item.tour : undefined}
              title={expanded ? undefined : item.label}
              className={`flex h-12 w-full items-center gap-3 rounded-lg text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none aria-[current=page]:bg-orange-50 aria-[current=page]:text-orange-700 ${expanded ? "px-4" : "justify-center"}`}
            >
              <item.icon className="size-5 shrink-0" />
              <span className={expanded ? "truncate" : "sr-only"}>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function UserBlock({
  session,
  expanded,
  onTour,
}: {
  session: Session;
  expanded: boolean;
  onTour: () => void;
}) {
  return (
    <div className="border-t border-gray-100 p-3">
      <div
        className={`flex min-w-0 items-center gap-3 rounded-lg p-2 ${expanded ? "" : "justify-center"}`}
        role="group"
        aria-label="Utilisateur connecté"
        data-tour="utilisateur"
        title={expanded ? undefined : `${session.user} · ${profileLabel(session)}`}
      >
        {/* Teinte fixe : la couleur tirée du nom par @awb/ui descend jusqu'à 3,8:1 sous ses initiales. */}
        <Avatar
          size="sm"
          name={session.user}
          style={{ backgroundColor: "var(--color-orange-700)" }}
        />
        <div className={expanded ? "flex min-w-0 flex-col" : "sr-only"}>
          <span className="truncate text-sm font-bold text-gray-900">{session.user}</span>
          <span className="truncate text-xs text-gray-600">{profileLabel(session)}</span>
        </div>
      </div>
      <div className={`mt-1 flex gap-1 ${expanded ? "" : "flex-col items-center"}`}>
        <button
          type="button"
          data-tour="visite"
          onClick={onTour}
          aria-label={expanded ? undefined : "Visite guidée"}
          title={expanded ? undefined : "Visite guidée"}
          className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none ${expanded ? "flex-1 px-3" : "w-10"}`}
        >
          <CompassIcon className="size-4" />
          {expanded && "Visite guidée"}
        </button>
        <button
          type="button"
          aria-label="Se déconnecter"
          title="Se déconnecter"
          onClick={() => {
            void logout();
          }}
          className="flex size-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none"
        >
          <LogoutIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
