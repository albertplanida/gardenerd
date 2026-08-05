import { Button, Card, Container, Stack, Text, Title } from "@mantine/core";

export default function Home() {
  return (
    <Container py="xl">
      <Stack gap="lg">
        <div>
          <Title>Gardenerd</Title>
          <Text c="dimmed" mt="xs">
            Track what you grow, where you grow it, and what you learn along the
            way.
          </Text>
        </div>

        <Card withBorder shadow="sm" radius="md" maw={420}>
          <Stack gap="sm">
            <Title order={2}>Containers</Title>
            <Text c="dimmed">
              Create and manage the pots or places where Growing Trials happen.
            </Text>
            <Button component="a" href="/containers" variant="light">
              Manage Containers
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
