import { Anchor, AppShell, Button, Group, Text, Title } from "@mantine/core";
import { Link, NavLink, Outlet } from "react-router";
import { logout } from "@/shared/logout";
import { canContribute, useSession } from "@/shared/session";

/** Gabarit commun : lien d'évitement, en-tête, navigation, utilisateur connecté et déconnexion. */
export function Layout() {
  const session = useSession();
  return (
    <AppShell header={{ height: 64 }} padding="md">
      <a href="#contenu" className="sijil-skip-link">
        Aller au contenu
      </a>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title order={1} size="h3">
              <Anchor component={Link} to="/" underline="never" c="inherit">
                Sijil — Documents
              </Anchor>
            </Title>
            <nav aria-label="Navigation principale">
              <Group gap="md">
                <Anchor component={NavLink} to="/" end>
                  Recherche
                </Anchor>
                {canContribute(session.data) && (
                  <Anchor component={NavLink} to="/depot">
                    Déposer un document
                  </Anchor>
                )}
              </Group>
            </nav>
          </Group>
          {session.data && (
            <Group gap="sm">
              <Text size="sm" aria-label="Utilisateur connecté">
                {session.data.user}
                {session.data.parcours ? ` · ${session.data.parcours}` : ""}
              </Text>
              <Button
                variant="subtle"
                size="compact-sm"
                onClick={() => {
                  void logout();
                }}
              >
                Se déconnecter
              </Button>
            </Group>
          )}
        </Group>
      </AppShell.Header>
      <AppShell.Main id="contenu">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
