"use client";

import { useState } from "react";
import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { AppNavigation } from "@/components/AppNavigation";
import { createGrowingTrial } from "@/graphql/growingTrials";

import { GrowingTrialFormModal } from "./GrowingTrialFormModal";
import { GrowingTrialList } from "./GrowingTrialList";
import { useGrowingTrialOptions } from "./useGrowingTrialOptions";
import { useGrowingTrials } from "./useGrowingTrials";

const refreshNotificationId = "growing-trial-refresh-failed";

export default function GrowingTrialsPage() {
  const trials = useGrowingTrials();
  const [modalOpened, setModalOpened] = useState(false);
  const options = useGrowingTrialOptions(modalOpened);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

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
            onClick={() => {
              setSaveError(false);
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
        />
      </Stack>

      {modalOpened ? (
        <GrowingTrialFormModal
          containers={options.containers}
          isSaving={isSaving}
          onClose={closeCreateModal}
          onSubmit={handleCreate}
          opened
          plants={options.plants}
          saveError={saveError}
        />
      ) : null}
    </Container>
  );
}
