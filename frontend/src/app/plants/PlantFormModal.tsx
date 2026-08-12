import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";

type PlantFormModalProps = {
  opened: boolean;
  mode: "create" | "edit";
  initialName?: string;
  initialCareNotes?: string;
  isSaving: boolean;
  error: boolean;
  onClose: () => void;
  onSubmit: (name: string, careNotes: string) => Promise<void>;
};

const requiredMessage = "Plant name is required.";
const plantNameMaxLength = 255;
const plantCareNotesMaxLength = 5000;
const nameMaxLengthMessage = `Plant name must be ${plantNameMaxLength} characters or fewer.`;
const careNotesMaxLengthMessage = `Plant care notes must be ${plantCareNotesMaxLength} characters or fewer.`;

export function PlantFormModal({
  opened,
  mode,
  initialName = "",
  initialCareNotes = "",
  isSaving,
  error,
  onClose,
  onSubmit,
}: PlantFormModalProps) {
  const [name, setName] = useState(initialName);
  const [careNotes, setCareNotes] = useState(initialCareNotes);
  const [nameError, setNameError] = useState<string | null>(null);
  const [careNotesError, setCareNotesError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedCareNotes = careNotes.trim();
    let hasError = false;

    if (!trimmedName) {
      setNameError(requiredMessage);
      hasError = true;
    } else if (trimmedName.length > plantNameMaxLength) {
      setNameError(nameMaxLengthMessage);
      hasError = true;
    } else {
      setNameError(null);
    }

    if (trimmedCareNotes.length > plantCareNotesMaxLength) {
      setCareNotesError(careNotesMaxLengthMessage);
      hasError = true;
    } else {
      setCareNotesError(null);
    }

    if (hasError) {
      return;
    }

    await onSubmit(trimmedName, trimmedCareNotes);
  }

  const title = mode === "create" ? "Add Plant" : "Edit Plant";
  const submitLabel = mode === "create" ? "Create Plant" : "Save Plant";

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      transitionProps={{ duration: 0 }}
    >
      <Stack gap="md">
        {error ? <Alert color="red">Plant could not be saved.</Alert> : null}
        <TextInput
          error={nameError}
          label="Plant name"
          maxLength={plantNameMaxLength}
          onChange={(event) => setName(event.currentTarget.value)}
          value={name}
        />
        <Textarea
          autosize
          error={careNotesError}
          label="Care notes"
          maxLength={plantCareNotesMaxLength}
          minRows={4}
          onChange={(event) => setCareNotes(event.currentTarget.value)}
          value={careNotes}
        />
        <Group justify="flex-end">
          <Button disabled={isSaving} onClick={onClose} variant="default">
            Cancel
          </Button>
          <Button loading={isSaving} onClick={handleSubmit}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
