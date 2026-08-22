"use client";

import {
  startTransition,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
} from "react";
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
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";

import { AppNavigation } from "@/components/AppNavigation";
import { graphqlErrorCode, type GraphqlErrorCode } from "@/graphql/errors";
import {
  abandonGrowingTrial,
  completeGrowingTrial,
  createGrowingTrial,
  startGrowingTrial,
  updateGrowingTrialResult,
  type GrowingTrial,
  type GrowingTrialStartMethod,
  type GrowingTrialStatus,
} from "@/graphql/growingTrials";

import { GrowingTrialFormModal } from "./GrowingTrialFormModal";
import { GrowingTrialList } from "./GrowingTrialList";
import {
  EndGrowingTrialModal,
  type EndGrowingTrialMode,
} from "./EndGrowingTrialModal";
import { StartGrowingTrialModal } from "./StartGrowingTrialModal";
import { useGrowingTrialOptions } from "./useGrowingTrialOptions";
import { useGrowingTrials } from "./useGrowingTrials";
import { useGrowingTrialSetupContext } from "./useGrowingTrialSetupContext";

const refreshNotificationId = "growing-trial-refresh-failed";
const startErrorMessages: Partial<Record<GraphqlErrorCode, string>> = {
  GROWING_TRIAL_NOT_FOUND: "Growing Trial not found.",
  GROWING_TRIAL_NOT_PLANNED: "Only planned Growing Trials can be started.",
  START_DATE_IN_FUTURE: "Start date cannot be in the future.",
  CONTAINER_OCCUPIED: "This Container already has an active Growing Trial.",
  INVALID_TIME_ZONE: "Browser time zone is invalid; refresh and try again.",
};
const lifecycleConflictMessages = {
  GROWING_TRIAL_NOT_FOUND:
    "This Growing Trial no longer exists. Refreshing the list.",
  GROWING_TRIAL_NOT_PLANNED:
    "This Growing Trial is no longer planned, so it cannot be started again. Refreshing the list.",
  CONTAINER_OCCUPIED:
    "This Container now has an active Growing Trial. Refreshing the list.",
} as const satisfies Partial<Record<GraphqlErrorCode, string>>;
type LifecycleConflictCode = keyof typeof lifecycleConflictMessages;
const genericStartError =
  "Growing Trial could not be started. Check your connection and try again.";
const terminalErrorMessages: Partial<Record<GraphqlErrorCode, string>> = {
  END_DATE_IN_FUTURE: "End date cannot be in the future.",
  END_DATE_BEFORE_START: "End date cannot be before the start date.",
  END_DATE_BEFORE_LATEST_JOURNAL_EVENT:
    "End date cannot be before the latest Journal Event.",
  INVALID_RESULT_SUMMARY: "Result summary cannot exceed 5,000 characters.",
  INVALID_TIME_ZONE: "Browser time zone is invalid; refresh and try again.",
};
const terminalConflictMessages = {
  GROWING_TRIAL_NOT_FOUND:
    "This Growing Trial no longer exists. Refreshing the list.",
  GROWING_TRIAL_NOT_ACTIVE:
    "This Growing Trial is no longer active, so it cannot be completed. Refreshing the list.",
  GROWING_TRIAL_NOT_ENDABLE:
    "This Growing Trial can no longer be abandoned. Refreshing the list.",
  GROWING_TRIAL_NOT_TERMINAL:
    "This Growing Trial is no longer completed or abandoned. Refreshing the list.",
} as const satisfies Partial<Record<GraphqlErrorCode, string>>;
type TerminalConflictCode = keyof typeof terminalConflictMessages;
const genericTerminalError =
  "Growing Trial could not be updated. Check your connection and try again.";

function startErrorMessage(error: unknown) {
  const code = graphqlErrorCode(error);
  return (code && startErrorMessages[code]) || genericStartError;
}

function isLifecycleConflict(
  code: GraphqlErrorCode | null,
): code is LifecycleConflictCode {
  return code !== null && code in lifecycleConflictMessages;
}

function isTerminalConflict(
  code: GraphqlErrorCode | null,
): code is TerminalConflictCode {
  return code !== null && code in terminalConflictMessages;
}

const filters: {
  label: string;
  status: GrowingTrialStatus | null;
  href: string;
}[] = [
  { label: "Active", status: "ACTIVE", href: "/" },
  { label: "Planned", status: "PLANNED", href: "/?status=planned" },
  { label: "Completed", status: "COMPLETED", href: "/?status=completed" },
  { label: "Abandoned", status: "ABANDONED", href: "/?status=abandoned" },
  { label: "All", status: null, href: "/?status=all" },
];

type GrowingTrialsWorkspaceProps = {
  variant: "dashboard" | "management";
  statusFilter: GrowingTrialStatus | null;
};

export function GrowingTrialsWorkspace({
  variant,
  statusFilter,
}: GrowingTrialsWorkspaceProps) {
  const router = useRouter();
  const [visibleStatusFilter, setVisibleStatusFilter] =
    useOptimistic(statusFilter);
  const trials = useGrowingTrials(visibleStatusFilter);
  const [modalOpened, setModalOpened] = useState(false);
  const [modalSession, setModalSession] = useState(0);
  const options = useGrowingTrialOptions(modalOpened);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const [startTrial, setStartTrial] = useState<GrowingTrial | null>(null);
  const [startModalSession, setStartModalSession] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const starting = useRef(false);
  const startFocusTarget = useRef<string | null>(null);
  const [endTrial, setEndTrial] = useState<GrowingTrial | null>(null);
  const [endMode, setEndMode] = useState<EndGrowingTrialMode>("complete");
  const [endModalSession, setEndModalSession] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const ending = useRef(false);
  const endFocusTarget = useRef<string | null>(null);
  const selectedFilterButton = useRef<HTMLButtonElement>(null);
  const currentStatusFilter = useRef(visibleStatusFilter);
  useLayoutEffect(() => {
    currentStatusFilter.current = visibleStatusFilter;
  }, [visibleStatusFilter]);
  const setup = useGrowingTrialSetupContext(
    variant === "dashboard" &&
      trials.status === "ready" &&
      trials.items.length === 0,
  );

  function openCreateModal() {
    setSaveError(false);
    setModalSession((current) => current + 1);
    setModalOpened(true);
  }

  function closeCreateModal() {
    if (!isSaving) {
      setModalOpened(false);
      setSaveError(false);
    }
  }

  async function retryRefresh() {
    if ((await trials.retryRefresh()) === "applied") {
      notifications.hide(refreshNotificationId);
    }
  }

  function showRefreshWarning() {
    notifications.show({
      id: refreshNotificationId,
      title: "The Growing Trial list could not be refreshed.",
      message: (
        <Button mih={44} onClick={() => void retryRefresh()} variant="light">
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
      if (variant === "dashboard") {
        if (currentStatusFilter.current === "PLANNED") {
          if ((await trials.acceptCreated(trial)) === "failed") {
            showRefreshWarning();
          }
        } else {
          selectFilter("PLANNED", "/?status=planned");
        }
      } else if ((await trials.acceptCreated(trial)) === "failed") {
        showRefreshWarning();
      }
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

  function focusUpdatedTrial(id: string | null) {
    const updatedCard = id
      ? document.getElementById(`growing-trial-${id}`)
      : null;
    if (updatedCard) {
      updatedCard.focus();
      return;
    }
    selectedFilterButton.current?.focus();
  }

  function selectFilter(status: GrowingTrialStatus | null, href: string) {
    startTransition(() => {
      setVisibleStatusFilter(status);
      router.push(href);
    });
  }

  function dashboardEmptyContent() {
    if (setup.status === "loading" || setup.status === "idle") {
      return (
        <Group gap="sm" role="status">
          <Loader size="sm" />
          <Text>Checking your garden setup...</Text>
        </Group>
      );
    }

    if (setup.status === "error") {
      return (
        <Alert color="red" title="Garden setup could not be checked.">
          <Stack align="flex-start" gap="sm">
            <Text>Check that the local Gardenerd API is running.</Text>
            <Button mih={44} onClick={setup.retry} variant="light">
              Try again
            </Button>
          </Stack>
        </Alert>
      );
    }

    if (!setup.context) return null;
    const context = setup.context;

    if (!context.hasPlants || !context.hasContainers) {
      return (
        <Card withBorder radius="md">
          <Stack align="flex-start" gap="sm">
            <Title order={2}>Set up your garden first</Title>
            <Text c="dimmed">
              A Growing Trial needs one Plant and one Container.
            </Text>
            {!context.hasPlants ? (
              <Button component="a" href="/plants" mih={44} variant="light">
                Add a Plant
              </Button>
            ) : null}
            {!context.hasContainers ? (
              <Button component="a" href="/containers" mih={44} variant="light">
                Add a Container
              </Button>
            ) : null}
          </Stack>
        </Card>
      );
    }

    if (!context.hasGrowingTrials) {
      return (
        <Card withBorder radius="md">
          <Stack align="flex-start" gap="sm">
            <Title order={2}>Plan your first Growing Trial</Title>
            <Text c="dimmed">
              Pair a Plant with a Container to start learning from a growing
              attempt.
            </Text>
            <Button mih={44} onClick={openCreateModal}>
              Add Growing Trial
            </Button>
          </Stack>
        </Card>
      );
    }

    const selectedLabel = filters.find(
      (filter) => filter.status === visibleStatusFilter,
    )?.label;
    return (
      <Card withBorder radius="md">
        <Stack align="flex-start" gap="sm">
          <Title order={2}>No {selectedLabel} Growing Trials</Title>
          <Text c="dimmed">
            Your Growing Trials are still available under another status.
          </Text>
          <Button
            mih={44}
            onClick={() => selectFilter(null, "/?status=all")}
            variant="light"
          >
            View all Growing Trials
          </Button>
        </Stack>
      </Card>
    );
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
      startFocusTarget.current = updated.id;
      void trials.acceptUpdated(updated).then((outcome) => {
        if (outcome === "failed") showRefreshWarning();
      });
      setStartTrial(null);
      notifications.show({
        title: "Growing Trial started",
        message: `${updated.plant.name} in ${updated.container.name} is now active.`,
        color: "green",
        autoClose: 5000,
      });
    } catch (error) {
      const code = graphqlErrorCode(error);
      if (isLifecycleConflict(code)) {
        setStartTrial(null);
        setStartError(null);
        notifications.show({
          title: "Growing Trial was not started",
          message: lifecycleConflictMessages[code],
          color: "yellow",
          autoClose: 8000,
        });
        void trials.retryRefresh().then((outcome) => {
          if (outcome === "failed") showRefreshWarning();
        });
      } else {
        setStartError(startErrorMessage(error));
      }
    } finally {
      starting.current = false;
      setIsStarting(false);
    }
  }

  function openEndModal(trial: GrowingTrial, mode: EndGrowingTrialMode) {
    setEndError(null);
    setEndMode(mode);
    setEndModalSession((current) => current + 1);
    endFocusTarget.current = trial.id;
    setEndTrial(trial);
  }

  function closeEndModal() {
    if (!ending.current) {
      setEndTrial(null);
      setEndError(null);
    }
  }

  async function handleEnd(endDate: string, resultSummary: string) {
    if (!endTrial || ending.current) return;
    ending.current = true;
    setIsEnding(true);
    setEndError(null);

    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const updated =
        endMode === "complete"
          ? await completeGrowingTrial(
              endTrial.id,
              endDate,
              resultSummary || null,
              timeZone,
            )
          : endMode === "abandon"
            ? await abandonGrowingTrial(
                endTrial.id,
                endDate,
                resultSummary || null,
                timeZone,
              )
            : await updateGrowingTrialResult(
                endTrial.id,
                endDate,
                resultSummary || null,
                timeZone,
              );
      void trials.acceptUpdated(updated).then((outcome) => {
        if (outcome === "failed") showRefreshWarning();
      });
      setEndTrial(null);
      notifications.show({
        title:
          endMode === "complete"
            ? "Growing Trial completed"
            : endMode === "abandon"
              ? "Growing Trial abandoned"
              : "Growing Trial result updated",
        message: `${updated.plant.name} in ${updated.container.name}`,
        color: "green",
        autoClose: 5000,
      });
    } catch (error) {
      const code = graphqlErrorCode(error);
      if (isTerminalConflict(code)) {
        setEndTrial(null);
        setEndError(null);
        notifications.show({
          title: "Growing Trial was not updated",
          message: terminalConflictMessages[code],
          color: "yellow",
          autoClose: 8000,
        });
        void trials.retryRefresh().then((outcome) => {
          if (outcome === "failed") showRefreshWarning();
        });
      } else {
        setEndError(
          (code && terminalErrorMessages[code]) || genericTerminalError,
        );
      }
    } finally {
      ending.current = false;
      setIsEnding(false);
    }
  }

  return (
    <Container py="xl">
      <Stack gap="lg">
        <AppNavigation />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title>
              {variant === "dashboard" ? "Gardenerd" : "Growing Trials"}
            </Title>
            <Text c="dimmed" mt="xs">
              {variant === "dashboard"
                ? "See what you are growing now and move each attempt forward."
                : "Plan one Plant in one Container and track each growing attempt."}
            </Text>
          </div>
          <Button ref={addButton} mih={44} onClick={openCreateModal}>
            Add Growing Trial
          </Button>
        </Group>

        {variant === "dashboard" ? (
          <Stack gap="sm">
            <Title order={2}>Growing Trials</Title>
            <Group gap="xs" wrap="wrap">
              {filters.map((filter) => {
                const selected = filter.status === visibleStatusFilter;
                return (
                  <Button
                    aria-pressed={selected}
                    key={filter.label}
                    mih={44}
                    onClick={() => selectFilter(filter.status, filter.href)}
                    ref={selected ? selectedFilterButton : undefined}
                    variant={selected ? "filled" : "default"}
                  >
                    {filter.label}
                  </Button>
                );
              })}
            </Group>
          </Stack>
        ) : null}

        <GrowingTrialList
          emptyContent={
            variant === "dashboard" ? dashboardEmptyContent() : undefined
          }
          trials={trials.items}
          status={trials.status}
          hasNextPage={trials.hasNextPage}
          hasPreviousPage={trials.hasPreviousPage}
          onNext={() => void trials.next()}
          onPrevious={() => void trials.previous()}
          onRetry={() => void trials.retry()}
          onStart={(trial) => {
            setStartError(null);
            setStartModalSession((current) => current + 1);
            setStartTrial(trial);
          }}
          onComplete={(trial) => openEndModal(trial, "complete")}
          onAbandon={(trial) => openEndModal(trial, "abandon")}
          onEditResult={(trial) => openEndModal(trial, "edit")}
          onRefreshTrials={trials.retryRefresh}
        />
      </Stack>

      <GrowingTrialFormModal
        key={`create-${modalSession}`}
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
        key={`start-${startModalSession}`}
        isSaving={isStarting}
        onClose={closeStartModal}
        onClosed={() => {
          const id = startFocusTarget.current;
          startFocusTarget.current = null;
          focusUpdatedTrial(id);
        }}
        onSubmit={handleStart}
        saveError={startError}
        trial={startTrial}
      />
      <EndGrowingTrialModal
        key={`end-${endModalSession}`}
        isSaving={isEnding}
        mode={endMode}
        onClose={closeEndModal}
        onClosed={() => {
          const id = endFocusTarget.current;
          endFocusTarget.current = null;
          focusUpdatedTrial(id);
        }}
        onSubmit={handleEnd}
        saveError={endError}
        trial={endTrial}
      />
    </Container>
  );
}
