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
  createPlant,
  editPlant,
  listPlants,
  type Plant,
} from "@/graphql/plants";
import { AppNavigation } from "@/components/AppNavigation";

import { PlantFormModal } from "./PlantFormModal";

type ModalState = { mode: "create" } | { mode: "edit"; plant: Plant } | null;

type Status = "loading" | "ready" | "error";

export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [modalState, setModalState] = useState<ModalState>(null);
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPlants() {
      setStatus("loading");

      try {
        const data = await listPlants();

        if (isMounted) {
          setPlants(data);
          setStatus("ready");
        }
      } catch {
        if (isMounted) {
          setStatus("error");
        }
      }
    }

    loadPlants();

    return () => {
      isMounted = false;
    };
  }, []);

  async function retryLoadPlants() {
    setStatus("loading");

    try {
      const data = await listPlants();

      setPlants(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

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

  function openEditModal(plant: Plant) {
    setSaveError(false);
    setModalState({ mode: "edit", plant });
  }

  async function handleSave(name: string, careNotes: string) {
    if (!modalState) {
      return;
    }

    setIsSaving(true);
    setSaveError(false);

    try {
      if (modalState.mode === "edit") {
        const updated = await editPlant(modalState.plant.id, name, careNotes);

        setPlants((currentPlants) =>
          currentPlants.map((plant) =>
            plant.id === updated.id ? updated : plant,
          ),
        );
      } else {
        const created = await createPlant(name, careNotes);

        setPlants((currentPlants) => [...currentPlants, created]);
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
        <AppNavigation />

        <Group justify="space-between" align="flex-start">
          <div>
            <Title>Plants</Title>
            <Text c="dimmed" mt="xs">
              Keep notes for plants you may want to grow.
            </Text>
          </div>

          <Button onClick={openCreateModal}>Add Plant</Button>
        </Group>

        {status === "loading" ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text>Loading Plants...</Text>
          </Group>
        ) : null}

        {status === "error" ? (
          <Alert color="red" title="Plants could not be loaded.">
            <Stack align="flex-start" gap="sm">
              <Text>Check that the local Gardenerd API is running.</Text>
              <Button onClick={retryLoadPlants} size="xs" variant="light">
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {status === "ready" && plants.length === 0 ? (
          <Card withBorder radius="md">
            <Stack gap="xs">
              <Title order={2}>No Plants yet</Title>
              <Text c="dimmed">
                Add your first plant and capture plain text care notes.
              </Text>
            </Stack>
          </Card>
        ) : null}

        {status === "ready" && plants.length > 0 ? (
          <Stack gap="sm">
            {plants.map((plant) => (
              <Card key={plant.id} withBorder radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Title order={3}>{plant.name}</Title>
                    <Button
                      aria-label={`Edit ${plant.name}`}
                      onClick={() => openEditModal(plant)}
                      variant="subtle"
                    >
                      Edit
                    </Button>
                  </Group>
                  {plant.careNotes ? <Text>{plant.careNotes}</Text> : null}
                </Stack>
              </Card>
            ))}
          </Stack>
        ) : null}
      </Stack>

      {modalState ? (
        <PlantFormModal
          error={saveError}
          initialCareNotes={
            modalState.mode === "edit" ? modalState.plant.careNotes : undefined
          }
          initialName={
            modalState.mode === "edit" ? modalState.plant.name : undefined
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
