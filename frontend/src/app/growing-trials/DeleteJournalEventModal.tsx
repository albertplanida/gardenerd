import { Button, Group, Modal, Stack, Text } from "@mantine/core";

import {
  journalEventTypeLabels,
  type JournalEvent,
} from "@/graphql/journalEvents";

import { formatDateOnly } from "./presentation";

type DeleteJournalEventModalProps = {
  event: JournalEvent | null;
  isDeleting: boolean;
  onClose: () => void;
  onClosed: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteJournalEventModal({
  event,
  isDeleting,
  onClose,
  onClosed,
  onConfirm,
}: DeleteJournalEventModalProps) {
  return (
    <Modal
      closeButtonProps={{ disabled: isDeleting }}
      onClose={onClose}
      onExitTransitionEnd={onClosed}
      opened={event !== null}
      title="Delete Journal Event"
      transitionProps={{ duration: 0 }}
    >
      <Stack gap="md">
        {event ? (
          <Text>
            Permanently delete the {journalEventTypeLabels[event.eventType]}{" "}
            event from {formatDateOnly(event.eventDate)}?
          </Text>
        ) : null}
        {isDeleting ? (
          <Text role="status">Deleting Journal Event...</Text>
        ) : null}
        <Group justify="flex-end">
          <Button
            disabled={isDeleting}
            onClick={onClose}
            type="button"
            variant="default"
          >
            Cancel
          </Button>
          <Button
            color="red"
            loading={isDeleting}
            onClick={() => void onConfirm()}
          >
            Delete Journal Event
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
