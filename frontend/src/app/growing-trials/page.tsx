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
import { listContainers, type GardenContainer } from "@/graphql/containers";
import {
  createGrowingTrial,
  listGrowingTrials,
  type GrowingTrial,
} from "@/graphql/growingTrials";
import { listPlants, type Plant } from "@/graphql/plants";

import { GrowingTrialFormModal } from "./GrowingTrialFormModal";

const growingTrialsPageSize = 20;

type Status = "loading" | "ready" | "error";

async function listAllPlants() {
  const pageSize = 50;
  const plants: Plant[] = [];
  let offset = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const page = await listPlants(pageSize, offset);
    plants.push(...page.items);
    hasNextPage = page.hasNextPage;
    offset += pageSize;
  }

  return plants;
}

export default function GrowingTrialsPage() {
  const [trials, setTrials] = useState<GrowingTrial[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [modalOpened, setModalOpened] = useState(false);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [containers, setContainers] = useState<GardenContainer[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

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

  async function loadOptions() {
    setIsLoadingOptions(true);
    setOptionsError(false);

    try {
      const [loadedPlants, loadedContainers] = await Promise.all([
        listAllPlants(),
        listContainers(),
      ]);
      setPlants(loadedPlants);
      setContainers(loadedContainers);
    } catch {
      setOptionsError(true);
    } finally {
      setIsLoadingOptions(false);
    }
  }

  function openCreateModal() {
    setModalOpened(true);
    setSaveError(false);
    loadOptions();
  }

  function closeCreateModal() {
    if (!isSaving) {
      setModalOpened(false);
      setSaveError(false);
    }
  }

  async function handleCreate(plantId: string, containerId: string) {
    setIsSaving(true);
    setSaveError(false);

    try {
      await createGrowingTrial(plantId, containerId);
      await loadTrials(offset);
      setModalOpened(false);
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Container py="xl">
      <Stack gap="lg">
        <AppNavigation />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title>Growing Trials</Title>
            <Text c="dimmed" mt="xs">
              Plan one Plant in one Container and track each growing attempt.
            </Text>
          </div>
          <Button onClick={openCreateModal}>Add Growing Trial</Button>
        </Group>

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

      {modalOpened ? (
        <GrowingTrialFormModal
          containers={containers}
          isLoadingOptions={isLoadingOptions}
          isSaving={isSaving}
          onClose={closeCreateModal}
          onRetryOptions={loadOptions}
          onSubmit={handleCreate}
          opened
          optionsError={optionsError}
          plants={plants}
          saveError={saveError}
        />
      ) : null}
    </Container>
  );
}
