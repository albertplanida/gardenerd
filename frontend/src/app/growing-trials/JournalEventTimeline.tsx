import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { graphqlErrorCode, type GraphqlErrorCode } from "@/graphql/errors";
import {
  createJournalEvent,
  deleteJournalEvent,
  deleteJournalPhoto,
  journalEventTypeLabels,
  updateJournalEvent,
  type JournalEvent,
  type JournalPhoto,
} from "@/graphql/journalEvents";
import type { GrowingTrial } from "@/graphql/growingTrials";

import { DeleteJournalEventModal } from "./DeleteJournalEventModal";
import { DeleteJournalPhotoModal } from "./DeleteJournalPhotoModal";
import {
  JournalEventModal,
  type JournalEventFormValues,
} from "./JournalEventModal";
import { formatDateOnly } from "./presentation";
import { useJournalEvents } from "./useJournalEvents";
import {
  AddJournalPhotos,
  JournalPhotoGallery,
  PendingJournalPhotos,
} from "./JournalPhotoControls";
import { maxJournalPhotos } from "./journalPhotos";
import { useJournalPhotoUploads } from "./useJournalPhotoUploads";

type JournalEventTimelineProps = {
  trial: GrowingTrial;
  onRefreshTrials: () => Promise<unknown>;
};

type PendingMutation =
  | { kind: "create" }
  | { kind: "update"; eventId: string }
  | { kind: "delete"; eventId: string }
  | { kind: "deletePhoto"; eventId: string; photoId: string }
  | null;

const journalErrorMessages: Partial<Record<GraphqlErrorCode, string>> = {
  EVENT_DATE_BEFORE_TRIAL_START:
    "Event date cannot be before the Growing Trial start date.",
  EVENT_DATE_IN_FUTURE: "Event date cannot be in the future.",
  INVALID_JOURNAL_NOTE: "Note is required and cannot exceed 5,000 characters.",
  INVALID_TIME_ZONE: "Browser time zone is invalid; refresh and try again.",
  JOURNAL_EVENT_NOT_FOUND: "This Journal Event no longer exists. Try again.",
  INTERNAL_ERROR: "Internal server error. Try again.",
};
const genericError =
  "Journal Event could not be saved. Check your connection and try again.";

export function JournalEventTimeline({
  trial,
  onRefreshTrials,
}: JournalEventTimelineProps) {
  const timeline = useJournalEvents(trial.id);
  const [expanded, setExpanded] = useState(false);
  const [formEvent, setFormEvent] = useState<JournalEvent | null>(null);
  const [formOpened, setFormOpened] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<JournalEvent | null>(null);
  const [deletePhoto, setDeletePhoto] = useState<{
    eventId: string;
    photo: JournalPhoto;
  } | null>(null);
  const focusTarget = useRef<HTMLElement | null>(null);
  const mounted = useRef(true);
  const regionId = `journal-${trial.id}`;
  const active = trial.status === "ACTIVE";
  const photoUploads = useJournalPhotoUploads({
    events: timeline.items,
    onUploaded: timeline.acceptPhoto,
    onRefresh: () => timeline.firstPage("refresh"),
    onLifecycleConflict: handleLifecycleConflict,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function restoreFocus() {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target?.isConnected) target.focus();
    else document.getElementById(`growing-trial-${trial.id}`)?.focus();
  }

  function notifyReconciliationFailure() {
    notifications.show({
      id: `journal-refresh-failed-${trial.id}`,
      title: "The Journal timeline could not be refreshed.",
      message:
        "Your change was saved. Use Retry in the timeline to refresh it.",
      color: "yellow",
      autoClose: false,
    });
  }

  async function refreshAfterMissingTrial() {
    notifications.show({
      title: "Journal timeline unavailable",
      message: "This Growing Trial no longer exists. Refreshing the list.",
      color: "yellow",
      autoClose: 8000,
    });
    await onRefreshTrials();
  }

  async function loadFirstPage() {
    const result = await timeline.firstPage();
    if (
      typeof result === "object" &&
      graphqlErrorCode(result.error) === "GROWING_TRIAL_NOT_FOUND"
    ) {
      await refreshAfterMissingTrial();
    }
  }

  function openForm(event: JournalEvent | null, origin: HTMLElement) {
    focusTarget.current = origin;
    setFormEvent(event);
    setSaveError(null);
    setFormSession((current) => current + 1);
    setFormOpened(true);
  }

  async function handleLifecycleConflict() {
    setFormOpened(false);
    setDeleteEvent(null);
    setDeletePhoto(null);
    notifications.show({
      title: "Journal Event was not changed",
      message:
        "This Growing Trial is no longer active. Refreshing the trial and timeline.",
      color: "yellow",
      autoClose: 8000,
    });
    await Promise.all([onRefreshTrials(), timeline.firstPage("refresh")]);
  }

  async function handleSave(values: JournalEventFormValues) {
    if (pendingMutation) return;
    const editedEvent = formEvent;
    setPendingMutation(
      editedEvent
        ? { kind: "update", eventId: editedEvent.id }
        : { kind: "create" },
    );
    setSaveError(null);
    try {
      const { photos, ...eventValues } = values;
      const variables = {
        ...eventValues,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      const saved = editedEvent
        ? await updateJournalEvent(editedEvent.id, variables)
        : await createJournalEvent(trial.id, variables);
      if (!mounted.current) return;
      const reconcile = editedEvent
        ? timeline.acceptUpdated(saved, editedEvent.eventDate)
        : timeline.acceptCreated(saved, photos.length > 0);
      if (!editedEvent && photos.length) photoUploads.enqueue(saved.id, photos);
      setFormOpened(false);
      notifications.show({
        title: editedEvent ? "Journal Event updated" : "Journal Event added",
        message: `${journalEventTypeLabels[saved.eventType]} on ${formatDateOnly(saved.eventDate)}`,
        color: "green",
        autoClose: 5000,
      });
      const result = await reconcile;
      if (mounted.current && typeof result === "object") {
        notifyReconciliationFailure();
      }
    } catch (error) {
      if (!mounted.current) return;
      const code = graphqlErrorCode(error);
      if (
        code === "GROWING_TRIAL_NOT_ACTIVE" ||
        code === "GROWING_TRIAL_NOT_FOUND"
      ) {
        await handleLifecycleConflict();
      } else {
        setSaveError((code && journalErrorMessages[code]) || genericError);
      }
    } finally {
      if (mounted.current) setPendingMutation(null);
    }
  }

  async function handleDeletePhoto() {
    if (!deletePhoto || pendingMutation) return;
    const target = deletePhoto;
    setPendingMutation({
      kind: "deletePhoto",
      eventId: target.eventId,
      photoId: target.photo.id,
    });
    try {
      await deleteJournalPhoto(target.photo.id);
      if (!mounted.current) return;
      timeline.acceptPhotoDeleted(target.eventId, target.photo.id);
      setDeletePhoto(null);
      notifications.show({
        title: "Photo removed",
        message: `${target.photo.originalFilename} was permanently removed.`,
        color: "green",
        autoClose: 5000,
      });
    } catch (error) {
      if (!mounted.current) return;
      const code = graphqlErrorCode(error);
      if (
        code === "GROWING_TRIAL_NOT_ACTIVE" ||
        code === "JOURNAL_EVENT_NOT_FOUND"
      ) {
        await handleLifecycleConflict();
      } else if (code === "JOURNAL_PHOTO_NOT_FOUND") {
        timeline.acceptPhotoDeleted(target.eventId, target.photo.id);
        setDeletePhoto(null);
        notifications.show({
          title: "Photo no longer exists",
          message: "The Journal timeline has been updated.",
          color: "yellow",
        });
      } else {
        notifications.show({
          title: "Photo was not removed",
          message: "The existing photo was preserved. Try again.",
          color: "red",
          autoClose: 8000,
        });
      }
    } finally {
      if (mounted.current) setPendingMutation(null);
    }
  }

  async function handleDelete() {
    if (!deleteEvent || pendingMutation) return;
    setPendingMutation({ kind: "delete", eventId: deleteEvent.id });
    try {
      const id = deleteEvent.id;
      await deleteJournalEvent(id);
      if (!mounted.current) return;
      const reconcile = timeline.acceptDeleted(id);
      setDeleteEvent(null);
      notifications.show({
        title: "Journal Event deleted",
        message: "The Journal Event was permanently deleted.",
        color: "green",
        autoClose: 5000,
      });
      const result = await reconcile;
      if (mounted.current && typeof result === "object") {
        notifyReconciliationFailure();
      }
    } catch (error) {
      if (!mounted.current) return;
      const code = graphqlErrorCode(error);
      if (
        code === "GROWING_TRIAL_NOT_ACTIVE" ||
        code === "GROWING_TRIAL_NOT_FOUND"
      ) {
        await handleLifecycleConflict();
      } else {
        notifications.show({
          title: "Journal Event was not deleted",
          message:
            (code && journalErrorMessages[code]) ||
            "Check your connection and try again.",
          color: "red",
          autoClose: 8000,
        });
      }
    } finally {
      if (mounted.current) setPendingMutation(null);
    }
  }

  return (
    <Stack gap="sm" mt="xs">
      <Divider />
      <Button
        aria-controls={regionId}
        aria-expanded={expanded}
        mih={44}
        onClick={() => {
          const opening = !expanded;
          setExpanded(opening);
          if (opening && timeline.status === "idle") void loadFirstPage();
        }}
        variant="subtle"
      >
        {expanded ? "Hide Journal" : "Show Journal"}
      </Button>
      {expanded ? (
        <Stack
          aria-label="Journal timeline"
          gap="md"
          id={regionId}
          role="region"
        >
          {active ? (
            <Button
              disabled={timeline.status !== "ready"}
              mih={44}
              onClick={(event) => openForm(null, event.currentTarget)}
              variant="light"
            >
              Add Journal Event
            </Button>
          ) : null}
          {timeline.status === "loading" ? (
            <Group role="status">
              <Loader size="sm" />
              <Text>Loading Journal Events...</Text>
            </Group>
          ) : null}
          {timeline.status === "error" ? (
            <Alert color="red" title="Journal Events could not be loaded.">
              <Button
                onClick={() => void loadFirstPage()}
                size="xs"
                variant="light"
              >
                Try Journal again
              </Button>
            </Alert>
          ) : null}
          {timeline.status === "ready" && timeline.items.length === 0 ? (
            <Text c="dimmed">
              {trial.status === "PLANNED"
                ? "Journal Events become available after this Growing Trial starts."
                : active
                  ? "No Journal Events have been recorded yet."
                  : "No Journal Events were recorded before this Growing Trial ended."}
            </Text>
          ) : null}
          {timeline.items.map((timelineEvent) => {
            const event = {
              ...timelineEvent,
              photos: timelineEvent.photos ?? [],
            };
            const pendingPhotos = photoUploads.uploads.filter(
              (upload) => upload.eventId === event.id,
            );
            const remaining = Math.max(
              0,
              maxJournalPhotos - event.photos.length - pendingPhotos.length,
            );
            return (
              <Stack gap="xs" key={event.id}>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Text fw={600}>
                    {journalEventTypeLabels[event.eventType]}
                  </Text>
                  <Text c="dimmed" size="sm">
                    <time dateTime={event.eventDate}>
                      {formatDateOnly(event.eventDate)}
                    </time>
                  </Text>
                </Group>
                <Text style={{ whiteSpace: "pre-wrap" }}>{event.note}</Text>
                <JournalPhotoGallery
                  active={active}
                  deletingPhotoId={
                    pendingMutation?.kind === "deletePhoto" &&
                    pendingMutation.eventId === event.id
                      ? pendingMutation.photoId
                      : null
                  }
                  event={event}
                  onDelete={(photo, origin) => {
                    focusTarget.current = origin;
                    setDeletePhoto({ eventId: event.id, photo });
                  }}
                  onImageError={() => void timeline.firstPage("refresh")}
                />
                <PendingJournalPhotos
                  onRemove={photoUploads.remove}
                  onRetry={photoUploads.retry}
                  uploads={pendingPhotos}
                />
                {active ? (
                  <AddJournalPhotos
                    disabled={remaining === 0}
                    onSelect={(files) => photoUploads.enqueue(event.id, files)}
                    remaining={remaining}
                  />
                ) : null}
                {active ? (
                  <Group grow wrap="wrap">
                    <Button
                      aria-label={`Edit ${journalEventTypeLabels[event.eventType]} Journal Event from ${event.eventDate}`}
                      mih={44}
                      onClick={(clickEvent) =>
                        openForm(event, clickEvent.currentTarget)
                      }
                      variant="default"
                    >
                      Edit
                    </Button>
                    <Button
                      aria-label={`Delete ${journalEventTypeLabels[event.eventType]} Journal Event from ${event.eventDate}`}
                      color="red"
                      mih={44}
                      onClick={(clickEvent) => {
                        focusTarget.current = clickEvent.currentTarget;
                        setDeleteEvent(event);
                      }}
                      variant="light"
                    >
                      Delete
                    </Button>
                  </Group>
                ) : null}
                <Divider />
              </Stack>
            );
          })}
          {timeline.refreshFailed ? (
            <Alert
              color="yellow"
              title="The Journal timeline may be out of date."
            >
              <Button
                onClick={() => void timeline.firstPage("refresh")}
                size="xs"
                variant="light"
              >
                Retry Journal refresh
              </Button>
            </Alert>
          ) : null}
          {timeline.loadMoreFailed ? (
            <Alert
              color="red"
              title="Older Journal Events could not be loaded."
            >
              <Button
                onClick={() => void timeline.loadMore()}
                size="xs"
                variant="light"
              >
                Retry loading older Journal Events
              </Button>
            </Alert>
          ) : null}
          {timeline.hasNextPage &&
          !timeline.loadMoreFailed &&
          !timeline.refreshing &&
          !timeline.refreshFailed ? (
            <Button
              loading={timeline.loadingMore}
              mih={44}
              onClick={() => void timeline.loadMore()}
              variant="default"
            >
              Load more Journal Events
            </Button>
          ) : null}
        </Stack>
      ) : null}
      <JournalEventModal
        event={formEvent}
        isSaving={
          pendingMutation?.kind === "create" ||
          pendingMutation?.kind === "update"
        }
        key={`journal-form-${formSession}`}
        onClose={() => {
          if (!pendingMutation) setFormOpened(false);
        }}
        onClosed={restoreFocus}
        onSubmit={handleSave}
        opened={formOpened}
        saveError={saveError}
        trial={trial}
      />
      <DeleteJournalEventModal
        event={deleteEvent}
        isDeleting={pendingMutation?.kind === "delete"}
        onClose={() => {
          if (!pendingMutation) setDeleteEvent(null);
        }}
        onClosed={restoreFocus}
        onConfirm={handleDelete}
      />
      <DeleteJournalPhotoModal
        isDeleting={pendingMutation?.kind === "deletePhoto"}
        onClose={() => {
          if (!pendingMutation) setDeletePhoto(null);
        }}
        onClosed={restoreFocus}
        onConfirm={handleDeletePhoto}
        photo={deletePhoto?.photo ?? null}
      />
    </Stack>
  );
}
