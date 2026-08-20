import { FormEvent, useRef, useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";

import type { GrowingTrial } from "@/graphql/growingTrials";

import { localCalendarDate } from "./presentation";

export type EndGrowingTrialMode = "complete" | "abandon" | "edit";

type EndGrowingTrialModalProps = {
  trial: GrowingTrial | null;
  mode: EndGrowingTrialMode;
  isSaving: boolean;
  saveError: string | null;
  onClose: () => void;
  onClosed: () => void;
  onSubmit: (endDate: string, resultSummary: string) => Promise<void>;
};

const modeText = {
  complete: {
    title: "Complete Growing Trial",
    submit: "Complete Growing Trial",
    progress: "Completing Growing Trial...",
  },
  abandon: {
    title: "Abandon Growing Trial",
    submit: "Abandon Growing Trial",
    progress: "Abandoning Growing Trial...",
  },
  edit: {
    title: "Edit Growing Trial Result",
    submit: "Save Result",
    progress: "Saving Growing Trial result...",
  },
} satisfies Record<
  EndGrowingTrialMode,
  { title: string; submit: string; progress: string }
>;

export function EndGrowingTrialModal({
  trial,
  mode,
  isSaving,
  saveError,
  onClose,
  onClosed,
  onSubmit,
}: EndGrowingTrialModalProps) {
  const [today] = useState(localCalendarDate);
  const [endDate, setEndDate] = useState(
    mode === "edit" && trial?.endDate ? trial.endDate : today,
  );
  const [resultSummary, setResultSummary] = useState(
    mode === "edit" ? (trial?.resultSummary ?? "") : "",
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const summaryInput = useRef<HTMLTextAreaElement>(null);
  const copy = modeText[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const nextDateError = !endDate
      ? "Select an end date."
      : endDate > today
        ? "End date cannot be in the future."
        : trial?.startDate && endDate < trial.startDate
          ? "End date cannot be before the start date."
          : null;
    const nextSummaryError =
      resultSummary.trim().length > 5000
        ? "Result summary cannot exceed 5,000 characters."
        : null;
    setDateError(nextDateError);
    setSummaryError(nextSummaryError);

    if (nextDateError) {
      dateInput.current?.focus();
      return;
    }
    if (nextSummaryError) {
      summaryInput.current?.focus();
      return;
    }

    await onSubmit(endDate, resultSummary);
  }

  return (
    <Modal
      closeButtonProps={{ disabled: isSaving }}
      opened={trial !== null}
      onClose={onClose}
      onExitTransitionEnd={onClosed}
      title={copy.title}
      transitionProps={{ duration: 0 }}
    >
      <form noValidate onSubmit={handleSubmit}>
        <Stack gap="md">
          {trial ? (
            <Text fw={500}>
              {trial.plant.name} in {trial.container.name}
            </Text>
          ) : null}
          {saveError ? (
            <Alert color="red" role="alert">
              {saveError}
            </Alert>
          ) : null}
          <TextInput
            disabled={isSaving}
            error={dateError}
            label="End date"
            max={today}
            min={trial?.startDate ?? undefined}
            onChange={(event) => {
              setEndDate(event.currentTarget.value);
              setDateError(null);
            }}
            ref={dateInput}
            type="date"
            value={endDate}
          />
          <Textarea
            autosize
            description={`${resultSummary.length.toLocaleString()} / 5,000 characters`}
            disabled={isSaving}
            error={summaryError}
            label="Result summary (optional)"
            minRows={4}
            onChange={(event) => {
              setResultSummary(event.currentTarget.value);
              setSummaryError(null);
            }}
            ref={summaryInput}
            value={resultSummary}
          />
          {isSaving ? <Text role="status">{copy.progress}</Text> : null}
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
              {copy.submit}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
