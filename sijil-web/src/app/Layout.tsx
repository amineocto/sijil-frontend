import { lazy, Suspense, useCallback, useState, type ComponentType, type SVGProps } from "react";
import { Avatar } from "@awb/ui";
import awbLogo from "@awb-logo";
import { NavLink, Outlet } from "react-router";
import { useCollapsedMenu } from "@/app/menu";
import { PartyLookup } from "@/features/dossier/PartyLookup";
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
import {
  CatalogueIcon,
  ChecklistIcon,
  CollapseIcon,
  CompassIcon,
  ExpandIcon,
  LogoutIcon,
  ReviewIcon,
  SearchIcon,
  ShareIcon,
  UploadIcon,
} from "@/shared/ui/icons";

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

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Menu par intention : consulter, alimenter, administrer ; chaque entrée suit les rôles. */
const NAV: NavGroup[] = [
  {
    label: "Consulter",
    items: [
      {
        to: "/",
        label: "Recherche",
        icon: SearchIcon,
        tour: "nav-recherche",
        end: true,
        visible: () => true,
      },
    ],
  },
  {
    label: "Alimenter",
    items: [
      {
        to: "/depot",
        label: "Déposer un document",
        icon: UploadIcon,
        tour: "nav-depot",
        visible: (s) => canContribute(s),
      },
    ],
  },
  {
    label: "Administrer",
    items: [
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
    ],
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
 * Gabarit « dossier client 360 » : en-tête avec la recherche de dossier et l'utilisateur, menu
 * latéral repliable groupé par intention, contenu sur fond gris clair.
 */
export function Layout() {
  const session = useSession();
  const tour = useGuidedTour(session.data?.user);
  const menu = useCollapsedMenu();
  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-gray-50">
      <a href="#contenu" className="sijil-skip-link">
        Aller au contenu
      </a>
      <header className="flex h-16 shrink-0 items-center gap-6 border-b border-gray-200 bg-white px-4">
        <div className="flex shrink-0 items-center gap-3" data-tour="accueil">
          <img src={awbLogo} alt="" className="size-9" />
          <h1 className="text-xl font-bold text-gray-900">
            <NavLink to="/">Sijil</NavLink>
          </h1>
        </div>
        <PartyLookup className="w-full max-w-2xl" tour="recherche-globale" />
        {session.data && (
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-tour="visite"
              onClick={tour.start}
              className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none"
            >
              <CompassIcon />
              <span className="max-lg:sr-only">Visite guidée</span>
            </button>
            <div
              className="flex min-w-0 items-center gap-3 border-s border-gray-200 ps-3"
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
              <div className="flex min-w-0 flex-col max-md:sr-only">
                <span className="truncate text-sm font-semibold text-gray-900">
                  {session.data.user}
                </span>
                {session.data.parcours.length > 0 && (
                  <span className="truncate text-xs text-gray-600">
                    Parcours {session.data.parcours.join(", ")}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Se déconnecter"
              title="Se déconnecter"
              onClick={() => {
                void logout();
              }}
              className="flex size-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none"
            >
              <LogoutIcon />
            </button>
          </div>
        )}
      </header>
      <div className="flex min-h-0 flex-1">
        <SideMenu session={session.data} collapsed={menu.collapsed} onToggle={menu.toggle} />
        <main id="contenu" className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      {tour.open && session.data && (
        <Suspense fallback={null}>
          <GuidedTour steps={tourSteps(session.data)} onClose={tour.close} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * Menu latéral : déplié, icônes et libellés groupés ; replié, icônes seules (le libellé reste le
 * nom accessible et l'infobulle). Le choix est mémorisé dans ce navigateur.
 */
function SideMenu({
  session,
  collapsed,
  onToggle,
}: {
  session: Session | undefined;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.visible(session)),
  })).filter((g) => g.items.length > 0);
  return (
    <aside
      className={`flex shrink-0 flex-col border-e border-gray-200 bg-white transition-[width] duration-200 motion-reduce:transition-none ${collapsed ? "w-[4.5rem]" : "w-60"}`}
    >
      <nav
        id="menu-principal"
        aria-label="Navigation principale"
        className="flex-1 overflow-x-hidden overflow-y-auto p-3"
      >
        {groups.map((group, index) => (
          <div key={group.label} className={index > 0 ? "mt-4" : ""}>
            {collapsed ? (
              index > 0 && <hr className="mx-2 mb-3 border-gray-200" />
            ) : (
              <p
                id={`menu-${group.label}`}
                className="px-3 pb-1.5 text-xs font-bold tracking-wide text-gray-600 uppercase"
              >
                {group.label}
              </p>
            )}
            <ul
              className="space-y-1"
              {...(collapsed
                ? { "aria-label": group.label }
                : { "aria-labelledby": `menu-${group.label}` })}
            >
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end ?? false}
                    data-tour={item.tour}
                    title={collapsed ? item.label : undefined}
                    className={`flex h-11 w-full items-center gap-3 rounded-lg text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 aria-[current=page]:bg-orange-50 aria-[current=page]:font-semibold aria-[current=page]:text-orange-700 ${collapsed ? "justify-center" : "px-3"}`}
                  >
                    <item.icon className="shrink-0" />
                    <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-gray-100 p-3">
        <button
          type="button"
          aria-controls="menu-principal"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
          title={collapsed ? "Déplier le menu" : undefined}
          onClick={onToggle}
          data-tour="menu"
          className={`flex h-10 w-full items-center gap-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:outline-none ${collapsed ? "justify-center" : "px-3"}`}
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
          {!collapsed && <span aria-hidden="true">Réduire le menu</span>}
        </button>
      </div>
    </aside>
  );
}
