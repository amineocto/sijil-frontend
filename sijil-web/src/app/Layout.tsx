import { Avatar } from "@awb/ui";
import awbLogo from "@awb-logo";
import { NavLink, Outlet } from "react-router";
import { logout } from "@/shared/logout";
import {
  canContribute,
  canReview,
  canSeeCatalogue,
  useSession,
  type Session,
} from "@/shared/session";
import { Button } from "@/shared/ui";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  visible: (session: Session | undefined) => boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Recherche", end: true, visible: () => true },
  { to: "/depot", label: "Déposer un document", visible: (s) => canContribute(s) },
  { to: "/catalogue", label: "Catalogue", end: true, visible: (s) => canSeeCatalogue(s) },
  { to: "/catalogue/exigences", label: "Exigences", visible: (s) => canSeeCatalogue(s) },
  { to: "/catalogue/revues", label: "File de revue", visible: (s) => canReview(s) },
];

/**
 * Gabarit commun, sur le modèle du poste de travail CRC (ADR 0037) : barre latérale avec le logo,
 * la navigation permise par les rôles et l'utilisateur connecté ; contenu sur fond gris clair.
 */
export function Layout() {
  const session = useSession();
  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-gray-50">
      <a href="#contenu" className="sijil-skip-link">
        Aller au contenu
      </a>
      <aside className="flex w-64 shrink-0 flex-col border-e border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
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
        )}
      </aside>
      <main id="contenu" className="min-h-0 flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
