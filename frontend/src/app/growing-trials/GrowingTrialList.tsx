import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";

import type { GrowingTrial } from "@/graphql/growingTrials";

type GrowingTrialListProps = {
  trials: GrowingTrial[];
  status: "loading" | "ready" | "error";
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onRetry: () => void;
};

export function GrowingTrialList({
  trials,
  status,
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  onRetry,
}: GrowingTrialListProps) {
  if (status === "loading") {
    return (
      <Group gap="sm" role="status">
        <Loader size="sm" />
        <Text>Loading Growing Trials...</Text>
      </Group>
    );
  }

  if (status === "error") {
    return (
      <Alert color="red" title="Growing Trials could not be loaded.">
        <Stack align="flex-start" gap="sm">
          <Text>Check that the local Gardenerd API is running.</Text>
          <Button onClick={onRetry} size="xs" variant="light">
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  }

  if (trials.length === 0) {
    return (
      <Card withBorder radius="md">
        <Stack gap="xs">
          <Title order={2}>No Growing Trials yet</Title>
          <Text c="dimmed">
            Plan your first growing attempt by choosing a Plant and Container.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="sm">
      {trials.map((trial) => (
        <Card key={trial.id} withBorder radius="md">
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Title order={3}>
                {trial.plant.name} in {trial.container.name}
              </Title>
              <Badge variant="light">Planned</Badge>
            </Group>
            <Text c="dimmed" size="sm">
              Plant: {trial.plant.name}
            </Text>
            <Text c="dimmed" size="sm">
              Container: {trial.container.name}
            </Text>
          </Stack>
        </Card>
      ))}
      <Group justify="flex-end">
        <Button
          disabled={!hasPreviousPage}
          onClick={onPrevious}
          variant="default"
        >
          Previous
        </Button>
        <Button disabled={!hasNextPage} onClick={onNext}>
          Next
        </Button>
      </Group>
    </Stack>
  );
}
