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

import {
  createContainer,
  editContainer,
  type GardenContainer,
  listContainers,
} from "@/graphql/containers";

import { ContainerFormModal } from "./ContainerFormModal";

type ModalState =
  { mode: "create" } | { mode: "edit"; container: GardenContainer } | null;

type Status = "loading" | "ready" | "error";

export default function ContainersPage() {
  const [containers, setContainers] = useState<GardenContainer[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [modalState, setModalState] = useState<ModalState>(null);
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadContainers() {
      try {
        const data = await listContainers();

        if (isMounted) {
          setContainers(data);
          setStatus("ready");
        }
      } catch {
        if (isMounted) {
          setStatus("error");
        }
      }
    }

    loadContainers();

    return () => {
      isMounted = false;
    };
  }, []);

  function openCreateModal() {
    setSaveError(false);
    setModalState({ mode: "create" });
  }

  function closeModal() {
    if (!isSaving) {
      setModalState(null);
      setSaveError(false);
    }
  }

  function openEditModal(container: GardenContainer) {
    setSaveError(false);
    setModalState({ mode: "edit", container });
  }

  async function handleSave(name: string) {
    if (!modalState) {
      return;
    }

    setIsSaving(true);
    setSaveError(false);

    try {
      if (modalState.mode === "edit") {
        const updated = await editContainer(modalState.container.id, name);

        setContainers((currentContainers) =>
          currentContainers.map((container) =>
            container.id === updated.id ? updated : container,
          ),
        );
      } else {
        const created = await createContainer(name);

        setContainers((currentContainers) => [...currentContainers, created]);
      }

      setModalState(null);
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

        {status === "loading" ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text>Loading Containers...</Text>
          </Group>
        ) : null}

        {status === "error" ? (
          <Alert color="red" title="Containers could not be loaded.">
            Check that the local Gardenerd API is running, then try again.
          </Alert>
        ) : null}

        {status === "ready" && containers.length === 0 ? (
          <Card withBorder radius="md">
            <Stack gap="xs">
              <Title order={2}>No Containers yet</Title>
              <Text c="dimmed">
                Add your first pot or growing place to get started.
              </Text>
            </Stack>
          </Card>
        ) : null}

        {status === "ready" && containers.length > 0 ? (
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

      {modalState ? (
        <ContainerFormModal
          error={saveError}
          initialName={
            modalState.mode === "edit" ? modalState.container.name : undefined
          }
          isSaving={isSaving}
          mode={modalState.mode}
          onClose={closeModal}
          onSubmit={handleSave}
          opened
        />
      ) : null}
    </Container>
  );
}
