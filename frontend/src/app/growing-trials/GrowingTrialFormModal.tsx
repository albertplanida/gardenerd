import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
} from "@mantine/core";

import type { GardenContainer } from "@/graphql/containers";
import type { Plant } from "@/graphql/plants";

type GrowingTrialFormModalProps = {
  opened: boolean;
  plants: Plant[];
  containers: GardenContainer[];
  isLoadingOptions: boolean;
  optionsError: boolean;
  isSaving: boolean;
  saveError: boolean;
  onClose: () => void;
  onRetryOptions: () => void;
  onSubmit: (plantId: string, containerId: string) => Promise<void>;
};

export function GrowingTrialFormModal({
  opened,
  plants,
  containers,
  isLoadingOptions,
  optionsError,
  isSaving,
  saveError,
  onClose,
  onRetryOptions,
  onSubmit,
}: GrowingTrialFormModalProps) {
  const [plantId, setPlantId] = useState<string | null>(null);
  const [containerId, setContainerId] = useState<string | null>(null);
  const [plantError, setPlantError] = useState<string | null>(null);
  const [containerError, setContainerError] = useState<string | null>(null);

  async function handleSubmit() {
    setPlantError(plantId ? null : "Select a Plant.");
    setContainerError(containerId ? null : "Select a Container.");

    if (!plantId || !containerId) {
      return;
    }

    await onSubmit(plantId, containerId);
  }

  const missingRecords =
    !isLoadingOptions &&
    !optionsError &&
    (plants.length === 0 || containers.length === 0);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Growing Trial"
      transitionProps={{ duration: 0 }}
    >
      <Stack gap="md">
        {isLoadingOptions ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text>Loading Plants and Containers...</Text>
          </Group>
        ) : null}

        {optionsError ? (
          <Alert color="red" title="Plants and Containers could not be loaded.">
            <Stack align="flex-start" gap="sm">
              <Text>Check that the local Gardenerd API is running.</Text>
              <Button onClick={onRetryOptions} size="xs" variant="light">
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {missingRecords ? (
          <Alert
            color="yellow"
            title="Plant and Container records are required."
          >
            Create at least one Plant and one Container before planning a
            Growing Trial.
          </Alert>
        ) : null}

        {saveError ? (
          <Alert color="red">Growing Trial could not be saved.</Alert>
        ) : null}

        {!isLoadingOptions && !optionsError ? (
          <>
            <Select
              data={plants.map((plant) => ({
                value: plant.id,
                label: plant.name,
              }))}
              disabled={isSaving}
              error={plantError}
              label="Plant"
              onChange={setPlantId}
              placeholder="Select a Plant"
              searchable
              value={plantId}
            />
            <Select
              data={containers.map((container) => ({
                value: container.id,
                label: container.name,
              }))}
              disabled={isSaving}
              error={containerError}
              label="Container"
              onChange={setContainerId}
              placeholder="Select a Container"
              searchable
              value={containerId}
            />
          </>
        ) : null}

        <Group justify="flex-end">
          <Button disabled={isSaving} onClick={onClose} variant="default">
            Cancel
          </Button>
          <Button
            disabled={isLoadingOptions || optionsError || missingRecords}
            loading={isSaving}
            onClick={handleSubmit}
          >
            Create Growing Trial
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
