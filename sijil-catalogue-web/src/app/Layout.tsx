import { Alert, Anchor, AppShell, Group, Text, Title } from "@mantine/core";
import { Link, Outlet } from "react-router";
import { useSession } from "@/shared/session";

/** Gabarit commun : lien d'évitement, en-tête, avertissement d'authentification provisoire. */
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
                Catalogue des documents
              </Anchor>
            </Title>
          </Group>
          {session.data && (
            <Text size="sm" aria-label="Utilisateur connecté">
              {session.data.user}
            </Text>
          )}
        </Group>
      </AppShell.Header>
      <AppShell.Main id="contenu">
        <Alert color="yellow" title="Authentification simulée (provisoire)" mb="md" role="note">
          Cet écran utilise une session de démonstration, en attendant le BFF du catalogue (L3-08)
          et la décision sur l&apos;IAM (ADR 0011).
        </Alert>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
