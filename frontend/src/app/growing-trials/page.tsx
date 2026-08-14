"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";

import { AppNavigation } from "@/components/AppNavigation";
import { listGrowingTrials, type GrowingTrial } from "@/graphql/growingTrials";

const growingTrialsPageSize = 20;

type Status = "loading" | "ready" | "error";

export default function GrowingTrialsPage() {
  const [trials, setTrials] = useState<GrowingTrial[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [status, setStatus] = useState<Status>("loading");

  async function loadTrials(currentOffset: number) {
    setStatus("loading");

    try {
      const data = await listGrowingTrials(
        growingTrialsPageSize,
        currentOffset,
      );
      setTrials(data.items);
      setHasNextPage(data.hasNextPage);
      setHasPreviousPage(data.hasPreviousPage);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentPage() {
      setStatus("loading");

      try {
        const data = await listGrowingTrials(growingTrialsPageSize, offset);

        if (isMounted) {
          setTrials(data.items);
          setHasNextPage(data.hasNextPage);
          setHasPreviousPage(data.hasPreviousPage);
          setStatus("ready");
        }
      } catch {
        if (isMounted) {
          setStatus("error");
        }
      }
    }

    loadCurrentPage();

    return () => {
      isMounted = false;
    };
  }, [offset]);

  return (
    <Container py="xl">
      <Stack gap="lg">
        <AppNavigation />

        <div>
          <Title>Growing Trials</Title>
          <Text c="dimmed" mt="xs">
            Plan one Plant in one Container and track each growing attempt.
          </Text>
        </div>

        {status === "loading" ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text>Loading Growing Trials...</Text>
          </Group>
        ) : null}

        {status === "error" ? (
          <Alert color="red" title="Growing Trials could not be loaded.">
            <Stack align="flex-start" gap="sm">
              <Text>Check that the local Gardenerd API is running.</Text>
              <Button
                onClick={() => loadTrials(offset)}
                size="xs"
                variant="light"
              >
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {status === "ready" && trials.length === 0 ? (
          <Card withBorder radius="md">
            <Stack gap="xs">
              <Title order={2}>No Growing Trials yet</Title>
              <Text c="dimmed">
                Plan your first growing attempt by choosing a Plant and
                Container.
              </Text>
            </Stack>
          </Card>
        ) : null}

        {status === "ready" && trials.length > 0 ? (
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
                onClick={() =>
                  setOffset((current) =>
                    Math.max(0, current - growingTrialsPageSize),
                  )
                }
                variant="default"
              >
                Previous
              </Button>
              <Button
                disabled={!hasNextPage}
                onClick={() =>
                  setOffset((current) => current + growingTrialsPageSize)
                }
              >
                Next
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
