import { FormEvent, useRef, useState } from "react";
import {
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  VisuallyHidden,
} from "@mantine/core";

import type { GrowingTrialOption } from "@/graphql/growingTrials";

type OptionResource = {
  search: string;
  setSearch: (search: string) => void;
  setSearchFromSelection: (search: string) => void;
  options: GrowingTrialOption[];
  isLoading: boolean;
  isInitialLoading: boolean;
  error: boolean;
  retry: () => Promise<void>;
  noRecords: boolean;
};

type GrowingTrialFormModalProps = {
  opened: boolean;
  plants: OptionResource;
  containers: OptionResource;
  isSaving: boolean;
  saveError: boolean;
  onClose: () => void;
  onClosed: () => void;
  onSubmit: (plantId: string, containerId: string) => Promise<void>;
};

function selectorData(
  options: GrowingTrialOption[],
  selected: GrowingTrialOption | null,
) {
  const values = selected
    ? [selected, ...options.filter((option) => option.id !== selected.id)]
    : options;
  return values.map((option) => ({ value: option.id, label: option.name }));
}

export function GrowingTrialFormModal({
  opened,
  plants,
  containers,
  isSaving,
  saveError,
  onClose,
  onClosed,
  onSubmit,
}: GrowingTrialFormModalProps) {
  const [plantId, setPlantId] = useState<string | null>(null);
  const [containerId, setContainerId] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<GrowingTrialOption | null>(
    null,
  );
  const [selectedContainer, setSelectedContainer] =
    useState<GrowingTrialOption | null>(null);
  const [plantError, setPlantError] = useState<string | null>(null);
  const [containerError, setContainerError] = useState<string | null>(null);
  const plantInput = useRef<HTMLInputElement>(null);
  const containerInput = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPlantError = plantId ? null : "Select a Plant.";
    const nextContainerError = containerId ? null : "Select a Container.";
    setPlantError(nextPlantError);
    setContainerError(nextContainerError);

    if (nextPlantError) {
      plantInput.current?.focus();
      return;
    }
    if (nextContainerError) {
      containerInput.current?.focus();
      return;
    }

    await onSubmit(plantId!, containerId!);
  }

  const optionsUnavailable =
    plants.isLoading ||
    containers.isLoading ||
    plants.error ||
    containers.error ||
    plants.noRecords ||
    containers.noRecords;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={onClosed}
      returnFocus
      title="Add Growing Trial"
      transitionProps={{ duration: 0 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {plants.isInitialLoading || containers.isInitialLoading ? (
            <Group gap="sm" role="status">
              <Loader size="sm" />
              <Text>Loading Plant and Container options...</Text>
            </Group>
          ) : null}

          {(plants.isLoading && !plants.isInitialLoading) ||
          (containers.isLoading && !containers.isInitialLoading) ? (
            <VisuallyHidden aria-live="polite" role="status">
              {plants.isLoading && !plants.isInitialLoading
                ? "Searching Plants..."
                : null}
              {containers.isLoading && !containers.isInitialLoading
                ? "Searching Containers..."
                : null}
            </VisuallyHidden>
          ) : null}

          {plants.error ? (
            <Alert color="red" title="Plants could not be loaded." role="alert">
              <Button
                onClick={() => void plants.retry()}
                size="xs"
                type="button"
                variant="light"
              >
                Try Plants again
              </Button>
            </Alert>
          ) : null}
          {containers.error ? (
            <Alert
              color="red"
              title="Containers could not be loaded."
              role="alert"
            >
              <Button
                onClick={() => void containers.retry()}
                size="xs"
                type="button"
                variant="light"
              >
                Try Containers again
              </Button>
            </Alert>
          ) : null}

          {plants.noRecords ? (
            <Alert color="yellow" title="A Plant is required.">
              <Anchor href="/plants">Create a Plant</Anchor> before planning a
              Growing Trial.
            </Alert>
          ) : null}
          {containers.noRecords ? (
            <Alert color="yellow" title="A Container is required.">
              <Anchor href="/containers">Create a Container</Anchor> before
              planning a Growing Trial.
            </Alert>
          ) : null}

          {saveError ? (
            <Alert color="red">Growing Trial could not be saved.</Alert>
          ) : null}

          <Select
            data={selectorData(plants.options, selectedPlant)}
            disabled={isSaving || plants.noRecords}
            error={plantError}
            label="Plant"
            nothingFoundMessage={
              plants.search.trim() ? "No matching Plants" : "No Plants"
            }
            onChange={(value, option) => {
              setPlantId(value);
              if (value) {
                setPlantError(null);
                setSelectedPlant(
                  plants.options.find((option) => option.id === value) ??
                    selectedPlant,
                );
                plants.setSearchFromSelection(option.label);
              }
            }}
            onSearchChange={plants.setSearch}
            placeholder="Select a Plant"
            ref={plantInput}
            searchable
            searchValue={plants.search}
            value={plantId}
          />
          <Select
            data={selectorData(containers.options, selectedContainer)}
            disabled={isSaving || containers.noRecords}
            error={containerError}
            label="Container"
            nothingFoundMessage={
              containers.search.trim()
                ? "No matching Containers"
                : "No Containers"
            }
            onChange={(value, option) => {
              setContainerId(value);
              if (value) {
                setContainerError(null);
                setSelectedContainer(
                  containers.options.find((option) => option.id === value) ??
                    selectedContainer,
                );
                containers.setSearchFromSelection(option.label);
              }
            }}
            onSearchChange={containers.setSearch}
            placeholder="Select a Container"
            ref={containerInput}
            searchable
            searchValue={containers.search}
            value={containerId}
          />

          {isSaving ? <Text role="status">Saving Growing Trial...</Text> : null}

          <Group justify="flex-end">
            <Button
              disabled={isSaving}
              onClick={onClose}
              type="button"
              variant="default"
            >
              Cancel
            </Button>
            <Button
              disabled={optionsUnavailable}
              loading={isSaving}
              type="submit"
            >
              Create Growing Trial
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
