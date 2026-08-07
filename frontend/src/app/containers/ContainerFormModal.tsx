import { useState } from "react";
import { Alert, Button, Group, Modal, Stack, TextInput } from "@mantine/core";

type ContainerFormModalProps = {
  opened: boolean;
  mode: "create" | "edit";
  initialName?: string;
  isSaving: boolean;
  error: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

const requiredMessage = "Container name is required.";

export function ContainerFormModal({
  opened,
  mode,
  initialName = "",
  isSaving,
  error,
  onClose,
  onSubmit,
}: ContainerFormModalProps) {
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError(requiredMessage);
      return;
    }

    setNameError(null);
    await onSubmit(trimmedName);
  }

  const title = mode === "create" ? "Add Container" : "Edit Container";
  const submitLabel = mode === "create" ? "Create Container" : "Save Container";

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      transitionProps={{ duration: 0 }}
    >
      <Stack gap="md">
        {error ? (
          <Alert color="red">Container could not be saved.</Alert>
        ) : null}
        <TextInput
          error={nameError}
          label="Container name"
          onChange={(event) => setName(event.currentTarget.value)}
          value={name}
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
