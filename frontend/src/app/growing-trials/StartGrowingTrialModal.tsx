import { FormEvent, useRef, useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";

import type {
  GrowingTrial,
  GrowingTrialStartMethod,
} from "@/graphql/growingTrials";

type StartGrowingTrialModalProps = {
  trial: GrowingTrial | null;
  isSaving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSubmit: (
    startDate: string,
    startMethod: GrowingTrialStartMethod,
  ) => Promise<void>;
};

export function localCalendarDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function StartGrowingTrialModal({
  trial,
  isSaving,
  saveError,
  onClose,
  onSubmit,
}: StartGrowingTrialModalProps) {
  const [today] = useState(localCalendarDate);
  const [startDate, setStartDate] = useState(today);
  const [startMethod, setStartMethod] =
    useState<GrowingTrialStartMethod | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const methodInput = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const nextDateError = !startDate
      ? "Select a start date."
      : startDate > today
        ? "Start date cannot be in the future."
        : null;
    const nextMethodError = startMethod ? null : "Select a start method.";
    setDateError(nextDateError);
    setMethodError(nextMethodError);

    if (nextDateError) {
      dateInput.current?.focus();
      return;
    }
    if (nextMethodError) {
      methodInput.current?.focus();
      return;
    }

    await onSubmit(startDate, startMethod!);
  }

  return (
    <Modal
      closeButtonProps={{ disabled: isSaving }}
      opened={trial !== null}
      onClose={onClose}
      title="Start Growing Trial"
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
            label="Start date"
            max={today}
            onChange={(event) => {
              setStartDate(event.currentTarget.value);
              setDateError(null);
            }}
            ref={dateInput}
            type="date"
            value={startDate}
          />
          <Select
            data={[
              { value: "SEED", label: "Seed" },
              {
                value: "SEEDLING_TRANSPLANT",
                label: "Seedling/transplant",
              },
            ]}
            disabled={isSaving}
            error={methodError}
            label="Start method"
            onChange={(value) => {
              setStartMethod(value as GrowingTrialStartMethod | null);
              setMethodError(null);
            }}
            placeholder="Select a start method"
            ref={methodInput}
            value={startMethod}
          />
          {isSaving ? (
            <Text role="status">Starting Growing Trial...</Text>
          ) : null}
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
              Start Growing Trial
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
