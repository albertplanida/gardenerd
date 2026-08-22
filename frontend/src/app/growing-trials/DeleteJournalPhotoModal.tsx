import { Button, Group, Modal, Stack, Text } from "@mantine/core";

import type { JournalPhoto } from "@/graphql/journalEvents";

export function DeleteJournalPhotoModal({
  photo,
  isDeleting,
  onClose,
  onClosed,
  onConfirm,
}: {
  photo: JournalPhoto | null;
  isDeleting: boolean;
  onClose: () => void;
  onClosed: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      closeButtonProps={{ disabled: isDeleting }}
      onClose={onClose}
      onExitTransitionEnd={onClosed}
      opened={photo !== null}
      title="Remove photo?"
      transitionProps={{ duration: 0 }}
    >
      <Stack>
        <Text>
          Permanently remove {photo?.originalFilename ?? "this photo"} from the
          Journal Event? This cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button disabled={isDeleting} onClick={onClose} variant="default">
            Cancel
          </Button>
          <Button color="red" loading={isDeleting} onClick={onConfirm}>
            Remove photo
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
