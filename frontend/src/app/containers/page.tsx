"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

import { createGraphqlClient } from "@/graphql/client";
import {
  CONTAINERS_QUERY,
  CREATE_CONTAINER_MUTATION,
  EDIT_CONTAINER_MUTATION,
} from "@/graphql/queries";

type GardenContainer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ContainersResponse = {
  containers: GardenContainer[];
};

type CreateContainerResponse = {
  createContainer: GardenContainer;
};

type EditContainerResponse = {
  editContainer: GardenContainer;
};

const requiredMessage = "Container name is required.";

export default function ContainersPage() {
  const [containers, setContainers] = useState<GardenContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContainer, setEditingContainer] =
    useState<GardenContainer | null>(null);
  const [containerName, setContainerName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  function openCreateModal() {
    setContainerName("");
    setNameError(null);
    setSaveError(false);
    setIsCreateOpen(true);
  }

  function closeCreateModal() {
    if (!isSaving) {
      setIsCreateOpen(false);
      setContainerName("");
      setNameError(null);
      setSaveError(false);
    }
  }

  function openEditModal(container: GardenContainer) {
    setEditingContainer(container);
    setContainerName(container.name);
    setNameError(null);
    setSaveError(false);
  }

  function closeEditModal() {
    if (!isSaving) {
      setEditingContainer(null);
      setContainerName("");
      setNameError(null);
      setSaveError(false);
    }
  }

  async function handleCreate() {
    const trimmedName = containerName.trim();

    if (!trimmedName) {
      setNameError(requiredMessage);
      return;
    }

    setIsSaving(true);
    setNameError(null);
    setSaveError(false);

    try {
      const client = createGraphqlClient();
      const data = await client.request<CreateContainerResponse>(
        CREATE_CONTAINER_MUTATION,
        { name: trimmedName },
      );

      setContainers((currentContainers) => [
        ...currentContainers,
        data.createContainer,
      ]);
      setIsCreateOpen(false);
      setContainerName("");
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEdit() {
    const trimmedName = containerName.trim();

    if (!trimmedName) {
      setNameError(requiredMessage);
      return;
    }

    if (!editingContainer) {
      return;
    }

    setIsSaving(true);
    setNameError(null);
    setSaveError(false);

    try {
      const client = createGraphqlClient();
      const data = await client.request<EditContainerResponse>(
        EDIT_CONTAINER_MUTATION,
        { id: editingContainer.id, name: trimmedName },
      );

      setContainers((currentContainers) =>
        currentContainers.map((container) =>
          container.id === data.editContainer.id ? data.editContainer : container,
        ),
      );
      setEditingContainer(null);
      setContainerName("");
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

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

          <Button onClick={openCreateModal}>Add Container</Button>
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
                  <Button
                    aria-label={`Edit ${container.name}`}
                    onClick={() => openEditModal(container)}
                    variant="subtle"
                  >
                    Edit
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        ) : null}
      </Stack>

      <Modal
        opened={isCreateOpen}
        onClose={closeCreateModal}
        title="Add Container"
        transitionProps={{ duration: 0 }}
        withinPortal={false}
      >
        <Stack gap="md">
          {saveError ? (
            <Alert color="red">Container could not be saved.</Alert>
          ) : null}
          <TextInput
            error={nameError}
            label="Container name"
            onChange={(event) => setContainerName(event.currentTarget.value)}
            value={containerName}
          />
          <Group justify="flex-end">
            <Button disabled={isSaving} onClick={closeCreateModal} variant="default">
              Cancel
            </Button>
            <Button loading={isSaving} onClick={handleCreate}>
              Create Container
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={editingContainer !== null}
        onClose={closeEditModal}
        title="Edit Container"
        transitionProps={{ duration: 0 }}
        withinPortal={false}
      >
        <Stack gap="md">
          {saveError ? (
            <Alert color="red">Container could not be saved.</Alert>
          ) : null}
          <TextInput
            error={nameError}
            label="Container name"
            onChange={(event) => setContainerName(event.currentTarget.value)}
            value={containerName}
          />
          <Group justify="flex-end">
            <Button disabled={isSaving} onClick={closeEditModal} variant="default">
              Cancel
            </Button>
            <Button loading={isSaving} onClick={handleEdit}>
              Save Container
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
