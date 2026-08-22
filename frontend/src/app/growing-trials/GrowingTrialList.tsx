import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { ReactNode } from "react";

import type { GrowingTrial } from "@/graphql/growingTrials";

import {
  formatDateOnly,
  startMethodLabels,
  statusColors,
  statusLabels,
} from "./presentation";
import { JournalEventTimeline } from "./JournalEventTimeline";

type GrowingTrialListProps = {
  trials: GrowingTrial[];
  status: "loading" | "ready" | "error";
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onRetry: () => void;
  onStart: (trial: GrowingTrial) => void;
  onComplete: (trial: GrowingTrial) => void;
  onAbandon: (trial: GrowingTrial) => void;
  onEditResult: (trial: GrowingTrial) => void;
  onRefreshTrials: () => Promise<unknown>;
  emptyContent?: ReactNode;
};

export function GrowingTrialList({
  trials,
  status,
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  onRetry,
  onStart,
  onComplete,
  onAbandon,
  onEditResult,
  onRefreshTrials,
  emptyContent,
}: GrowingTrialListProps) {
  if (status === "loading") {
    return (
      <Group gap="sm" role="status">
        <Loader size="sm" />
        <Text>Loading Growing Trials...</Text>
      </Group>
    );
  }

  if (status === "error") {
    return (
      <Alert color="red" title="Growing Trials could not be loaded.">
        <Stack align="flex-start" gap="sm">
          <Text>Check that the local Gardenerd API is running.</Text>
          <Button mih={44} onClick={onRetry} variant="light">
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  }

  if (trials.length === 0) {
    if (emptyContent) return emptyContent;
    return (
      <Card withBorder radius="md">
        <Stack gap="xs">
          <Title order={2}>No Growing Trials yet</Title>
          <Text c="dimmed">
            Plan your first growing attempt by choosing a Plant and Container.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="sm">
      {trials.map((trial) => (
        <Card
          id={`growing-trial-${trial.id}`}
          key={trial.id}
          tabIndex={-1}
          withBorder
          radius="md"
        >
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Title order={3}>
                {trial.plant.name} in {trial.container.name}
              </Title>
              <Badge color={statusColors[trial.status]} variant="light">
                {statusLabels[trial.status]}
              </Badge>
            </Group>
            <Text c="dimmed" size="sm">
              Plant: {trial.plant.name}
            </Text>
            <Text c="dimmed" size="sm">
              Container: {trial.container.name}
            </Text>
            {trial.startDate ? (
              <Text c="dimmed" size="sm">
                Start date:{" "}
                <time dateTime={trial.startDate}>
                  {formatDateOnly(trial.startDate)}
                </time>
              </Text>
            ) : null}
            {trial.startMethod ? (
              <Text c="dimmed" size="sm">
                Start method: {startMethodLabels[trial.startMethod]}
              </Text>
            ) : null}
            {trial.endDate ? (
              <Text c="dimmed" size="sm">
                End date:{" "}
                <time dateTime={trial.endDate}>
                  {formatDateOnly(trial.endDate)}
                </time>
              </Text>
            ) : null}
            {trial.status === "COMPLETED" || trial.status === "ABANDONED" ? (
              <details>
                <summary>Result summary</summary>
                <Text mt="xs" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {trial.resultSummary || "No result summary recorded."}
                </Text>
              </details>
            ) : null}
            {trial.status === "PLANNED" ? (
              <Group grow justify="flex-end" w="100%">
                <Button
                  aria-label={`Start ${trial.plant.name} in ${trial.container.name}`}
                  fullWidth
                  mih={44}
                  onClick={() => onStart(trial)}
                  size="md"
                >
                  Start
                </Button>
                <Button
                  aria-label={`Abandon ${trial.plant.name} in ${trial.container.name}`}
                  mih={44}
                  onClick={() => onAbandon(trial)}
                  size="md"
                  variant="default"
                >
                  Abandon
                </Button>
              </Group>
            ) : null}
            {trial.status === "ACTIVE" ? (
              <Group grow justify="flex-end" w="100%">
                <Button
                  aria-label={`Complete ${trial.plant.name} in ${trial.container.name}`}
                  mih={44}
                  onClick={() => onComplete(trial)}
                  size="md"
                >
                  Complete
                </Button>
                <Button
                  aria-label={`Abandon ${trial.plant.name} in ${trial.container.name}`}
                  color="orange"
                  mih={44}
                  onClick={() => onAbandon(trial)}
                  size="md"
                  variant="light"
                >
                  Abandon
                </Button>
              </Group>
            ) : null}
            {trial.status === "COMPLETED" || trial.status === "ABANDONED" ? (
              <Group justify="flex-end" w="100%">
                <Button
                  aria-label={`Edit result for ${trial.plant.name} in ${trial.container.name}`}
                  mih={44}
                  onClick={() => onEditResult(trial)}
                  size="md"
                  variant="default"
                >
                  Edit
                </Button>
              </Group>
            ) : null}
            <JournalEventTimeline
              onRefreshTrials={onRefreshTrials}
              trial={trial}
            />
          </Stack>
        </Card>
      ))}
      <Group justify="flex-end">
        <Button
          disabled={!hasPreviousPage}
          mih={44}
          onClick={onPrevious}
          variant="default"
        >
          Previous
        </Button>
        <Button disabled={!hasNextPage} mih={44} onClick={onNext}>
          Next
        </Button>
      </Group>
    </Stack>
  );
}
