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
  Image,
} from "@mantine/core";
import { useEffect, useState, type ReactNode } from "react";
import type { GrowingTrial } from "@/graphql/growingTrials";
import { listJournalEvents } from "@/graphql/journalEvents";
import { PotIllustration } from "@/components/Botanical";
import { editPlant } from "@/graphql/plants";
import { PlantFormModal } from "../plants/PlantFormModal";
import {
  formatDateOnly,
  startMethodLabels,
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
  variant?: "dashboard" | "management";
  selectedId?: string | null;
  onOpen?: (id: string) => void;
  onBack?: () => void;
};

function TrialCareNotes({
  trial,
  onRefresh,
}: {
  trial: GrowingTrial;
  onRefresh: () => Promise<unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [plant, setPlant] = useState(trial.plant);
  return (
    <>
      <section className={`care-note ${expanded ? "care-expanded" : ""}`}>
        <button
          className="care-toggle"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          Care notes <span>{expanded ? "-" : "+"}</span>
        </button>
        <div className="care-content">
          <span className="eyebrow">From your plant library</span>
          <Title order={2}>A note on care</Title>
          <Text style={{ whiteSpace: "pre-wrap" }}>
            {plant.careNotes ||
              "A space for what your plant likes. Add care notes to your plant library as you learn."}
          </Text>
          <Button
            variant="light"
            onClick={() => {
              setError(false);
              setEditing(true);
            }}
          >
            Edit Plant notes
          </Button>
        </div>
      </section>
      {editing && (
        <PlantFormModal
          opened
          mode="edit"
          initialName={plant.name}
          initialCareNotes={plant.careNotes}
          isSaving={saving}
          error={error}
          onClose={() => {
            if (!saving) setEditing(false);
          }}
          onSubmit={async (name, careNotes) => {
            setSaving(true);
            setError(false);
            try {
              const updated = await editPlant(plant.id, name, careNotes);
              setPlant(updated);
              setEditing(false);
              void onRefresh();
            } catch {
              setError(true);
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </>
  );
}

function TrialCover({ trial }: { trial: GrowingTrial }) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (trial.status !== "PLANNED") {
      void listJournalEvents(trial.id, 20, null, controller.signal)
        .then((page) => {
          if (!controller.signal.aborted)
            setPhoto(
              page.items.flatMap((event) => event.photos ?? [])[0]
                ?.thumbnailUrl ?? null,
            );
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [trial.id, trial.status]);
  return (
    <div className="trial-cover">
      {photo ? (
        <Image
          src={photo}
          alt={`${trial.plant.name} journal photo`}
          h="100%"
          w="100%"
          fit="cover"
          onError={() => setPhoto(null)}
        />
      ) : (
        <div className="photo-placeholder">
          <PotIllustration />
          <span>Room for a first photo.</span>
        </div>
      )}
      <Badge
        className={`trial-status status-${trial.status.toLowerCase()}`}
        variant="light"
      >
        {statusLabels[trial.status]}
      </Badge>
    </div>
  );
}

export function GrowingTrialList(props: GrowingTrialListProps) {
  const {
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
    variant = "management",
    selectedId,
    onOpen,
    onBack,
  } = props;
  if (status === "loading")
    return (
      <Group className="loading-panel" gap="sm" role="status">
        <Loader size="sm" />
        <Text>Loading Growing Trials...</Text>
      </Group>
    );
  if (status === "error")
    return (
      <Alert color="red" title="Growing Trials could not be loaded.">
        <Stack align="flex-start" gap="sm">
          <Text>Check that the local Gardenerd API is running.</Text>
          <Button onClick={onRetry} variant="light">
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  if (!trials.length)
    return (
      emptyContent ?? (
        <Card className="empty-state">
          <PotIllustration />
          <Title order={2}>A little room to grow.</Title>
          <Text c="dimmed">
            Plan your first growing attempt by choosing a Plant and Container.
          </Text>
        </Card>
      )
    );
  const selected = trials.find((trial) => trial.id === selectedId);
  if (selected)
    return (
      <section
        className="trial-detail"
        id={`growing-trial-${selected.id}`}
        tabIndex={-1}
      >
        <Button variant="subtle" onClick={onBack} className="back-button">
          &lt; All Growing Trials
        </Button>
        <div className="page-heading">
          <Title>{selected.plant.name}</Title>
          <Text c="dimmed" mt="xs">
            {selected.container.name}
          </Text>
        </div>
        <div className="trial-facts">
          <div>
            <span className="eyebrow">Status</span>
            <Text>{statusLabels[selected.status]}</Text>
          </div>
          <div>
            <span className="eyebrow">
              {selected.startDate ? "Started" : "Next step"}
            </span>
            <Text>
              {selected.startDate
                ? formatDateOnly(selected.startDate)
                : "Ready when you are"}
            </Text>
          </div>
          {selected.startMethod && (
            <div>
              <span className="eyebrow">Start method</span>
              <Text>{startMethodLabels[selected.startMethod]}</Text>
            </div>
          )}
          {selected.endDate && (
            <div>
              <span className="eyebrow">Ended</span>
              <Text>{formatDateOnly(selected.endDate)}</Text>
            </div>
          )}
          <div className="lifecycle-actions">
            {selected.status === "PLANNED" && (
              <Button onClick={() => onStart(selected)}>
                Start Growing Trial
              </Button>
            )}
            {selected.status === "ACTIVE" && (
              <Button onClick={() => onComplete(selected)}>
                Complete Growing Trial
              </Button>
            )}
            {["ACTIVE", "PLANNED"].includes(selected.status) ? (
              <Button
                variant="subtle"
                color="orange"
                onClick={() => onAbandon(selected)}
              >
                Abandon trial
              </Button>
            ) : (
              <Button variant="light" onClick={() => onEditResult(selected)}>
                Edit result summary
              </Button>
            )}
          </div>
        </div>
        {["COMPLETED", "ABANDONED"].includes(selected.status) && (
          <section className="result-summary">
            <span className="eyebrow">What you learned</span>
            <Title order={2}>Result summary</Title>
            <Text style={{ whiteSpace: "pre-wrap" }}>
              {selected.resultSummary || "No result summary recorded."}
            </Text>
          </section>
        )}
        <div className="journal-layout">
          <JournalEventTimeline
            key={selected.id}
            trial={selected}
            onRefreshTrials={onRefreshTrials}
            defaultExpanded
          />
          <aside className="care-column">
            <TrialCareNotes
              key={selected.id}
              trial={selected}
              onRefresh={onRefreshTrials}
            />
            <section className="learning-note">
              <Title order={3}>What changed today?</Title>
              <Text>
                A new leaf, a dry surface, a first fruit. You do not need a
                perfect note. Just a useful one.
              </Text>
            </section>
          </aside>
        </div>
      </section>
    );
  return (
    <>
      <div
        className={variant === "dashboard" ? "trial-card-grid" : "trial-rows"}
      >
        {trials.map((trial) => (
          <Card
            className={`trial-card ${variant === "management" ? "trial-row" : ""}`}
            id={`growing-trial-${trial.id}`}
            tabIndex={-1}
            key={trial.id}
          >
            {variant === "dashboard" && <TrialCover trial={trial} />}
            <div className="trial-card-body">
              <div className="trial-card-heading">
                <Title order={3}>{trial.plant.name}</Title>
                {variant === "management" && (
                  <Badge
                    className={`status-${trial.status.toLowerCase()}`}
                    variant="light"
                  >
                    {statusLabels[trial.status]}
                  </Badge>
                )}
              </div>
              <Text className="trial-container" c="dimmed" size="sm">
                {trial.container.name}
              </Text>
              <Text className="trial-date" c="dimmed" size="xs">
                {trial.startDate
                  ? `Started ${formatDateOnly(trial.startDate)}`
                  : "A new growing story, ready to begin."}
              </Text>
              <Group className="trial-card-actions" gap="xs">
                <Button variant="light" onClick={() => onOpen?.(trial.id)}>
                  {trial.status === "COMPLETED" || trial.status === "ABANDONED"
                    ? "View result"
                    : "Open journal"}{" "}
                  &gt;
                </Button>
                {trial.status === "PLANNED" && (
                  <Button onClick={() => onStart(trial)}>
                    Start trial &gt;
                  </Button>
                )}
              </Group>
            </div>
          </Card>
        ))}
      </div>
      {(variant !== "dashboard" || hasNextPage || hasPreviousPage) && (
        <Group className="pagination" justify="flex-end">
          <Button
            disabled={!hasPreviousPage}
            onClick={onPrevious}
            variant="default"
          >
            Previous
          </Button>
          <Button disabled={!hasNextPage} onClick={onNext} variant="light">
            Next
          </Button>
        </Group>
      )}
    </>
  );
}
