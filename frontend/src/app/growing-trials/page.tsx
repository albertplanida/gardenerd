"use client";

import { useRef, useState } from "react";
import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { AppNavigation } from "@/components/AppNavigation";
import {
  createGrowingTrial,
  startGrowingTrial,
  type GrowingTrial,
  type GrowingTrialStartMethod,
} from "@/graphql/growingTrials";

import { GrowingTrialFormModal } from "./GrowingTrialFormModal";
import { GrowingTrialList } from "./GrowingTrialList";
import { StartGrowingTrialModal } from "./StartGrowingTrialModal";
import { useGrowingTrialOptions } from "./useGrowingTrialOptions";
import { useGrowingTrials } from "./useGrowingTrials";

const refreshNotificationId = "growing-trial-refresh-failed";
const startErrorMessages: Record<string, string> = {
  GROWING_TRIAL_NOT_FOUND: "Growing Trial not found.",
  GROWING_TRIAL_NOT_PLANNED: "Only planned Growing Trials can be started.",
  START_DATE_IN_FUTURE: "Start date cannot be in the future.",
  CONTAINER_OCCUPIED: "This Container already has an active Growing Trial.",
  INVALID_TIME_ZONE: "Browser time zone is invalid; refresh and try again.",
};
const genericStartError =
  "Growing Trial could not be started. Check your connection and try again.";

function startErrorMessage(error: unknown) {
  const response = (
    error as {
      response?: { errors?: { extensions?: { code?: string } }[] };
    }
  )?.response;
  const code = response?.errors?.[0]?.extensions?.code;
  return (code && startErrorMessages[code]) || genericStartError;
}

export default function GrowingTrialsPage() {
  const trials = useGrowingTrials();
  const [modalOpened, setModalOpened] = useState(false);
  const [modalSession, setModalSession] = useState(0);
  const options = useGrowingTrialOptions(modalOpened);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const [startTrial, setStartTrial] = useState<GrowingTrial | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const starting = useRef(false);

  function closeCreateModal() {
    if (!isSaving) {
      setModalOpened(false);
      setSaveError(false);
    }
  }

  async function retryRefresh() {
    if (await trials.retryRefresh()) {
      notifications.hide(refreshNotificationId);
    }
  }

  function showRefreshWarning() {
    notifications.show({
      id: refreshNotificationId,
      title: "Growing Trial created, but the list could not be refreshed.",
      message: (
        <Button onClick={() => void retryRefresh()} size="xs" variant="light">
          Retry
        </Button>
      ),
      color: "yellow",
      autoClose: false,
      withCloseButton: true,
    });
  }

  async function handleCreate(plantId: string, containerId: string) {
    setIsSaving(true);
    setSaveError(false);

    try {
      const trial = await createGrowingTrial(plantId, containerId);
      setModalOpened(false);
      setIsSaving(false);
      notifications.show({
        title: "Growing Trial created",
        message: `${trial.plant.name} in ${trial.container.name}`,
        color: "green",
        autoClose: 5000,
      });
      if (!(await trials.acceptCreated(trial))) showRefreshWarning();
    } catch {
      setSaveError(true);
      setIsSaving(false);
    }
  }

  function closeStartModal() {
    if (!starting.current) {
      setStartTrial(null);
      setStartError(null);
    }
  }

  async function handleStart(
    startDate: string,
    startMethod: GrowingTrialStartMethod,
  ) {
    if (!startTrial || starting.current) return;
    starting.current = true;
    setIsStarting(true);
    setStartError(null);

    try {
      const updated = await startGrowingTrial(
        startTrial.id,
        startDate,
        startMethod,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      trials.acceptStarted(updated);
      setStartTrial(null);
    } catch (error) {
      setStartError(startErrorMessage(error));
    } finally {
      starting.current = false;
      setIsStarting(false);
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
          <Button
            ref={addButton}
            onClick={() => {
              setSaveError(false);
              setModalSession((current) => current + 1);
              setModalOpened(true);
            }}
          >
            Add Growing Trial
          </Button>
        </Group>

        <GrowingTrialList
          trials={trials.items}
          status={trials.status}
          hasNextPage={trials.hasNextPage}
          hasPreviousPage={trials.hasPreviousPage}
          onNext={() => void trials.next()}
          onPrevious={() => void trials.previous()}
          onRetry={() => void trials.retry()}
          onStart={(trial) => {
            setStartError(null);
            setStartTrial(trial);
          }}
        />
      </Stack>

      <GrowingTrialFormModal
        key={modalSession}
        containers={options.containers}
        isSaving={isSaving}
        onClose={closeCreateModal}
        onClosed={() => addButton.current?.focus()}
        onSubmit={handleCreate}
        opened={modalOpened}
        plants={options.plants}
        saveError={saveError}
      />
      <StartGrowingTrialModal
        key={startTrial?.id}
        isSaving={isStarting}
        onClose={closeStartModal}
        onSubmit={handleStart}
        saveError={startError}
        trial={startTrial}
      />
    </Container>
  );
}
