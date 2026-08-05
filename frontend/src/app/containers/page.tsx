"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";

import { createGraphqlClient } from "@/graphql/client";
import { CONTAINERS_QUERY } from "@/graphql/queries";

type GardenContainer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ContainersResponse = {
  containers: GardenContainer[];
};

export default function ContainersPage() {
  const [containers, setContainers] = useState<GardenContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadContainers() {
      try {
        const client = createGraphqlClient();
        const data = await client.request<ContainersResponse>(CONTAINERS_QUERY);

        if (isMounted) {
          setContainers(data.containers);
          setLoadError(false);
        }
      } catch {
        if (isMounted) {
          setLoadError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadContainers();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Container py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title>Containers</Title>
            <Text c="dimmed" mt="xs">
              Track the pots and places where Growing Trials happen.
            </Text>
          </div>

          <Button>Add Container</Button>
        </Group>

        {isLoading ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text>Loading Containers...</Text>
          </Group>
        ) : null}

        {loadError ? (
          <Alert color="red" title="Containers could not be loaded.">
            Check that the local Gardenerd API is running, then try again.
          </Alert>
        ) : null}

        {!isLoading && !loadError && containers.length === 0 ? (
          <Card withBorder radius="md">
            <Stack gap="xs">
              <Title order={2}>No Containers yet</Title>
              <Text c="dimmed">
                Add your first pot or growing place to get started.
              </Text>
            </Stack>
          </Card>
        ) : null}

        {!isLoading && !loadError && containers.length > 0 ? (
          <Stack gap="sm">
            {containers.map((container) => (
              <Card key={container.id} withBorder radius="md">
                <Group justify="space-between">
                  <Title order={3}>{container.name}</Title>
                  <Button variant="subtle">Edit</Button>
                </Group>
              </Card>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
