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

  async function handleSubmit() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError(requiredMessage);
      return;
    }

    setNameError(null);
    await onSubmit(trimmedName, careNotes.trim());
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
          onChange={(event) => setName(event.currentTarget.value)}
          value={name}
        />
        <Textarea
          autosize
          label="Care notes"
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
