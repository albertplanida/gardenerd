import {
  Button,
  Card,
  Container,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";

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

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder shadow="sm" radius="md">
            <Stack gap="sm">
              <Title order={2}>Containers</Title>
              <Text c="dimmed">
                Create and manage the pots or places where Growing Trials
                happen.
              </Text>
              <Button component="a" href="/containers" variant="light">
                Manage Containers
              </Button>
            </Stack>
          </Card>

          <Card withBorder shadow="sm" radius="md">
            <Stack gap="sm">
              <Title order={2}>Plants</Title>
              <Text c="dimmed">
                Create plant records with simple care notes for future growing.
              </Text>
              <Button component="a" href="/plants" variant="light">
                Manage Plants
              </Button>
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
