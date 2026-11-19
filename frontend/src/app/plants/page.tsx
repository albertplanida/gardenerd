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
import { PageBreadcrumb } from "@/components/AppNavigation";

import { PlantFormModal } from "./PlantFormModal";

const plantsPageSize = 20;

type ModalState = { mode: "create" } | { mode: "edit"; plant: Plant } | null;

type Status = "loading" | "ready" | "error";

export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [modalState, setModalState] = useState<ModalState>(null);
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPlants() {
      setStatus("loading");

      try {
        const data = await listPlants(plantsPageSize, offset);

        if (isMounted) {
          setPlants(data.items);
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

    loadPlants();

    return () => {
      isMounted = false;
    };
  }, [offset]);

  async function retryLoadPlants() {
    setStatus("loading");

    try {
      const data = await listPlants(plantsPageSize, offset);

      setPlants(data.items);
      setHasNextPage(data.hasNextPage);
      setHasPreviousPage(data.hasPreviousPage);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  function goToPreviousPage() {
    setOffset((currentOffset) => Math.max(0, currentOffset - plantsPageSize));
  }

  function goToNextPage() {
    setOffset((currentOffset) => currentOffset + plantsPageSize);
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
    <Container fluid className="workspace library-workspace">
      <Stack gap="lg">
        <PageBreadcrumb label="Plants" />

        <Group
          className="page-heading"
          justify="space-between"
          align="flex-start"
        >
          <div>
            <Title>Plants</Title>
            <Text c="dimmed" mt="xs">
              A small library of things you want to grow, and what you know
              about them.
            </Text>
          </div>

          <Button onClick={openCreateModal}>+ Add Plant</Button>
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
          <Stack gap="lg">
            <span className="eyebrow">Your plant notes</span>
            <div className="plant-grid">
              {plants.map((plant, index) => (
                <Card key={plant.id} className="plant-card" radius="md">
                  <Stack gap="sm" h="100%">
                    <span className="eyebrow">
                      Plant / {String(offset + index + 1).padStart(2, "0")}
                    </span>
                    <Title order={3}>{plant.name}</Title>
                    <Text className="plant-care-notes" c="dimmed">
                      {plant.careNotes ||
                        "A fresh page. Add what you know about this plant."}
                    </Text>
                    <Button
                      aria-label={`Edit ${plant.name}`}
                      onClick={() => openEditModal(plant)}
                      variant="light"
                      className="edit-plant-button"
                    >
                      Edit notes
                    </Button>
                  </Stack>
                </Card>
              ))}
              <section className="plant-library-note">
                <Title order={2}>A living notebook.</Title>
                <Text>Keep care notes in your own words.</Text>
                <Text>
                  You can use the same Plant in different Growing Trials over
                  time.
                </Text>
              </section>
            </div>
            <Group className="pagination" justify="flex-end">
              <Button
                disabled={!hasPreviousPage}
                onClick={goToPreviousPage}
                variant="default"
              >
                Previous
              </Button>
              <Button disabled={!hasNextPage} onClick={goToNextPage}>
                Next
              </Button>
            </Group>
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
