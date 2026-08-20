import { FormEvent, useRef, useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";

import {
  journalEventTypeLabels,
  type JournalEvent,
  type JournalEventEventType,
} from "@/graphql/journalEvents";
import type { GrowingTrial } from "@/graphql/growingTrials";

import { localCalendarDate } from "./presentation";

export type JournalEventFormValues = {
  eventType: JournalEventEventType;
  eventDate: string;
  note: string;
};

type JournalEventModalProps = {
  trial: GrowingTrial;
  event: JournalEvent | null;
  opened: boolean;
  isSaving: boolean;
  saveError: string | null;
  onClose: () => void;
  onClosed: () => void;
  onSubmit: (values: JournalEventFormValues) => Promise<void>;
};

export function JournalEventModal({
  trial,
  event,
  opened,
  isSaving,
  saveError,
  onClose,
  onClosed,
  onSubmit,
}: JournalEventModalProps) {
  const [today] = useState(localCalendarDate);
  const [eventType, setEventType] = useState<JournalEventEventType | null>(
    event?.eventType ?? null,
  );
  const [eventDate, setEventDate] = useState(event?.eventDate ?? today);
  const [note, setNote] = useState(event?.note ?? "");
  const [typeError, setTypeError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const typeInput = useRef<HTMLInputElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const editing = event !== null;

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (isSaving) return;
    const normalizedNote = note.trim();
    const nextTypeError = eventType ? null : "Select an event type.";
    const nextDateError = !eventDate
      ? "Select an event date."
      : trial.startDate && eventDate < trial.startDate
        ? "Event date cannot be before the Growing Trial start date."
        : eventDate > today
          ? "Event date cannot be in the future."
          : null;
    const nextNoteError =
      !normalizedNote || normalizedNote.length > 5000
        ? "Note is required and cannot exceed 5,000 characters."
        : null;
    setTypeError(nextTypeError);
    setDateError(nextDateError);
    setNoteError(nextNoteError);

    if (nextTypeError) return typeInput.current?.focus();
    if (nextDateError) return dateInput.current?.focus();
    if (nextNoteError) return noteInput.current?.focus();
    await onSubmit({
      eventType: eventType!,
      eventDate,
      note: normalizedNote,
    });
  }

  return (
    <Modal
      closeButtonProps={{ disabled: isSaving }}
      onClose={onClose}
      onExitTransitionEnd={onClosed}
      opened={opened}
      title={editing ? "Edit Journal Event" : "Add Journal Event"}
      transitionProps={{ duration: 0 }}
    >
      <form noValidate onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text fw={500}>
            {trial.plant.name} in {trial.container.name}
          </Text>
          {saveError ? (
            <Alert color="red" role="alert">
              {saveError}
            </Alert>
          ) : null}
          <Select
            data={Object.entries(journalEventTypeLabels).map(
              ([value, label]) => ({ value, label }),
            )}
            disabled={isSaving}
            error={typeError}
            label="Event type"
            onChange={(value) => {
              setEventType(value as JournalEventEventType | null);
              setTypeError(null);
            }}
            placeholder="Select an event type"
            ref={typeInput}
            value={eventType}
          />
          <TextInput
            disabled={isSaving}
            error={dateError}
            label="Event date"
            max={today}
            min={trial.startDate ?? undefined}
            onChange={(changeEvent) => {
              setEventDate(changeEvent.currentTarget.value);
              setDateError(null);
            }}
            ref={dateInput}
            type="date"
            value={eventDate}
          />
          <Textarea
            autosize
            description={`${note.length.toLocaleString()} / 5,000 characters`}
            disabled={isSaving}
            error={noteError}
            label="Note"
            maxLength={5000}
            minRows={5}
            onChange={(changeEvent) => {
              setNote(changeEvent.currentTarget.value);
              setNoteError(null);
            }}
            ref={noteInput}
            value={note}
          />
          {isSaving ? <Text role="status">Saving Journal Event...</Text> : null}
          <Group justify="flex-end">
            <Button
              disabled={isSaving}
              onClick={onClose}
              type="button"
              variant="default"
            >
              Cancel
            </Button>
            <Button loading={isSaving} type="submit">
              {editing ? "Save Journal Event" : "Add Journal Event"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
